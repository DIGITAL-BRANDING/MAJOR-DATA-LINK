import type { Server as HttpServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import session from 'express-session';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { verifyAuthToken } from '../lib/auth-token.js';
import { adminSessionStore, ADMIN_SESSION_COOKIE_NAME } from '../admin/setup.js';
import type { AdminSessionUser } from '../admin/auth.js';

/**
 * K-Tech Live Chat - a self-hosted replacement for the Tawk.to widget
 * (removed from web/index.html, web/public/tawk-widget.js and the AdminJS
 * asset list; see admin/setup.ts). No third-party chat service is involved
 * at any point - this process IS the chat server, and the browser client
 * talks to it over Socket.IO served from this same origin
 * (`/socket.io/socket.io.js`, auto-served by the library below).
 *
 * Three kinds of client connect to the one Socket.IO server created here:
 *
 *  - Customers, from web/src/components/ChatWidget.tsx. Authenticated with
 *    the same access token every customer REST call uses (web/src/lib/api.ts,
 *    `mdl_access_token`), passed as `socket.handshake.auth.token`.
 *
 *  - Partners, from web/src/components/PartnerChatWidget.tsx (mounted
 *    inside PartnerDashboardPage). Authenticated with THAT portal's own,
 *    separate access token (`mdl_partner_portal_access_token`) - a
 *    completely different account type from a customer, same as
 *    requirePartnerSession vs requireAuth on the REST side. Also passed as
 *    `socket.handshake.auth.token`; see resolveOwnerToken() below for how a
 *    bare token is matched against the User table first, then Partner.
 *
 *  - Admins, from the server-rendered /admin/live-chat page (see
 *    ./live-chat.ts). That page never holds a JWT - AdminJS's own login is
 *    a plain express-session cookie (`imam_admin_sid`). Rather than invent
 *    a second admin credential just for chat, we decode that exact same
 *    cookie here via a second express-session middleware instance pointed
 *    at the identical Postgres-backed store (see admin/setup.ts's exported
 *    adminSessionStore) - same session id in, same session data out.
 *
 * One open ChatConversation per owner (customer or partner - see
 * prisma/schema.prisma's ownerType) is the whole "offline queue": whenever
 * unreadByAdmin > 0 on an OPEN conversation, it's waiting for an admin, and
 * the Live Chat page's queue list is nothing more than that same query,
 * live-updated over the 'chat-admins' room broadcast below.
 */

type OwnerKind = 'USER' | 'PARTNER';

type ChatActor =
  | { kind: 'owner'; ownerType: OwnerKind; id: string; name: string }
  | { kind: 'admin'; id: string; name: string; role: AdminSessionUser['role'] };

type ExpressStyleNext = (err?: unknown) => void;

// Wraps a plain Express middleware (which expects (req, res, next)) so it
// can run against a raw Socket.IO handshake - socket.request IS a real
// node http.IncomingMessage, so express-session works against it
// unmodified. `{}` stands in for the `res` parameter: express-session only
// ever calls a handful of response methods (Set-Cookie, mostly) which we
// don't need here since we're only ever READING an existing session, never
// issuing a new admin login cookie over the socket.
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

/**
 * A bare access token's payload (`{ sub, email, ... }`) doesn't say which
 * table it belongs to - User and Partner tokens are signed with the exact
 * same createAuthToken/verifyAuthToken primitives (see lib/auth-token.ts).
 * We resolve it the same way the two REST middlewares do it separately
 * (requireAuth vs requirePartnerSession): try User first, fall back to
 * Partner. id collisions between the two tables are not a concern - each
 * mints its own uuid()/nanoid() ids from an effectively disjoint space.
 */
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
    take: MESSAGE_HISTORY_LIMIT
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
}) {
  return {
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

function registerOwnerHandlers(io: SocketIOServer, socket: Socket, actor: Extract<ChatActor, { kind: 'owner' }>) {
  void (async () => {
    const conversation = await findOrCreateOpenConversation(actor.ownerType, actor.id);
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
  })();

  socket.on('chat:send', (payload: { body?: unknown }) => {
    const body = typeof payload?.body === 'string' ? payload.body.trim() : '';
    if (!body || body.length > 4000) return;

    void (async () => {
      const conversation = await findOrCreateOpenConversation(actor.ownerType, actor.id);
      if (conversation.status === 'CLOSED') return; // Stale client; widget re-syncs on next reconnect.

      const message = await prisma.chatMessage.create({
        data: {
          conversationId: conversation.id,
          senderType: 'USER',
          senderId: actor.id,
          senderName: actor.name,
          body
        }
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
    })();
  });
}

function registerAdminHandlers(io: SocketIOServer, socket: Socket, actor: Extract<ChatActor, { kind: 'admin' }>) {
  void socket.join(ADMIN_ROOM);
  void (async () => {
    socket.emit('chat:queue', await buildQueueSnapshot());
  })();

  socket.on('chat:join', (payload: { conversation_id?: unknown }) => {
    const conversationId = typeof payload?.conversation_id === 'string' ? payload.conversation_id : '';
    if (!conversationId) return;

    void (async () => {
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
    })();
  });

  socket.on('chat:send', (payload: { conversation_id?: unknown; body?: unknown }) => {
    const conversationId = typeof payload?.conversation_id === 'string' ? payload.conversation_id : '';
    const body = typeof payload?.body === 'string' ? payload.body.trim() : '';
    if (!conversationId || !body || body.length > 4000) return;

    void (async () => {
      const conversation = await prisma.chatConversation.findUnique({ where: { id: conversationId } });
      if (!conversation || conversation.status === 'CLOSED') return;

      const message = await prisma.chatMessage.create({
        data: {
          conversationId,
          senderType: 'ADMIN',
          senderId: actor.id,
          senderName: actor.name,
          body
        }
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
    })();
  });

  socket.on('chat:close', (payload: { conversation_id?: unknown }) => {
    const conversationId = typeof payload?.conversation_id === 'string' ? payload.conversation_id : '';
    if (!conversationId) return;

    void (async () => {
      const conversation = await prisma.chatConversation.updateMany({
        where: { id: conversationId, status: 'OPEN' },
        data: { status: 'CLOSED', closedAt: new Date(), unreadByAdmin: 0 }
      });
      if (conversation.count === 0) return;

      io.to(conversationRoom(conversationId)).emit('chat:closed', { conversation_id: conversationId });
      await broadcastQueueUpdate(io);
    })();
  });
}

export function attachChatSocket(httpServer: HttpServer) {
  const allowedOrigins = new Set(
    env.WEB_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
  );

  const io = new SocketIOServer(httpServer, {
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
      const adminUser = (socket.request as IncomingMessage & { session?: { adminUser?: AdminSessionUser } }).session
        ?.adminUser;
      if (!adminUser) return next(new Error('unauthorized'));
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
