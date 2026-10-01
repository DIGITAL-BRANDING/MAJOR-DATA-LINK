import type { Server as HttpServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import session from 'express-session';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { verifyAuthToken } from '../lib/auth-token.js';
import { adminSessionStore, ADMIN_SESSION_COOKIE_NAME } from '../admin/setup.js';
import type { AdminSessionUser } from '../admin/auth.js';
import { pushToTokens } from '../services/notification.service.js';
import { sendWebPushToOwner } from '../services/web-push.service.js';

/**
 * Socket.IO transport for customer, partner, and AdminJS live chat.
 * Owners authenticate with their access token; admins reuse the AdminJS
 * session. Open conversations and unread counters back the admin queue.
 */

type OwnerKind = 'USER' | 'PARTNER';

type ChatActor =
  | { kind: 'owner'; ownerType: OwnerKind; id: string; name: string }
  | { kind: 'admin'; id: string; name: string; role: AdminSessionUser['role'] };

type ExpressStyleNext = (err?: unknown) => void;

// Adapt Express session middleware to Socket.IO's HTTP handshake request.
function wrapMiddleware(
  middleware: (req: IncomingMessage, res: ServerResponse, next: ExpressStyleNext) => void
) {
  return (socket: Socket, next: ExpressStyleNext) => {
    middleware(socket.request as IncomingMessage, {} as ServerResponse, next);
  };
}

const readAdminSession = wrapMiddleware(
  session({
    store: adminSessionStore,
    secret: env.ADMIN_SESSION_SECRET,
    name: ADMIN_SESSION_COOKIE_NAME,
    resave: false,
    saveUninitialized: false
  }) as unknown as (req: IncomingMessage, res: ServerResponse, next: ExpressStyleNext) => void
);

const MESSAGE_HISTORY_LIMIT = 200;
const QUEUE_LIMIT = 100;

function conversationRoom(conversationId: string) {
  return `chat-conv:${conversationId}`;
}
const ADMIN_ROOM = 'chat-admins';

// Handle asynchronous socket tasks so transient failures do not escape as
// unhandled rejections and terminate the API process.
function runChatTask(label: string, task: () => Promise<void>) {
  void task().catch((error) => console.error(`[chat-socket] ${label} failed`, error));
}

/** Resolve a shared JWT subject against customer and partner accounts. */
async function resolveOwnerToken(token: string): Promise<ChatActor | null> {
  const payload = verifyAuthToken(token, 'access');

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (user) {
    if (user.accountStatus !== 'ACTIVE') return null;
    return { kind: 'owner', ownerType: 'USER', id: user.id, name: user.fullName };
  }

  const partner = await prisma.partner.findUnique({ where: { id: payload.sub } });
  if (partner) {
    return { kind: 'owner', ownerType: 'PARTNER', id: partner.id, name: partner.businessName };
  }

  return null;
}

async function findOrCreateOpenConversation(ownerType: OwnerKind, ownerId: string) {
  const existing = await prisma.chatConversation.findFirst({
    where: { ownerType, ownerId, status: 'OPEN' },
    orderBy: { createdAt: 'desc' }
  });
  if (existing) return existing;
  return prisma.chatConversation.create({ data: { ownerType, ownerId } });
}

async function loadHistory(conversationId: string) {
  return prisma.chatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    take: MESSAGE_HISTORY_LIMIT,
    include: { replyTo: true }
  });
}

type OpenConversation = Awaited<ReturnType<typeof prisma.chatConversation.findMany>>[number];
type MiniUser = { id: string; fullName: string; email: string; phone: string };
type MiniPartner = { id: string; businessName: string; email: string; phone: string | null };
type QueueRow = Awaited<ReturnType<typeof buildQueueSnapshot>>[number];

async function buildQueueSnapshot() {
  const conversations: OpenConversation[] = await prisma.chatConversation.findMany({
    where: { status: 'OPEN' },
    orderBy: { lastMessageAt: 'asc' },
    take: QUEUE_LIMIT
  });
  if (conversations.length === 0) return [];

  const userIds = [
    ...new Set(conversations.filter((c: OpenConversation) => c.ownerType === 'USER').map((c: OpenConversation) => c.ownerId))
  ];
  const partnerIds = [
    ...new Set(conversations.filter((c: OpenConversation) => c.ownerType === 'PARTNER').map((c: OpenConversation) => c.ownerId))
  ];

  const [users, partners]: [MiniUser[], MiniPartner[]] = await Promise.all([
    userIds.length
      ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true, email: true, phone: true } })
      : Promise.resolve([]),
    partnerIds.length
      ? prisma.partner.findMany({ where: { id: { in: partnerIds } }, select: { id: true, businessName: true, email: true, phone: true } })
      : Promise.resolve([])
  ]);
  const userById = new Map(users.map((u: MiniUser) => [u.id, u] as const));
  const partnerById = new Map(partners.map((p: MiniPartner) => [p.id, p] as const));

  return conversations.map((conversation: OpenConversation) => {
    const owner =
      conversation.ownerType === 'USER' ? userById.get(conversation.ownerId) : partnerById.get(conversation.ownerId);
    const ownerName = owner
      ? 'fullName' in owner
        ? owner.fullName
        : owner.businessName
      : conversation.ownerType === 'USER'
        ? 'Unknown customer'
        : 'Unknown partner';
    return {
      id: conversation.id,
      owner_type: conversation.ownerType,
      owner_id: conversation.ownerId,
      owner_name: ownerName,
      owner_email: owner?.email ?? null,
      owner_phone: owner?.phone ?? null,
      assigned_admin_id: conversation.assignedAdminId,
      last_message_at: conversation.lastMessageAt.toISOString(),
      last_message_preview: conversation.lastMessagePreview,
      unread_by_admin: conversation.unreadByAdmin,
      waiting: conversation.unreadByAdmin > 0
    };
  });
}

function serializeMessage(message: {
  id: string;
  conversationId: string;
  senderType: 'USER' | 'ADMIN';
  senderId: string;
  senderName: string;
  body: string;
  createdAt: Date;
  replyTo?: { id: string; senderType: 'USER' | 'ADMIN'; senderName: string; body: string } | null;
}) {
  return {
    reply_to: message.replyTo
      ? {
          id: message.replyTo.id,
          sender_type: message.replyTo.senderType,
          sender_name: message.replyTo.senderName,
          body: message.replyTo.body.length > 200 ? `${message.replyTo.body.slice(0, 197)}...` : message.replyTo.body
        }
      : null,
    id: message.id,
    conversation_id: message.conversationId,
    sender_type: message.senderType,
    sender_id: message.senderId,
    sender_name: message.senderName,
    body: message.body,
    created_at: message.createdAt.toISOString()
  };
}

async function broadcastQueueUpdate(io: SocketIOServer) {
  const queue: QueueRow[] = await buildQueueSnapshot();
  io.to(ADMIN_ROOM).emit('chat:queue', queue);
}

/** Check whether the owner is already viewing this conversation before pushing. */
function isOwnerConnected(io: SocketIOServer, conversationId: string): boolean {
  for (const s of io.sockets.sockets.values()) {
    const data = s.data as { actor?: ChatActor; conversationId?: string };
    if (data.actor?.kind === 'owner' && data.conversationId === conversationId) return true;
  }
  return false;
}

/** Send a mobile push to customer devices; partners use web push. */
function pushChatReplyToOwner(conversation: { ownerType: OwnerKind; ownerId: string }, senderName: string, body: string) {
  if (conversation.ownerType !== 'USER') return;
  runChatTask('push chat reply', async () => {
    const tokens = await prisma.deviceToken.findMany({ where: { userId: conversation.ownerId }, select: { token: true } });
    if (tokens.length === 0) return;
    await pushToTokens(
      tokens.map((t: { token: string }) => t.token),
      senderName,
      body.length > 160 ? `${body.slice(0, 157)}...` : body,
      { type: 'chat' }
    );
  });
}

/** Send a web push to subscribed customer or partner browsers. */
function pushWebChatReplyToOwner(conversation: { ownerType: OwnerKind; ownerId: string }, body: string) {
  runChatTask('web push chat reply', async () => {
    await sendWebPushToOwner(
      { ownerType: conversation.ownerType, ownerId: conversation.ownerId },
      {
        title: conversation.ownerType === 'PARTNER' ? 'K-Tech Partner Support' : 'K-Tech Support',
        body: body.length > 120 ? `${body.slice(0, 117)}...` : body,
        // ?livechat=1 makes the widget open itself on arrival.
        url: conversation.ownerType === 'PARTNER' ? '/partner-dashboard?livechat=1' : '/dashboard?livechat=1',
        tag: 'support-chat-alert'
      }
    );
  });
}

function registerOwnerHandlers(io: SocketIOServer, socket: Socket, actor: Extract<ChatActor, { kind: 'owner' }>) {
  runChatTask('load owner history', async () => {
    const conversation = await findOrCreateOpenConversation(actor.ownerType, actor.id);
    // Cache the active conversation ID for typing and presence checks.
    (socket.data as { conversationId?: string }).conversationId = conversation.id;
    // Opening the widget IS reading whatever the admin last sent.
    if (conversation.unreadByOwner > 0) {
      await prisma.chatConversation.update({
        where: { id: conversation.id },
        data: { unreadByOwner: 0 }
      });
    }
    await socket.join(conversationRoom(conversation.id));
    const history = await loadHistory(conversation.id);
    socket.emit('chat:history', {
      conversation_id: conversation.id,
      status: conversation.status,
      messages: history.map(serializeMessage)
    });
  });

  // No payload needed beyond typing itself - the server already knows which
  // conversation this socket is in (see conversationId above). socket.to()
  // (not io.to()) excludes the sender, so an owner never sees their own
  // "typing" echoed back at them.
  socket.on('chat:typing', (payload: { typing?: unknown }) => {
    const conversationId = (socket.data as { conversationId?: string }).conversationId;
    if (!conversationId) return;
    socket.to(conversationRoom(conversationId)).emit('chat:typing', { sender_type: 'USER', typing: payload?.typing === true });
  });

  socket.on('chat:send', (payload: { body?: unknown; reply_to_id?: unknown }) => {
    const body = typeof payload?.body === 'string' ? payload.body.trim() : '';
    if (!body || body.length > 4000) return;
    const replyToRaw = typeof payload?.reply_to_id === 'string' ? payload.reply_to_id : '';

    runChatTask('send owner message', async () => {
      const conversation = await findOrCreateOpenConversation(actor.ownerType, actor.id);
      if (conversation.status === 'CLOSED') return; // Stale client; widget re-syncs on next reconnect.
      (socket.data as { conversationId?: string }).conversationId = conversation.id;

      // Only accept a reply target that lives in this same conversation.
      const replyTarget = replyToRaw
        ? await prisma.chatMessage.findFirst({ where: { id: replyToRaw, conversationId: conversation.id }, select: { id: true } })
        : null;
      const message = await prisma.chatMessage.create({
        data: {
          conversationId: conversation.id,
          senderType: 'USER',
          senderId: actor.id,
          senderName: actor.name,
          body,
          replyToId: replyTarget?.id ?? null
        },
        include: { replyTo: true }
      });
      await prisma.chatConversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: message.createdAt,
          lastMessagePreview: body.slice(0, 160),
          unreadByAdmin: { increment: 1 }
        }
      });

      io.to(conversationRoom(conversation.id)).emit('chat:message', serializeMessage(message));
      await broadcastQueueUpdate(io);
    });
  });
}

function registerAdminHandlers(io: SocketIOServer, socket: Socket, actor: Extract<ChatActor, { kind: 'admin' }>) {
  void socket.join(ADMIN_ROOM);
  runChatTask('load admin queue', async () => {
    socket.emit('chat:queue', await buildQueueSnapshot());
  });

  // Admin can have any of several conversations open, so (unlike the owner
  // side) the conversation_id has to come in the payload - same shape as
  // chat:join/chat:send below. socket.to() excludes the sender.
  socket.on('chat:typing', (payload: { conversation_id?: unknown; typing?: unknown }) => {
    const conversationId = typeof payload?.conversation_id === 'string' ? payload.conversation_id : '';
    if (!conversationId) return;
    socket.to(conversationRoom(conversationId)).emit('chat:typing', { sender_type: 'ADMIN', typing: payload?.typing === true });
  });

  socket.on('chat:join', (payload: { conversation_id?: unknown }) => {
    const conversationId = typeof payload?.conversation_id === 'string' ? payload.conversation_id : '';
    if (!conversationId) return;

    runChatTask('join admin conversation', async () => {
      const conversation = await prisma.chatConversation.findUnique({ where: { id: conversationId } });
      if (!conversation) return;

      await socket.join(conversationRoom(conversation.id));
      if (conversation.unreadByAdmin > 0 || conversation.assignedAdminId !== actor.id) {
        await prisma.chatConversation.update({
          where: { id: conversation.id },
          data: { unreadByAdmin: 0, assignedAdminId: actor.id }
        });
        await broadcastQueueUpdate(io);
      }

      const history = await loadHistory(conversation.id);
      socket.emit('chat:history', {
        conversation_id: conversation.id,
        status: conversation.status,
        messages: history.map(serializeMessage)
      });
    });
  });

  socket.on('chat:send', (payload: { conversation_id?: unknown; body?: unknown; reply_to_id?: unknown }) => {
    const conversationId = typeof payload?.conversation_id === 'string' ? payload.conversation_id : '';
    const body = typeof payload?.body === 'string' ? payload.body.trim() : '';
    if (!conversationId || !body || body.length > 4000) return;
    const replyToRaw = typeof payload?.reply_to_id === 'string' ? payload.reply_to_id : '';

    runChatTask('send admin message', async () => {
      const conversation = await prisma.chatConversation.findUnique({ where: { id: conversationId } });
      if (!conversation || conversation.status === 'CLOSED') return;

      // Only accept a reply target that lives in this same conversation.
      const replyTarget = replyToRaw
        ? await prisma.chatMessage.findFirst({ where: { id: replyToRaw, conversationId }, select: { id: true } })
        : null;
      const message = await prisma.chatMessage.create({
        data: {
          conversationId,
          senderType: 'ADMIN',
          senderId: actor.id,
          senderName: actor.name,
          body,
          replyToId: replyTarget?.id ?? null
        },
        include: { replyTo: true }
      });
      await prisma.chatConversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: message.createdAt,
          lastMessagePreview: body.slice(0, 160),
          unreadByOwner: { increment: 1 },
          unreadByAdmin: 0,
          assignedAdminId: actor.id
        }
      });

      io.to(conversationRoom(conversationId)).emit('chat:message', serializeMessage(message));
      await broadcastQueueUpdate(io);
      // Browser Web Push goes out on EVERY admin reply, not only when no
      // socket is connected: a phone browser that was just backgrounded or
      // closed keeps looking "connected" to this server for up to a minute,
      // and a reply landing in that window would otherwise be lost. The
      // service worker (web/public/sw.js) drops the notification itself when
      // the person is already looking at the site, so nobody is double-alerted.
      pushWebChatReplyToOwner(conversation, body);
      // Live in-room delivery above covers an owner actively looking at
      // this conversation; this covers the WhatsApp-style case - app
      // closed, or just not on this screen right now - where that emit
      // has nobody to land on.
      if (!isOwnerConnected(io, conversationId)) {
        pushChatReplyToOwner(conversation, actor.name, body);
      }
    });
  });

  socket.on('chat:close', (payload: { conversation_id?: unknown }) => {
    const conversationId = typeof payload?.conversation_id === 'string' ? payload.conversation_id : '';
    if (!conversationId) return;

    runChatTask('close conversation', async () => {
      const conversation = await prisma.chatConversation.updateMany({
        where: { id: conversationId, status: 'OPEN' },
        data: { status: 'CLOSED', closedAt: new Date(), unreadByAdmin: 0 }
      });
      if (conversation.count === 0) return;

      io.to(conversationRoom(conversationId)).emit('chat:closed', { conversation_id: conversationId });
      await broadcastQueueUpdate(io);
    });
  });
}

export function attachChatSocket(httpServer: HttpServer) {
  const allowedOrigins = new Set(
    env.WEB_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
  );

  const io = new SocketIOServer(httpServer, {
    // Cross-site WebSocket hijacking guard. Browsers do not apply CORS to
    // WebSocket upgrades, so a malicious page could open a socket to this
    // server from an admin's browser. The admin session cookie is now
    // SameSite=Lax (not sent on such requests), and this is the second
    // layer: a handshake that CARRIES the admin cookie must come from this
    // site's own host. Customer/partner sockets (token auth, no admin
    // cookie) are untouched.
    allowRequest: (req, callback) => {
      const cookie = req.headers.cookie ?? '';
      if (!cookie.includes(`${ADMIN_SESSION_COOKIE_NAME}=`)) return callback(null, true);
      const origin = req.headers.origin;
      if (!origin) return callback(null, true);
      try {
        const originHost = new URL(origin).host.toLowerCase();
        const ownHosts = [req.headers.host, String(req.headers['x-forwarded-host'] ?? '').split(',')[0]]
          .map((h) => (h ?? '').trim().toLowerCase())
          .filter(Boolean);
        return callback(null, ownHosts.includes(originHost));
      } catch {
        return callback(null, false);
      }
    },
    // Same-origin in production (the web build and this API are served
    // from one Express app - see app.ts) and admin connections are always
    // same-origin. `cors` only matters for a customer/partner running the
    // Vite dev server against a separately-hosted backend in local
    // development.
    cors: {
      origin(origin, callback) {
        if (!origin || allowedOrigins.size === 0 || allowedOrigins.has(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Origin is not allowed by CORS policy'));
      },
      credentials: true
    }
  });

  io.use((socket, next) => {
    const token = typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : '';

    if (token) {
      void (async () => {
        try {
          const actor = await resolveOwnerToken(token);
          if (!actor) return next(new Error('unauthorized'));
          (socket.data as { actor?: ChatActor }).actor = actor;
          next();
        } catch {
          next(new Error('unauthorized'));
        }
      })();
      return;
    }

    // No token presented - this must be the admin Live Chat page, which
    // authenticates via the AdminJS session cookie instead (see the
    // doc-comment at the top of this file).
    readAdminSession(socket, (err?: unknown) => {
      if (err) return next(new Error('unauthorized'));
      const adminSession = (
        socket.request as IncomingMessage & { session?: { adminUser?: AdminSessionUser; mfaVerifiedFor?: string } }
      ).session;
      const adminUser = adminSession?.adminUser;
      if (!adminUser) return next(new Error('unauthorized'));
      // A password-only session must not reach live chat before the second
      // factor is done (the gate in admin/mfa.ts marks the session verified).
      if (process.env.ADMIN_MFA_ENFORCED !== 'false' && adminSession?.mfaVerifiedFor !== adminUser.id) {
        return next(new Error('unauthorized'));
      }
      (socket.data as { actor?: ChatActor }).actor = {
        kind: 'admin',
        id: adminUser.id,
        name: adminUser.fullName,
        role: adminUser.role
      };
      next();
    });
  });

  io.on('connection', (socket) => {
    const actor = (socket.data as { actor?: ChatActor }).actor;
    if (!actor) {
      socket.disconnect(true);
      return;
    }
    if (actor.kind === 'owner') {
      registerOwnerHandlers(io, socket, actor);
    } else {
      registerAdminHandlers(io, socket, actor);
    }
  });

  console.log('[chat-socket] K-Tech Live Chat Socket.IO server attached');
  return io;
}
