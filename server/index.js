require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const axios = require('axios');
const { Server } = require('socket.io');

const app = express();
// Allow specific origins from env or fall back to wildcard (dev)
const rawOrigins = (process.env.CORS_ORIGIN || '*').split(',').map((s) => s.trim());
const corsOrigin = rawOrigins.length === 1 && rawOrigins[0] === '*' ? '*' : rawOrigins;
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());

// Serve the built React app (web/dist) in production
app.use(express.static(path.join(__dirname, '..', 'web', 'dist')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const rooms = new Map();

/* ---------- SoundCloud public client_id resolver ---------- */
let resolvedClientId = null;
let resolveInProgress = null; // Prevents concurrent resolves

async function getPublicClientId() {
  if (resolvedClientId) return resolvedClientId;
  if (resolveInProgress) return resolveInProgress;

  resolveInProgress = (async () => {
    try {
      const page = await axios.get('https://soundcloud.com', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000
      });
      const scriptUrls = page.data.match(/https:\/\/a-v2\.sndcdn\.com\/assets\/[^\s"]+\.js/g);
      if (!scriptUrls || scriptUrls.length === 0) return null;

      for (let i = scriptUrls.length - 1; i >= Math.max(0, scriptUrls.length - 5); i--) {
        const bundle = await axios.get(scriptUrls[i], {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 10000
        });
        const match = bundle.data.match(/client_id:"([a-zA-Z0-9]{32})"/);
        if (match) {
          resolvedClientId = match[1];
          console.log('Resolved SoundCloud public client_id:', resolvedClientId);
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

function makeInitialRoom(roomId) {
  return {
    roomId,
    hostId: null,
    users: new Map(),
    queue: [],
    chat: [],
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
    hostId: room.hostId,
    users: Array.from(room.users.entries()).map(([socketId, user]) => ({ socketId, ...user })),
    queue: room.queue,
    chat: room.chat,
    playback: room.playback
  };
}

/* ---------- Input validation helpers ---------- */
function sanitizeString(str, maxLen = 200) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLen);
}

function isValidId(str) {
  return typeof str === 'string' && str.trim().length > 0 && str.trim().length <= 100;
}

/* ---------- REST endpoints ---------- */

app.get('/health', (_req, res) => {
  res.json({ ok: true, rooms: rooms.size, timestamp: Date.now() });
});

app.get('/api/search', async (req, res) => {
  const q = sanitizeString(req.query.q);
  if (!q) {
    return res.status(400).json({ error: 'Missing or empty query: q' });
  }

  const clientId = await getPublicClientId();
  if (!clientId) {
    return res.status(503).json({
      error: 'Unable to resolve a working SoundCloud client_id. Try again in a moment.'
    });
  }

  try {
    const response = await axios.get('https://api-v2.soundcloud.com/search/tracks', {
      params: { q, client_id: clientId, limit: 20 },
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });

    const normalized = (response.data.collection || []).map((track) => ({
      provider: 'soundcloud',
      trackId: String(track.id),
      title: track.title,
      artworkUrl: track.artwork_url,
      durationMs: track.duration,
      permalinkUrl: track.permalink_url,
      user: track.user?.username || 'Unknown artist'
    }));

    return res.json({ tracks: normalized });
  } catch (error) {
    if (error.response?.status === 401 || error.response?.status === 403) {
      resolvedClientId = null;
      console.warn('SoundCloud client_id expired, will re-resolve on next request.');
    }
    console.error('SoundCloud search error:', error.response?.data || error.message);
    return res.status(500).json({
      error: 'SoundCloud search failed',
      detail: error.response?.data || error.message
    });
  }
});

/* Resolve a SoundCloud track by trackId for the widget player */
app.get('/api/resolve/:trackId', async (req, res) => {
  const trackId = sanitizeString(req.params.trackId, 50);
  if (!trackId) return res.status(400).json({ error: 'Invalid trackId' });

  const clientId = await getPublicClientId();
  if (!clientId) {
    return res.status(503).json({ error: 'Cannot resolve SoundCloud client_id.' });
  }
  try {
    const { data } = await axios.get(`https://api-v2.soundcloud.com/tracks/${trackId}`, {
      params: { client_id: clientId },
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });
    return res.json({
      trackId: String(data.id),
      title: data.title,
      permalinkUrl: data.permalink_url,
      artworkUrl: data.artwork_url,
      durationMs: data.duration,
      user: data.user?.username || 'Unknown artist',
      waveformUrl: data.waveform_url
    });
  } catch (err) {
    return res.status(500).json({ error: 'Resolve failed', detail: err.message });
  }
});

/* ---------- Socket.IO ---------- */

/** Simple per-socket rate limiter for chat (max 3 messages per 3 seconds) */
const chatRateLimits = new Map();
function checkChatRateLimit(socketId) {
  const now = Date.now();
  const entry = chatRateLimits.get(socketId) || { count: 0, resetAt: now + 3000 };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + 3000;
  }
  entry.count += 1;
  chatRateLimits.set(socketId, entry);
  return entry.count <= 3;
}

io.on('connection', (socket) => {
  socket.on('room:join', ({ roomId, name }) => {
    if (!isValidId(roomId) || !isValidId(name)) {
      socket.emit('error:message', { message: 'roomId and name must be non-empty strings (max 100 chars).' });
      return;
    }

    const trimmedRoomId = roomId.trim();
    const trimmedName = sanitizeString(name, 50);
    const room = rooms.get(trimmedRoomId) || makeInitialRoom(trimmedRoomId);
    if (!rooms.has(trimmedRoomId)) rooms.set(trimmedRoomId, room);

    socket.join(trimmedRoomId);
    room.users.set(socket.id, { name: trimmedName });
    if (!room.hostId) room.hostId = socket.id;

    io.to(trimmedRoomId).emit('room:state', serializeRoom(room));
  });

  socket.on('queue:add', ({ roomId, track, addedBy }) => {
    if (!isValidId(roomId)) return;
    const room = rooms.get(roomId);
    if (!room || !track?.permalinkUrl) return;

    const item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      addedBy: sanitizeString(addedBy || room.users.get(socket.id)?.name || 'unknown', 50),
      track: {
        provider: String(track.provider || 'soundcloud'),
        trackId: String(track.trackId || ''),
        title: sanitizeString(track.title || 'Untitled', 200),
        artworkUrl: typeof track.artworkUrl === 'string' ? track.artworkUrl : null,
        durationMs: Number.isFinite(track.durationMs) ? track.durationMs : 0,
        permalinkUrl: String(track.permalinkUrl),
        user: sanitizeString(track.user || 'Unknown', 100)
      },
      createdAt: Date.now()
    };
    room.queue.push(item);

    if (!room.playback.trackId) {
      room.playback.trackId = item.id;
      room.playback.state = 'playing';
      room.playback.positionMs = 0;
      room.playback.updatedAt = Date.now();
    }

    io.to(roomId).emit('room:state', serializeRoom(room));
  });

  socket.on('queue:skip', ({ roomId }) => {
    if (!isValidId(roomId)) return;
    const room = rooms.get(roomId);
    if (!room || room.hostId !== socket.id || room.queue.length === 0) return;

    room.queue.shift();
    const next = room.queue[0];
    room.playback.trackId = next ? next.id : null;
    room.playback.positionMs = 0;
    room.playback.state = next ? 'playing' : 'paused';
    room.playback.updatedAt = Date.now();

    io.to(roomId).emit('room:state', serializeRoom(room));
  });

  socket.on('player:update', ({ roomId, state, positionMs }) => {
    if (!isValidId(roomId)) return;
    const room = rooms.get(roomId);
    if (!room || room.hostId !== socket.id) return;

    const validStates = ['playing', 'paused'];
    if (state && validStates.includes(state)) room.playback.state = state;
    if (Number.isFinite(positionMs) && positionMs >= 0) room.playback.positionMs = positionMs;
    room.playback.updatedAt = Date.now();

    socket.to(roomId).emit('room:state', serializeRoom(room));
  });

  socket.on('chat:send', ({ roomId, text }) => {
    if (!isValidId(roomId)) return;
    const room = rooms.get(roomId);
    const user = room?.users.get(socket.id);
    if (!room || !user) return;

    const trimmedText = sanitizeString(text, 500);
    if (!trimmedText) return;

    // Rate limit check
    if (!checkChatRateLimit(socket.id)) {
      socket.emit('error:message', { message: 'Slow down! Too many messages.' });
      return;
    }

    const message = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      user: user.name,
      text: trimmedText,
      createdAt: Date.now()
    };

    room.chat.push(message);
    room.chat = room.chat.slice(-100); // Keep last 100 messages

    io.to(roomId).emit('chat:new', message);
  });

  socket.on('disconnect', () => {
    chatRateLimits.delete(socket.id);

    for (const [roomId, room] of rooms.entries()) {
      if (!room.users.has(socket.id)) continue;

      room.users.delete(socket.id);
      if (room.hostId === socket.id) {
        const nextHost = room.users.keys().next().value;
        room.hostId = nextHost || null;
      }

      if (room.users.size === 0) {
        rooms.delete(roomId);
        console.log(`Room ${roomId} closed (empty).`);
      } else {
        io.to(roomId).emit('room:state', serializeRoom(room));
      }
    }
  });
});

// SPA fallback — serve index.html for non-API routes in production
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'web', 'dist', 'index.html'));
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`JamRoom server running on http://localhost:${PORT}`);
});
