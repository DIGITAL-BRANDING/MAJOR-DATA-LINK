import type { Request, Router } from 'express';
import type { AdminSessionUser } from './auth.js';

declare module 'express-session' {
  interface SessionData {
    adminUser?: AdminSessionUser;
  }
}

/**
 * K-Tech Live Chat - the admin side. Every customer conversation with
 * unreadByAdmin > 0 (see prisma/schema.prisma's ChatConversation) shows up
 * here as a waiting queue item; opening one clears it. All of the actual
 * real-time work (queue updates, message send/receive) happens over the
 * Socket.IO connection this page opens client-side against
 * src/realtime/chat-socket.ts - this route only serves the page shell and
 * checks the admin is signed in. The Socket.IO client library itself is
 * self-hosted: `/socket.io/socket.io.js` is served automatically by the
 * Socket.IO server attached in server.ts, no CDN or external service
 * involved.
 */
export function registerLiveChatRoutes(router: Router) {
  router.get('/live-chat', (req: Request, res) => {
    const admin = req.session?.adminUser;
    if (!admin) return res.redirect('/admin/login');
    res.type('html').send(renderPage(admin));
  });
}

function escape(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function renderPage(admin: AdminSessionUser) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Live Chat — K-Tech Solutions Admin</title>
<script src="/socket.io/socket.io.js"></script>
<style>
  :root { --gold: #D4AF37; --gold-dark: #9C7A17; --bg: #FAF7EF; --card: #FFFFFF; --text: #1A1508; --muted: #6B6248; --border: #E9E1C8; --green: #1E7B34; --red: #B3261E; }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); }
  .wrap { display: flex; height: 100vh; max-width: 1200px; margin: 0 auto; }
  .sidebar { width: 320px; flex-shrink: 0; border-right: 1px solid var(--border); display: flex; flex-direction: column; background: var(--card); }
  .sidebar header { padding: 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
  .sidebar header h1 { font-size: 16px; margin: 0; }
  .sidebar header a { color: var(--gold-dark); text-decoration: none; font-size: 12px; }
  .status-line { padding: 8px 16px; font-size: 11px; color: var(--muted); border-bottom: 1px solid var(--border); }
  .status-line.connected { color: var(--green); }
  .status-line.disconnected { color: var(--red); }
  #queue { flex: 1; overflow-y: auto; }
  .queue-item { padding: 12px 16px; border-bottom: 1px solid var(--border); cursor: pointer; }
  .queue-item:hover { background: #FFF9E8; }
  .queue-item.active { background: #FCE588; }
  .queue-item .name { font-weight: 700; font-size: 13px; display: flex; justify-content: space-between; gap: 8px; }
  .queue-item .preview { color: var(--muted); font-size: 12px; margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .queue-item .meta { color: var(--muted); font-size: 10px; margin-top: 4px; }
  .badge { background: var(--red); color: #fff; font-size: 10px; font-weight: 700; border-radius: 999px; padding: 1px 7px; }
  .tag { background: var(--gold-dark); color: #fff; font-size: 9px; font-weight: 700; border-radius: 5px; padding: 1px 5px; margin-right: 6px; vertical-align: middle; }
  .empty-queue { padding: 40px 16px; text-align: center; color: var(--muted); font-size: 13px; }
  .main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  .main header { padding: 16px; border-bottom: 1px solid var(--border); background: var(--card); display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  .main header h2 { font-size: 14px; margin: 0; }
  .main header .sub { font-size: 11px; color: var(--muted); margin-top: 2px; }
  .btn-close { border: none; background: var(--red); color: #fff; font-size: 11px; font-weight: 700; padding: 7px 12px; border-radius: 8px; cursor: pointer; }
  .btn-close:disabled { opacity: 0.4; cursor: not-allowed; }
  #messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
  .msg { max-width: 70%; padding: 9px 13px; border-radius: 12px; font-size: 13px; line-height: 1.4; }
  .msg .who { font-size: 10px; color: var(--muted); margin-bottom: 3px; }
  .msg.admin { align-self: flex-end; background: var(--gold); color: #1A1508; }
  .msg.user { align-self: flex-start; background: #fff; border: 1px solid var(--border); }
  .composer { padding: 12px 16px; border-top: 1px solid var(--border); background: var(--card); display: flex; gap: 8px; }
  .composer input { flex: 1; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; font-size: 13px; font-family: inherit; }
  .composer button { border: none; background: var(--gold-dark); color: #fff; font-weight: 700; padding: 0 18px; border-radius: 10px; cursor: pointer; font-size: 13px; }
  .composer button:disabled, .composer input:disabled { opacity: 0.5; cursor: not-allowed; }
  .placeholder { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 13px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="sidebar">
    <header>
      <h1>Live Chat</h1>
      <a href="/admin">&larr; Admin panel</a>
    </header>
    <div class="status-line disconnected" id="status">Connecting…</div>
    <div id="queue"><div class="empty-queue">Loading…</div></div>
  </div>
  <div class="main">
    <div id="placeholder" class="placeholder">Select a conversation from the queue to start replying.</div>
    <div id="conversation" style="display:none; flex-direction:column; height:100%;">
      <header>
        <div>
          <h2 id="conv-name">—</h2>
          <div class="sub" id="conv-sub">—</div>
        </div>
        <button class="btn-close" id="close-btn">Close conversation</button>
      </header>
      <div id="messages"></div>
      <form class="composer" id="composer">
        <input id="msg-input" type="text" placeholder="Type a reply…" autocomplete="off" maxlength="4000">
        <button type="submit">Send</button>
      </form>
    </div>
  </div>
</div>
<script>
(function () {
  var ADMIN_NAME = ${JSON.stringify(admin.fullName)};
  var socket = io({ withCredentials: true });
  var statusEl = document.getElementById('status');
  var queueEl = document.getElementById('queue');
  var placeholderEl = document.getElementById('placeholder');
  var conversationEl = document.getElementById('conversation');
  var messagesEl = document.getElementById('messages');
  var composerEl = document.getElementById('composer');
  var inputEl = document.getElementById('msg-input');
  var closeBtn = document.getElementById('close-btn');
  var convNameEl = document.getElementById('conv-name');
  var convSubEl = document.getElementById('conv-sub');

  var activeConversationId = null;
  var queue = [];
  var audioContext = null;

  // Browsers allow notification audio only after a real human interaction.
  // Prime Web Audio on the first click/tap/key press; the actual chime is
  // played only for a new incoming customer/partner message.
  function unlockNotificationAudio() {
    if (!audioContext) {
      var AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return;
      audioContext = new AudioCtor();
    }
    if (audioContext.state === 'suspended') audioContext.resume();
  }
  document.addEventListener('pointerdown', unlockNotificationAudio, { once: true, passive: true });
  document.addEventListener('keydown', unlockNotificationAudio, { once: true });
  function playIncomingChime() {
    if (!audioContext || audioContext.state !== 'running') return;
    var now = audioContext.currentTime;
    [0, 0.15].forEach(function (offset, index) {
      var oscillator = audioContext.createOscillator();
      var gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = index === 0 ? 740 : 988;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.12, now + offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.13);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + 0.14);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function timeLabel(iso) {
    var d = new Date(iso);
    return d.toLocaleString();
  }

  socket.on('connect', function () {
    statusEl.textContent = 'Connected';
    statusEl.className = 'status-line connected';
  });
  socket.on('disconnect', function () {
    statusEl.textContent = 'Disconnected — trying to reconnect…';
    statusEl.className = 'status-line disconnected';
  });
  socket.on('connect_error', function () {
    statusEl.textContent = 'Could not connect (sign-in may have expired — refresh the page)';
    statusEl.className = 'status-line disconnected';
  });

  socket.on('chat:queue', function (rows) {
    queue = rows;
    renderQueue();
  });

  function renderQueue() {
    if (queue.length === 0) {
      queueEl.innerHTML = '<div class="empty-queue">No open conversations right now.</div>';
      return;
    }
    queueEl.innerHTML = queue.map(function (row) {
      var active = row.id === activeConversationId ? ' active' : '';
      var badge = row.unread_by_admin > 0 ? '<span class="badge">' + row.unread_by_admin + '</span>' : '';
      var tag = row.owner_type === 'PARTNER' ? '<span class="tag">PARTNER</span>' : '';
      return '<div class="queue-item' + active + '" data-id="' + row.id + '">' +
        '<div class="name"><span>' + tag + escapeHtml(row.owner_name) + '</span>' + badge + '</div>' +
        '<div class="preview">' + escapeHtml(row.last_message_preview || '') + '</div>' +
        '<div class="meta">' + escapeHtml(row.owner_phone || row.owner_email || '') + ' · ' + timeLabel(row.last_message_at) + '</div>' +
        '</div>';
    }).join('');
    Array.prototype.forEach.call(queueEl.querySelectorAll('.queue-item'), function (el) {
      el.addEventListener('click', function () { openConversation(el.getAttribute('data-id')); });
    });
  }

  function openConversation(id) {
    activeConversationId = id;
    placeholderEl.style.display = 'none';
    conversationEl.style.display = 'flex';
    messagesEl.innerHTML = '<div class="placeholder">Loading…</div>';
    var row = queue.find(function (r) { return r.id === id; });
    if (row) {
      convNameEl.textContent = row.owner_name;
      convSubEl.textContent = row.owner_phone || row.owner_email || '';
    }
    renderQueue();
    socket.emit('chat:join', { conversation_id: id });
  }

  socket.on('chat:history', function (data) {
    if (data.conversation_id !== activeConversationId) return;
    renderMessages(data.messages);
    closeBtn.disabled = data.status === 'CLOSED';
    inputEl.disabled = data.status === 'CLOSED';
  });

  socket.on('chat:message', function (message) {
    if (message.sender_type === 'USER') {
      playIncomingChime();
    }
    if (message.conversation_id === activeConversationId) {
      appendMessage(message);
    }
  });

  socket.on('chat:closed', function (data) {
    if (data.conversation_id === activeConversationId) {
      closeBtn.disabled = true;
      inputEl.disabled = true;
    }
  });

  function renderMessages(list) {
    messagesEl.innerHTML = '';
    list.forEach(appendMessage);
  }
  function appendMessage(m) {
    var div = document.createElement('div');
    div.className = 'msg ' + (m.sender_type === 'ADMIN' ? 'admin' : 'user');
    div.innerHTML = '<div class="who">' + escapeHtml(m.sender_name) + ' · ' + timeLabel(m.created_at) + '</div>' + escapeHtml(m.body);
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  composerEl.addEventListener('submit', function (e) {
    e.preventDefault();
    var body = inputEl.value.trim();
    if (!body || !activeConversationId) return;
    socket.emit('chat:send', { conversation_id: activeConversationId, body: body });
    inputEl.value = '';
  });

  closeBtn.addEventListener('click', function () {
    if (!activeConversationId) return;
    if (!confirm('Close this conversation? The customer can still start a new one.')) return;
    socket.emit('chat:close', { conversation_id: activeConversationId });
  });
})();
</script>
</body>
</html>`;
}
