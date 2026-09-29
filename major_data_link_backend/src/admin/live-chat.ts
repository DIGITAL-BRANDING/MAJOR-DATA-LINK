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
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content">
<title>Live Chat — K-Tech Solutions Admin</title>
<script src="/socket.io/socket.io.js"></script>
<style>
  :root { --gold: #D4AF37; --gold-dark: #9C7A17; --bg: #FAF7EF; --card: #FFFFFF; --text: #1A1508; --muted: #6B6248; --border: #E9E1C8; --green: #1E7B34; --red: #B3261E; }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; overflow: hidden; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); }
  .wrap { position: fixed; top: 0; left: 0; right: 0; bottom: 0; max-width: 1400px; margin: 0 auto; display: flex; overflow: hidden; background: var(--card); }
  .sidebar { width: 380px; min-width: 0; flex-shrink: 0; border-right: 1px solid var(--border); display: flex; flex-direction: column; background: var(--card); }
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
  .notif-btn { margin: 0 16px 10px; border: 1px solid var(--border); background: var(--card); border-radius: 8px; padding: 6px 10px; font-size: 11px; cursor: pointer; color: var(--muted); }
  .notif-btn.on { border-color: var(--green); color: var(--green); }
  .notif-btn.off { display: none; }
  .main { flex: 1; display: flex; flex-direction: column; min-width: 0; background: #F3EEDD; }
  .main header { padding: 12px 16px; border-bottom: 1px solid var(--border); background: var(--card); display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  .main header h2 { font-size: 14px; margin: 0; }
  .main header .sub { font-size: 11px; color: var(--muted); margin-top: 2px; }
  .typing-row { display: none; align-items: center; gap: 4px; padding: 2px 0 6px; }
  .typing-row.show { display: flex; }
  .typing-row .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--muted); animation: typing-bounce 1.1s infinite ease-in-out; }
  .typing-row .dot:nth-child(2) { animation-delay: 0.15s; }
  .typing-row .dot:nth-child(3) { animation-delay: 0.3s; }
  @keyframes typing-bounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.5; } 30% { transform: translateY(-3px); opacity: 1; } }
  .btn-close { border: none; background: var(--red); color: #fff; font-size: 11px; font-weight: 700; padding: 7px 12px; border-radius: 8px; cursor: pointer; }
  .btn-close:disabled { opacity: 0.4; cursor: not-allowed; }
  #messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
  .msg { max-width: 70%; padding: 9px 13px; border-radius: 12px; font-size: 13px; line-height: 1.4; overflow-wrap: anywhere; word-break: break-word; }
  .msg .who { font-size: 10px; color: var(--muted); margin-bottom: 3px; }
  .msg.admin { align-self: flex-end; background: var(--gold); color: #1A1508; }
  .msg.user { align-self: flex-start; background: #fff; border: 1px solid var(--border); }
  .composer { align-items: center; padding: 10px 12px; padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px)); border-top: 1px solid var(--border); background: var(--card); display: flex; gap: 8px; }
  .composer input { flex: 1; min-width: 0; padding: 12px 16px; border: 1px solid var(--border); border-radius: 24px; font-size: 16px; font-family: inherit; }
  .composer button { border: none; background: var(--gold-dark); color: #fff; font-weight: 700; height: 44px; padding: 0 20px; border-radius: 22px; cursor: pointer; font-size: 14px; flex-shrink: 0; }
  .composer button:disabled, .composer input:disabled { opacity: 0.5; cursor: not-allowed; }
  .placeholder { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 13px; }
  .back-btn { display: none; border: none; background: none; color: var(--text); font-size: 26px; line-height: 1; padding: 4px 8px 4px 0; cursor: pointer; }
  .main header .head-text { flex: 1; min-width: 0; }
  .main header h2, .main header .sub { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #conversation { min-height: 0; }
  #messages { min-height: 0; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
  /* ---- WhatsApp look ---- */
  :root { --wa-green: #00A884; --wa-header: #F0F2F5; --wa-out: #D9FDD3; --wa-bg: #EFEAE2; --wa-text2: #667781; --wa-line: #E9EDEF; }
  .sidebar { background: #fff; border-right-color: var(--wa-line); }
  .sidebar header, .main header { background: var(--wa-header); border-bottom: none; }
  .sidebar header h1 { font-size: 19px; }
  .sidebar header a { color: var(--wa-green); font-weight: 600; }
  .status-line { border-bottom-color: var(--wa-line); }
  .status-line.connected { color: var(--wa-green); }
  .queue-item { display: flex; gap: 12px; align-items: center; padding: 10px 16px; border-bottom: none; position: relative; }
  .queue-item::after { content: ''; position: absolute; left: 72px; right: 0; bottom: 0; border-bottom: 1px solid var(--wa-line); }
  .queue-item:hover { background: #F5F6F6; }
  .queue-item.active { background: #F0F2F5; }
  .avatar { width: 46px; height: 46px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 16px; background: #6B7C85; text-transform: uppercase; }
  .avatar.partner { background: var(--gold-dark); }
  .avatar.sm { width: 40px; height: 40px; font-size: 14px; }
  .qbody { flex: 1; min-width: 0; padding: 4px 0; }
  .qtop, .qbottom { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .qname { font-size: 16px; color: #111B21; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
  .qtime { font-size: 12px; color: var(--wa-text2); flex-shrink: 0; }
  .qtime.unread { color: var(--wa-green); font-weight: 600; }
  .queue-item .preview { font-size: 14px; color: var(--wa-text2); margin-top: 2px; flex: 1; min-width: 0; }
  .badge { background: var(--wa-green); min-width: 20px; height: 20px; padding: 0 6px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; margin-top: 2px; }
  .tag { background: var(--gold-dark); margin: 0 6px 0 0; }
  .main { background-color: var(--wa-bg); background-image: radial-gradient(rgba(11,20,26,0.06) 1.2px, transparent 1.2px); background-size: 20px 20px; }
  .main header h2 { font-size: 16px; font-weight: 500; color: #111B21; }
  .main header .sub { font-size: 13px; color: var(--wa-text2); }
  .btn-close { background: transparent; color: #B3261E; border: 1px solid #E5B4B0; font-weight: 600; }
  #messages { gap: 2px; padding: 16px 7%; }
  .msg { position: relative; max-width: 65%; padding: 6px 8px 6px 9px; border-radius: 8px; font-size: 14.2px; line-height: 1.35; border: none !important; box-shadow: 0 1px 0.5px rgba(11,20,26,0.13); white-space: pre-wrap; margin-top: 6px; }
  .msg.user { background: #fff; border-top-left-radius: 0; }
  .msg.admin { background: var(--wa-out); color: #111B21; border-top-right-radius: 0; }
  .msg.user::before, .msg.admin::before { content: ''; position: absolute; top: 0; width: 8px; height: 13px; }
  .msg.user::before { left: -8px; background: #fff; clip-path: polygon(100% 0, 0 0, 100% 100%); }
  .msg.admin::before { right: -8px; background: var(--wa-out); clip-path: polygon(0 0, 100% 0, 0 100%); }
  .msg.cont { margin-top: 0; }
  .msg.cont::before { display: none; }
  .msg.user.cont { border-top-left-radius: 8px; }
  .msg.admin.cont { border-top-right-radius: 8px; }
  .msg .who { font-size: 12.5px; font-weight: 600; color: var(--wa-green); margin-bottom: 2px; }
  .msg.admin .who { display: none; }
  .msg .time { float: right; font-size: 11px; color: var(--wa-text2); margin: 6px 0 -4px 12px; line-height: 1; white-space: nowrap; }
  .msg .body { display: inline; }
  .day-chip { align-self: center; background: #fff; color: var(--wa-text2); font-size: 12px; padding: 5px 12px; border-radius: 8px; margin: 10px 0 6px; box-shadow: 0 1px 0.5px rgba(11,20,26,0.13); }
  .typing-row { background: #fff; align-self: flex-start; margin: 0 7% 8px; padding: 9px 12px; border-radius: 8px; box-shadow: 0 1px 0.5px rgba(11,20,26,0.13); width: fit-content; }
  .composer { background: var(--wa-header); border-top: none; }
  .composer input { border: none; background: #fff; }
  .composer button { background: var(--wa-green); width: 44px; padding: 0; display: flex; align-items: center; justify-content: center; }
  .composer button svg { width: 22px; height: 22px; fill: #fff; }
  .notif-btn.on { border-color: var(--wa-green); color: var(--wa-green); }
  /* ---- Reply (swipe) ---- */
  .msg { touch-action: pan-y; transition: transform 0.18s ease; will-change: transform; }
  .msg.dragging { transition: none; user-select: none; -webkit-user-select: none; }
  .msg .swipe-ico { position: absolute; top: 50%; width: 30px; height: 30px; margin-top: -15px; border-radius: 50%; background: rgba(11,20,26,0.12); color: #fff; display: flex; align-items: center; justify-content: center; opacity: 0; font-size: 16px; pointer-events: none; }
  .msg.user .swipe-ico { left: -44px; } .msg.admin .swipe-ico { right: -44px; }
  .msg.armed .swipe-ico { background: var(--wa-green); }
  .msg .quote { border-left: 4px solid var(--wa-green); background: rgba(11,20,26,0.06); border-radius: 6px; padding: 5px 8px; margin: 0 0 5px; cursor: pointer; overflow: hidden; }
  .msg.admin .quote { border-left-color: #06CF9C; background: rgba(11,20,26,0.07); }
  .msg .quote .qn { font-size: 12.5px; font-weight: 600; color: var(--wa-green); }
  .msg .quote .qt { font-size: 13px; color: var(--wa-text2); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
  .msg.flash { animation: msg-flash 1.2s ease; }
  @keyframes msg-flash { 0%, 60% { box-shadow: 0 0 0 100vmax rgba(0,168,132,0.18) inset; } 100% { box-shadow: 0 1px 0.5px rgba(11,20,26,0.13); } }
  .msg .reply-btn { display: none; position: absolute; top: 2px; right: 4px; border: none; background: rgba(255,255,255,0.85); border-radius: 50%; width: 22px; height: 22px; font-size: 13px; line-height: 1; cursor: pointer; color: var(--wa-text2); }
  @media (hover: hover) { .msg:hover .reply-btn { display: block; } }
  .reply-bar { display: none; align-items: center; gap: 10px; background: var(--wa-header); padding: 8px 12px 0; }
  .reply-bar.show { display: flex; }
  .reply-bar .rb { flex: 1; min-width: 0; background: #fff; border-left: 4px solid var(--wa-green); border-radius: 8px; padding: 6px 10px; }
  .reply-bar .rn { font-size: 12.5px; font-weight: 600; color: var(--wa-green); }
  .reply-bar .rt { font-size: 13px; color: var(--wa-text2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .reply-bar .rx { border: none; background: none; font-size: 20px; color: var(--wa-text2); cursor: pointer; padding: 4px 8px; }
  @media (max-width: 768px) {
    .sidebar { width: 100%; border-right: none; padding-top: env(safe-area-inset-top, 0px); }
    .main { position: absolute; top: 0; right: 0; bottom: 0; left: 0; z-index: 5; transform: translateX(100%); transition: transform 0.25s ease; visibility: hidden; }
    .wrap.chat-open .main { transform: translateX(0); visibility: visible; }
    .back-btn { display: block; }
    .main header { padding-top: calc(10px + env(safe-area-inset-top, 0px)); }
    .placeholder { display: none !important; }
    #messages { padding: 10px 12px; }
    .msg { max-width: 85%; }
    .typing-row { margin: 0 12px 8px; }
    .queue-item::after { left: 70px; }
    .queue-item { padding: 14px 16px; }
    .btn-close { padding: 8px 10px; }
  }
</style>
</head>
<body>
<div class="wrap" id="wrap">
  <div class="sidebar">
    <header>
      <h1>Live Chat</h1>
      <a href="/admin">&larr; Admin panel</a>
    </header>
    <button type="button" id="notif-btn" class="notif-btn">Enable desktop alerts</button>
    <div class="status-line disconnected" id="status">Connecting…</div>
    <div id="queue"><div class="empty-queue">Loading…</div></div>
  </div>
  <div class="main">
    <div id="placeholder" class="placeholder">Select a conversation from the queue to start replying.</div>
    <div id="conversation" style="display:none; flex-direction:column; flex:1; min-height:0;">
      <header>
        <button type="button" class="back-btn" id="back-btn" aria-label="Back to conversations">&larr;</button>
        <div class="avatar sm" id="conv-avatar">?</div>
        <div class="head-text">
          <h2 id="conv-name">—</h2>
          <div class="sub" id="conv-sub">—</div>
        </div>
        <button class="btn-close" id="close-btn">Close conversation</button>
      </header>
      <div id="messages"></div>
      <div class="typing-row" id="typing-row"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>
      <div class="reply-bar" id="reply-bar"><div class="rb"><div class="rn" id="reply-name"></div><div class="rt" id="reply-text"></div></div><button type="button" class="rx" id="reply-x" aria-label="Cancel reply">&times;</button></div>
      <form class="composer" id="composer">
        <input id="msg-input" type="text" placeholder="Type a reply…" autocomplete="off" maxlength="4000">
        <button type="submit" aria-label="Send"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.4 20.4l17.45-7.48a1 1 0 000-1.84L3.4 3.6a.993.993 0 00-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z"/></svg></button>
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
  var notifBtn = document.getElementById('notif-btn');
  var typingRowEl = document.getElementById('typing-row');
  var wrapEl = document.getElementById('wrap');
  // Some mobile browsers report 100vh/100dvh larger than the visible area
  // (URL bar / keyboard), which pushed the composer off-screen. innerHeight
  // is always the truly visible height, so pin the shell to it.
  function fitHeight() { wrapEl.style.height = window.innerHeight + 'px'; }
  fitHeight();
  window.addEventListener('resize', fitHeight);
  window.addEventListener('orientationchange', function () { setTimeout(fitHeight, 250); });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fitHeight);
  var replyBarEl = document.getElementById('reply-bar');
  var replyNameEl = document.getElementById('reply-name');
  var replyTextEl = document.getElementById('reply-text');
  var replyTo = null;
  var msgIndex = {};
  var backBtn = document.getElementById('back-btn');

  var activeConversationId = null;
  var queue = [];
  var isTyping = false;
  var typingIdleTimer = null;
  var customerTypingClearTimer = null;
  var audioContext = null;
  var lastTotalUnread = null;
  var ORIGINAL_TITLE = document.title;
  var titleFlashTimer = null;
  var titleFlashOn = false;

  // Desktop alert for a new (or newly-unassigned) customer/partner message,
  // on top of the in-tab chime below. The chime only ever plays for whichever
  // conversation is currently joined (Socket.IO only delivers 'chat:message'
  // for rooms this socket has joined) - it can't tell an admin about a
  // DIFFERENT customer messaging in while they're mid-reply elsewhere.
  // 'chat:queue' is broadcast to every connected admin whenever any
  // conversation's unread count changes, so the total across it is the right
  // signal for "does anything, anywhere, need attention right now".
  function updateNotifBtn() {
    if (!('Notification' in window)) { notifBtn.classList.add('off'); return; }
    if (Notification.permission === 'granted') { notifBtn.textContent = 'Desktop alerts on'; notifBtn.classList.add('on'); }
    else { notifBtn.textContent = 'Enable desktop alerts'; notifBtn.classList.remove('on'); }
  }
  notifBtn.addEventListener('click', function () {
    if (!('Notification' in window)) return;
    Notification.requestPermission().then(updateNotifBtn);
  });
  updateNotifBtn();

  function startTitleFlash() {
    if (titleFlashTimer) return;
    titleFlashTimer = setInterval(function () {
      titleFlashOn = !titleFlashOn;
      document.title = titleFlashOn ? '🔴 New message — Live Chat' : ORIGINAL_TITLE;
    }, 1200);
  }
  function stopTitleFlash() {
    if (titleFlashTimer) { clearInterval(titleFlashTimer); titleFlashTimer = null; }
    document.title = ORIGINAL_TITLE;
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) stopTitleFlash(); });
  window.addEventListener('focus', stopTitleFlash);

  function fireDesktopAlert(totalUnread) {
    if (document.hidden) startTitleFlash();
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      var n = new Notification('New support message', {
        body: totalUnread === 1 ? 'A customer sent a new message.' : totalUnread + ' conversations are waiting for a reply.',
        tag: 'live-chat-alert'
      });
      n.onclick = function () { window.focus(); n.close(); };
    } catch (e) {
      // Some browsers can still throw even when permission reads "granted"
      // (focus/user-activation quirks) - the title flash above already
      // covers the alert either way.
    }
  }

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
  function initials(name) {
    var parts = String(name || '?').trim().split(/\\s+/);
    return (parts[0].charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : '')) || '?';
  }
  function hm(d) { return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  function sameDay(a, b) { return a.toDateString() === b.toDateString(); }
  function shortTime(iso) {
    if (!iso) return '';
    var d = new Date(iso), now = new Date();
    if (sameDay(d, now)) return hm(d);
    var y = new Date(now.getTime() - 86400000);
    if (sameDay(d, y)) return 'Yesterday';
    return d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' });
  }
  function dayLabel(d) {
    var now = new Date();
    if (sameDay(d, now)) return 'Today';
    if (sameDay(d, new Date(now.getTime() - 86400000))) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  var lastMsgDate = null, lastMsgSender = null;

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
    var totalUnread = queue.reduce(function (sum, row) { return sum + (row.unread_by_admin || 0); }, 0);
    if (lastTotalUnread !== null && totalUnread > lastTotalUnread) fireDesktopAlert(totalUnread);
    lastTotalUnread = totalUnread;
    renderQueue();
  });

  function renderQueue() {
    if (queue.length === 0) {
      queueEl.innerHTML = '<div class="empty-queue">No open conversations right now.</div>';
      return;
    }
    queueEl.innerHTML = queue.map(function (row) {
      var active = row.id === activeConversationId ? ' active' : '';
      var unread = row.unread_by_admin > 0;
      var badge = unread ? '<span class="badge">' + row.unread_by_admin + '</span>' : '';
      var tag = row.owner_type === 'PARTNER' ? '<span class="tag">PARTNER</span>' : '';
      var av = '<div class="avatar' + (row.owner_type === 'PARTNER' ? ' partner' : '') + '">' + escapeHtml(initials(row.owner_name)) + '</div>';
      return '<div class="queue-item' + active + '" data-id="' + row.id + '">' + av +
        '<div class="qbody">' +
          '<div class="qtop"><span class="qname">' + tag + escapeHtml(row.owner_name) + '</span><span class="qtime' + (unread ? ' unread' : '') + '">' + shortTime(row.last_message_at) + '</span></div>' +
          '<div class="qbottom"><span class="preview">' + escapeHtml(row.last_message_preview || '') + '</span>' + badge + '</div>' +
        '</div></div>';
    }).join('');
    Array.prototype.forEach.call(queueEl.querySelectorAll('.queue-item'), function (el) {
      el.addEventListener('click', function () { openConversation(el.getAttribute('data-id')); });
    });
  }

  function openConversation(id) {
    stopTyping();
    clearReply();
    activeConversationId = id;
    typingRowEl.classList.remove('show');
    clearTimeout(customerTypingClearTimer);
    placeholderEl.style.display = 'none';
    conversationEl.style.display = 'flex';
    messagesEl.innerHTML = '<div class="placeholder">Loading…</div>';
    var row = queue.find(function (r) { return r.id === id; });
    if (row) {
      convNameEl.textContent = row.owner_name;
      convSubEl.textContent = row.owner_phone || row.owner_email || '';
      document.getElementById('conv-avatar').textContent = initials(row.owner_name);
    }
    renderQueue();
    wrapEl.classList.add('chat-open');
    if (history.state !== 'chat') history.pushState('chat', '');
    socket.emit('chat:join', { conversation_id: id });
  }
  backBtn.addEventListener('click', function () {
    if (history.state === 'chat') history.back(); else wrapEl.classList.remove('chat-open');
  });
  window.addEventListener('popstate', function () { wrapEl.classList.remove('chat-open'); });

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

  // Admin's chat:typing only ever arrives for a conversation this socket
  // has joined (see chat:join above), which is always activeConversationId
  // by the time we're here - no need to carry conversation_id in the
  // payload the way the owner-side sender does. A lost "stop" (dropped
  // tab, closed app) can't leave this stuck forever either way, thanks to
  // the 6s safety-net clear below.
  socket.on('chat:typing', function (data) {
    if (data.sender_type !== 'USER') return;
    clearTimeout(customerTypingClearTimer);
    typingRowEl.classList.toggle('show', !!data.typing);
    if (data.typing) {
      customerTypingClearTimer = setTimeout(function () { typingRowEl.classList.remove('show'); }, 6000);
    }
  });

  function setReply(m) {
    replyTo = { id: m.id, name: m.side === 'admin' ? 'You' : m.name, body: m.body };
    replyNameEl.textContent = replyTo.name;
    replyTextEl.textContent = replyTo.body;
    replyBarEl.classList.add('show');
    inputEl.focus();
  }
  function clearReply() {
    replyTo = null;
    replyBarEl.classList.remove('show');
  }
  document.getElementById('reply-x').addEventListener('click', clearReply);

  function jumpTo(id) {
    var el = messagesEl.querySelector('[data-id="' + id + '"]');
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }

  // Swipe a bubble left OR right (or use the hover button on desktop) to reply.
  function attachSwipe(el, id) {
    var startX = 0, startY = 0, dx = 0, tracking = false, dragging = false, armed = false, pid = null;
    var ico = el.querySelector('.swipe-ico');
    var THRESH = 56, MAX = 80;
    el.addEventListener('pointerdown', function (e) {
      if (e.target.closest && e.target.closest('.quote, .reply-btn')) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      tracking = true; dragging = false; armed = false; dx = 0;
      startX = e.clientX; startY = e.clientY; pid = e.pointerId;
    });
    el.addEventListener('pointermove', function (e) {
      if (!tracking || e.pointerId !== pid) return;
      var mx = e.clientX - startX, my = e.clientY - startY;
      if (!dragging) {
        if (Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) * 1.4) {
          dragging = true;
          el.classList.add('dragging');
          try { el.setPointerCapture(pid); } catch (err) {}
        } else if (Math.abs(my) > 10) { tracking = false; return; }
        else return;
      }
      dx = Math.max(-MAX, Math.min(MAX, mx));
      el.style.transform = 'translateX(' + dx + 'px)';
      if (ico) ico.style.opacity = String(Math.min(1, Math.abs(dx) / THRESH));
      var nowArmed = Math.abs(dx) >= THRESH;
      if (nowArmed && !armed && navigator.vibrate) { try { navigator.vibrate(12); } catch (err) {} }
      armed = nowArmed;
      el.classList.toggle('armed', armed);
    });
    function end(e) {
      if (!tracking) return;
      tracking = false;
      if (dragging) {
        try { el.releasePointerCapture(pid); } catch (err) {}
        el.classList.remove('dragging', 'armed');
        el.style.transform = '';
        if (ico) ico.style.opacity = '0';
        if (armed && e.type !== 'pointercancel' && msgIndex[id]) setReply(msgIndex[id]);
      }
      dragging = false; armed = false;
    }
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    var btn = el.querySelector('.reply-btn');
    if (btn) btn.addEventListener('click', function () { if (msgIndex[id]) setReply(msgIndex[id]); });
  }

  function renderMessages(list) {
    messagesEl.innerHTML = '';
    msgIndex = {};
    lastMsgDate = null; lastMsgSender = null;
    list.forEach(appendMessage);
  }
  function appendMessage(m) {
    var d = new Date(m.created_at);
    if (!lastMsgDate || !sameDay(lastMsgDate, d)) {
      var chip = document.createElement('div');
      chip.className = 'day-chip';
      chip.textContent = dayLabel(d);
      messagesEl.appendChild(chip);
      lastMsgSender = null;
    }
    var side = m.sender_type === 'ADMIN' ? 'admin' : 'user';
    var div = document.createElement('div');
    div.className = 'msg ' + side + (lastMsgSender === side ? ' cont' : '');
    div.setAttribute('data-id', m.id);
    msgIndex[m.id] = { id: m.id, side: side, name: m.sender_name, body: m.body };
    var who = side === 'user' && lastMsgSender !== side ? '<div class="who">' + escapeHtml(m.sender_name) + '</div>' : '';
    var quote = '';
    if (m.reply_to) {
      quote = '<div class="quote" data-jump="' + escapeHtml(m.reply_to.id) + '"><div class="qn">' +
        escapeHtml(m.reply_to.sender_type === 'ADMIN' ? 'You' : m.reply_to.sender_name) + '</div><div class="qt">' +
        escapeHtml(m.reply_to.body) + '</div></div>';
    }
    div.innerHTML = '<span class="swipe-ico">&#8617;</span><button type="button" class="reply-btn" title="Reply" aria-label="Reply">&#8617;</button>' +
      who + quote + '<span class="body">' + escapeHtml(m.body) + '</span><span class="time">' + hm(d) + '</span>';
    var q = div.querySelector('.quote');
    if (q) q.addEventListener('click', function () { jumpTo(q.getAttribute('data-jump')); });
    attachSwipe(div, m.id);
    messagesEl.appendChild(div);
    lastMsgDate = d; lastMsgSender = side;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function stopTyping() {
    clearTimeout(typingIdleTimer);
    if (isTyping && activeConversationId) {
      isTyping = false;
      socket.emit('chat:typing', { conversation_id: activeConversationId, typing: false });
    }
  }

  inputEl.addEventListener('input', function () {
    if (!activeConversationId) return;
    if (!isTyping) {
      isTyping = true;
      socket.emit('chat:typing', { conversation_id: activeConversationId, typing: true });
    }
    clearTimeout(typingIdleTimer);
    typingIdleTimer = setTimeout(stopTyping, 2000);
  });

  composerEl.addEventListener('submit', function (e) {
    e.preventDefault();
    var body = inputEl.value.trim();
    if (!body || !activeConversationId) return;
    stopTyping();
    socket.emit('chat:send', { conversation_id: activeConversationId, body: body, reply_to_id: replyTo ? replyTo.id : undefined });
    inputEl.value = '';
    clearReply();
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
