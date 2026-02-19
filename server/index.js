require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const axios = require('axios');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('web'));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const rooms = new Map();
const MAX_CHAT_MESSAGES = 150;

function createRoom(roomId) {
  return {
    roomId,
    hostId: null,
    users: new Map(),
    queue: [],
    chat: [],
    playback: {
      queueItemId: null,
      state: 'paused',
      positionMs: 0,
      updatedAt: Date.now()
    }
  };
}

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, createRoom(roomId));
  }
  return rooms.get(roomId);
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

function roomNowPlaying(room) {
  return room.queue.find((item) => item.id === room.playback.queueItemId) || room.queue[0] || null;
}

function syncPlaybackIfMissing(room) {
  if (!room.playback.queueItemId && room.queue.length > 0) {
    room.playback.queueItemId = room.queue[0].id;
    room.playback.positionMs = 0;
    room.playback.state = 'paused';
    room.playback.updatedAt = Date.now();
  }
}

function broadcastState(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  io.to(roomId).emit('room:state', { ...serializeRoom(room), nowPlaying: roomNowPlaying(room) });
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, rooms: rooms.size });
});

app.get('/api/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) {
    return res.status(400).json({ error: 'Missing query: q' });
  }

  const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
  if (!clientId) {
    return res.status(503).json({ error: 'SOUNDCLOUD_CLIENT_ID is not configured.' });
  }

  try {
    const response = await axios.get('https://api-v2.soundcloud.com/search/tracks', {
      params: { q, client_id: clientId, limit: 20 },
      timeout: 8000
    });

    const tracks = (response.data.collection || []).map((track) => ({
      provider: 'soundcloud',
      trackId: String(track.id),
      title: track.title,
      artworkUrl: track.artwork_url,
      durationMs: track.duration,
      permalinkUrl: track.permalink_url,
      user: track.user?.username || 'Unknown artist'
    }));

    return res.json({ tracks });
  } catch (error) {
    return res.status(502).json({
      error: 'SoundCloud search failed',
      detail: error.response?.data || error.message
    });
  }
});

io.on('connection', (socket) => {
  socket.on('room:join', ({ roomId, name }) => {
    const normalizedRoomId = String(roomId || '').trim();
    const normalizedName = String(name || '').trim();

    if (!normalizedRoomId || !normalizedName) {
      socket.emit('error:message', { message: 'roomId and name are required.' });
      return;
    }

    const room = getOrCreateRoom(normalizedRoomId);
    socket.join(normalizedRoomId);
    room.users.set(socket.id, { name: normalizedName, joinedAt: Date.now() });
    if (!room.hostId) room.hostId = socket.id;

    syncPlaybackIfMissing(room);
    broadcastState(normalizedRoomId);
  });

  socket.on('queue:add', ({ roomId, track, addedBy }) => {
    const room = rooms.get(roomId);
    if (!room || !track?.trackId || !track?.title) return;

    const item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      addedBy: addedBy || room.users.get(socket.id)?.name || 'unknown',
      track,
      createdAt: Date.now()
    };

    room.queue.push(item);
    syncPlaybackIfMissing(room);
    broadcastState(roomId);
  });

  socket.on('queue:skip', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || socket.id !== room.hostId || room.queue.length === 0) return;

    const currentId = room.playback.queueItemId;
    const currentIndex = room.queue.findIndex((item) => item.id === currentId);
    if (currentIndex >= 0) {
      room.queue.splice(currentIndex, 1);
    } else {
      room.queue.shift();
    }

    room.playback.queueItemId = room.queue[0]?.id || null;
    room.playback.positionMs = 0;
    room.playback.state = 'paused';
    room.playback.updatedAt = Date.now();

    broadcastState(roomId);
  });

  socket.on('player:update', ({ roomId, state, positionMs }) => {
    const room = rooms.get(roomId);
    if (!room || socket.id !== room.hostId) return;

    if (state === 'playing' || state === 'paused') {
      room.playback.state = state;
    }
    if (Number.isFinite(positionMs) && positionMs >= 0) {
      room.playback.positionMs = positionMs;
    }
    room.playback.updatedAt = Date.now();

    broadcastState(roomId);
  });

  socket.on('chat:send', ({ roomId, text }) => {
    const room = rooms.get(roomId);
    const user = room?.users.get(socket.id);
    const normalizedText = String(text || '').trim();
    if (!room || !user || !normalizedText) return;

    const message = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      user: user.name,
      text: normalizedText,
      createdAt: Date.now()
    };

    room.chat.push(message);
    room.chat = room.chat.slice(-MAX_CHAT_MESSAGES);

    io.to(roomId).emit('chat:new', message);
  });

  socket.on('disconnect', () => {
    for (const [roomId, room] of rooms.entries()) {
      if (!room.users.has(socket.id)) continue;

      room.users.delete(socket.id);
      if (room.hostId === socket.id) {
        room.hostId = room.users.keys().next().value || null;
      }

      if (room.users.size === 0) {
        rooms.delete(roomId);
      } else {
        broadcastState(roomId);
      }
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`JamRoom server running on http://localhost:${PORT}`);
});
