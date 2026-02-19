require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
const { Server } = require('socket.io');

const app = express();
const rawOrigins = (process.env.CORS_ORIGIN || '*').split(',').map((s) => s.trim());
const corsOrigin = rawOrigins.length === 1 && rawOrigins[0] === '*' ? '*' : rawOrigins;
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());

app.use(express.static(path.join(__dirname, '..', 'web', 'dist')));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

const rooms = new Map(); // roomId → room

/* ─── Password helpers ─── */
function hashPassword(pw) {
  if (!pw) return null;
  return crypto.createHash('sha256').update(pw).digest('hex');
}

/* ─── SoundCloud client_id resolver ─── */
let resolvedClientId = null;
let resolveInProgress = null;

async function getPublicClientId() {
  if (resolvedClientId) return resolvedClientId;
  if (resolveInProgress) return resolveInProgress;

  resolveInProgress = (async () => {
    try {
      const page = await axios.get('https://soundcloud.com', {
        headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000
      });
      const scriptUrls = page.data.match(/https:\/\/a-v2\.sndcdn\.com\/assets\/[^\s"]+\.js/g);
      if (!scriptUrls) return null;

      for (let i = scriptUrls.length - 1; i >= Math.max(0, scriptUrls.length - 5); i--) {
        const bundle = await axios.get(scriptUrls[i], {
          headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000
        });
        const match = bundle.data.match(/client_id:"([a-zA-Z0-9]{32})"/);
        if (match) {
          resolvedClientId = match[1];
          console.log('Resolved SoundCloud client_id');
          return resolvedClientId;
        }
      }
      return null;
    } catch (err) {
      console.error('Failed to resolve SoundCloud client_id:', err.message);
      return null;
    } finally {
      resolveInProgress = null;
    }
  })();

  return resolveInProgress;
}

/* ─── Room helpers ─── */
function makeRoom(roomId, name, passwordHash, hostId) {
  return {
    roomId,
    name: name || roomId,
    passwordHash: passwordHash || null,      // SHA-256 hash, null = no password
    hostId,
    users: new Map(),                        // socketId → { name }
    queue: [],
    chat: [],
    settings: {
      allowMemberControl: true               // all members can play/pause/skip by default
    },
    playback: {
      trackId: null,
      state: 'paused',
      positionMs: 0,
      updatedAt: Date.now()
    }
  };
}

function serializeRoom(room) {
  return {
    roomId: room.roomId,
    name: room.name,
    hostId: room.hostId,
    hasPassword: !!room.passwordHash,
    settings: room.settings,
    users: Array.from(room.users.entries()).map(([socketId, u]) => ({ socketId, ...u })),
    queue: room.queue,
    chat: room.chat,
    playback: room.playback
  };
}

function publicRoomList() {
  return Array.from(rooms.values()).map((r) => ({
    roomId: r.roomId,
    name: r.name,
    userCount: r.users.size,
    hasPassword: !!r.passwordHash,
    allowMemberControl: r.settings.allowMemberControl
  }));
}

/* ─── Input helpers ─── */
function sanitize(str, max = 200) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, max);
}
function validId(str) {
  return typeof str === 'string' && str.trim().length > 0 && str.trim().length <= 100;
}

/* ─── Permissions helper ─── */
function canControl(room, socketId) {
  return room.hostId === socketId || room.settings.allowMemberControl;
}

/* ─── REST endpoints ─── */

app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size, ts: Date.now() }));

// Public room list
app.get('/api/rooms', (_req, res) => res.json({ rooms: publicRoomList() }));

// SoundCloud search
app.get('/api/search', async (req, res) => {
  const q = sanitize(req.query.q);
  if (!q) return res.status(400).json({ error: 'Missing query' });

  const clientId = await getPublicClientId();
  if (!clientId) return res.status(503).json({ error: 'SoundCloud unavailable, try again.' });

  try {
    const { data } = await axios.get('https://api-v2.soundcloud.com/search/tracks', {
      params: { q, client_id: clientId, limit: 20 },
      headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000
    });
    const tracks = (data.collection || []).map((t) => ({
      provider: 'soundcloud',
      trackId: String(t.id),
      title: t.title,
      artworkUrl: t.artwork_url,
      durationMs: t.duration,
      permalinkUrl: t.permalink_url,
      user: t.user?.username || 'Unknown'
    }));
    return res.json({ tracks });
  } catch (err) {
    if (err.response?.status === 401 || err.response?.status === 403) resolvedClientId = null;
    return res.status(500).json({ error: 'Search failed', detail: err.message });
  }
});

// SoundCloud track resolve
app.get('/api/resolve/:trackId', async (req, res) => {
  const trackId = sanitize(req.params.trackId, 50);
  if (!trackId) return res.status(400).json({ error: 'Invalid trackId' });
  const clientId = await getPublicClientId();
  if (!clientId) return res.status(503).json({ error: 'SoundCloud unavailable.' });
  try {
    const { data } = await axios.get(`https://api-v2.soundcloud.com/tracks/${trackId}`, {
      params: { client_id: clientId }, headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000
    });
    return res.json({
      trackId: String(data.id), title: data.title,
      permalinkUrl: data.permalink_url, artworkUrl: data.artwork_url,
      durationMs: data.duration, user: data.user?.username || 'Unknown'
    });
  } catch (err) {
    return res.status(500).json({ error: 'Resolve failed', detail: err.message });
  }
});

/* ─── Chat rate limiter ─── */
const chatRateLimits = new Map();
function checkChatRate(socketId) {
  const now = Date.now();
  const e = chatRateLimits.get(socketId) || { count: 0, resetAt: now + 3000 };
  if (now > e.resetAt) { e.count = 0; e.resetAt = now + 3000; }
  e.count++;
  chatRateLimits.set(socketId, e);
  return e.count <= 3;
}

/* ─── Socket.IO ─── */
io.on('connection', (socket) => {
  // ── Create room ──────────────────────────────────────────────────────────
  socket.on('room:create', ({ name, password }) => {
    const rName = sanitize(name, 80) || 'Unnamed Room';
    const roomId = `${rName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-${Math.random().toString(36).slice(2, 7)}`;
    const pwHash = password ? hashPassword(sanitize(password, 100)) : null;

    if (rooms.has(roomId)) {
      socket.emit('room:create:error', { message: 'Room ID collision, try again.' });
      return;
    }

    const room = makeRoom(roomId, rName, pwHash, socket.id);
    rooms.set(roomId, room);
    room.users.set(socket.id, { name: 'Host' }); // placeholder; real name comes on join

    // Broadcast updated room list
    io.emit('lobby:update', { rooms: publicRoomList() });
    socket.emit('room:created', { roomId, name: rName });
  });

  // ── Join room ─────────────────────────────────────────────────────────────
  socket.on('room:join', ({ roomId, name, password }) => {
    if (!validId(roomId) || !validId(name)) {
      socket.emit('room:join:error', { message: 'Invalid room ID or name.' });
      return;
    }
    const trimId = roomId.trim();
    const trimName = sanitize(name, 50);

    const room = rooms.get(trimId);
    if (!room) {
      socket.emit('room:join:error', { message: 'Room not found.' });
      return;
    }

    // Password check
    if (room.passwordHash) {
      const given = hashPassword(sanitize(password || '', 100));
      if (given !== room.passwordHash) {
        socket.emit('room:join:error', { message: 'Wrong password.' });
        return;
      }
    }

    socket.join(trimId);
    room.users.set(socket.id, { name: trimName });
    if (!room.hostId) room.hostId = socket.id;

    io.to(trimId).emit('room:state', serializeRoom(room));
    io.emit('lobby:update', { rooms: publicRoomList() });
  });

  // ── Add to queue ──────────────────────────────────────────────────────────
  socket.on('queue:add', ({ roomId, track, addedBy }) => {
    if (!validId(roomId)) return;
    const room = rooms.get(roomId);
    if (!room || !track?.permalinkUrl) return;

    const item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      addedBy: sanitize(addedBy || room.users.get(socket.id)?.name || 'unknown', 50),
      track: {
        provider: String(track.provider || 'soundcloud'),
        trackId: String(track.trackId || ''),
        title: sanitize(track.title || 'Untitled', 200),
        artworkUrl: typeof track.artworkUrl === 'string' ? track.artworkUrl : null,
        durationMs: Number.isFinite(track.durationMs) ? track.durationMs : 0,
        permalinkUrl: String(track.permalinkUrl),
        user: sanitize(track.user || 'Unknown', 100)
      },
      createdAt: Date.now()
    };
    room.queue.push(item);

    if (!room.playback.trackId) {
      room.playback = { trackId: item.id, state: 'playing', positionMs: 0, updatedAt: Date.now() };
    }

    io.to(roomId).emit('room:state', serializeRoom(room));
  });

  // ── Skip ──────────────────────────────────────────────────────────────────
  socket.on('queue:skip', ({ roomId }) => {
    if (!validId(roomId)) return;
    const room = rooms.get(roomId);
    if (!room || !canControl(room, socket.id)) return;

    room.queue.shift();
    const next = room.queue[0];
    room.playback = {
      trackId: next ? next.id : null,
      positionMs: 0,
      state: next ? 'playing' : 'paused',
      updatedAt: Date.now()
    };
    io.to(roomId).emit('room:state', serializeRoom(room));
  });

  // ── Playback update ───────────────────────────────────────────────────────
  socket.on('player:update', ({ roomId, state, positionMs }) => {
    if (!validId(roomId)) return;
    const room = rooms.get(roomId);
    if (!room || !canControl(room, socket.id)) return;

    const validStates = ['playing', 'paused'];
    if (state && validStates.includes(state)) room.playback.state = state;
    if (Number.isFinite(positionMs) && positionMs >= 0) room.playback.positionMs = positionMs;
    room.playback.updatedAt = Date.now();

    // Broadcast to ALL room members (including sender) for true sync
    io.to(roomId).emit('player:sync', {
      playback: room.playback,
      by: socket.id
    });
  });

  // ── Host: set permissions ─────────────────────────────────────────────────
  socket.on('room:set-permissions', ({ roomId, allowMemberControl }) => {
    if (!validId(roomId)) return;
    const room = rooms.get(roomId);
    if (!room || room.hostId !== socket.id) return;

    room.settings.allowMemberControl = !!allowMemberControl;
    io.to(roomId).emit('room:state', serializeRoom(room));
  });

  // ── Chat ──────────────────────────────────────────────────────────────────
  socket.on('chat:send', ({ roomId, text }) => {
    if (!validId(roomId)) return;
    const room = rooms.get(roomId);
    const user = room?.users.get(socket.id);
    if (!room || !user) return;

    const trimText = sanitize(text, 500);
    if (!trimText) return;
    if (!checkChatRate(socket.id)) {
      socket.emit('error:message', { message: 'Slow down! Too many messages.' });
      return;
    }

    const msg = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      user: user.name,
      text: trimText,
      createdAt: Date.now()
    };
    room.chat.push(msg);
    room.chat = room.chat.slice(-100);
    io.to(roomId).emit('chat:new', msg);
  });

  // ── Disconnect ────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    chatRateLimits.delete(socket.id);

    for (const [roomId, room] of rooms.entries()) {
      if (!room.users.has(socket.id)) continue;

      room.users.delete(socket.id);
      if (room.hostId === socket.id) {
        room.hostId = room.users.keys().next().value || null;
      }

      if (room.users.size === 0) {
        rooms.delete(roomId);
        console.log(`Room ${roomId} closed.`);
      } else {
        io.to(roomId).emit('room:state', serializeRoom(room));
      }

      io.emit('lobby:update', { rooms: publicRoomList() });
    }
  });
});

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'web', 'dist', 'index.html'));
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`JamRoom server on http://localhost:${PORT}`));
