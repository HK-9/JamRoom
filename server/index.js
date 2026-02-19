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
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const rooms = new Map();

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

app.get('/health', (_req, res) => {
  res.json({ ok: true, rooms: rooms.size });
});

app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  if (!q || !String(q).trim()) {
    return res.status(400).json({ error: 'Missing query: q' });
  }

  const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
  if (!clientId) {
    return res.status(503).json({
      error: 'SOUNDCLOUD_CLIENT_ID is not configured. Add it to .env before using search.'
    });
  }

  try {
    const response = await axios.get('https://api-v2.soundcloud.com/search/tracks', {
      params: {
        q,
        client_id: clientId,
        limit: 20
      }
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
    return res.status(500).json({
      error: 'SoundCloud search failed',
      detail: error.response?.data || error.message
    });
  }
});

io.on('connection', (socket) => {
  socket.on('room:join', ({ roomId, name }) => {
    if (!roomId || !name) {
      socket.emit('error:message', { message: 'roomId and name are required.' });
      return;
    }

    const trimmedRoomId = String(roomId).trim();
    const room = rooms.get(trimmedRoomId) || makeInitialRoom(trimmedRoomId);
    if (!rooms.has(trimmedRoomId)) rooms.set(trimmedRoomId, room);

    socket.join(trimmedRoomId);
    room.users.set(socket.id, { name: String(name).trim() });
    if (!room.hostId) room.hostId = socket.id;

    io.to(trimmedRoomId).emit('room:state', serializeRoom(room));
  });

  socket.on('queue:add', ({ roomId, track, addedBy }) => {
    const room = rooms.get(roomId);
    if (!room || !track) return;

    const item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      addedBy: addedBy || room.users.get(socket.id)?.name || 'unknown',
      track,
      createdAt: Date.now()
    };
    room.queue.push(item);

    if (!room.playback.trackId) {
      room.playback.trackId = item.id;
      room.playback.state = 'paused';
      room.playback.positionMs = 0;
      room.playback.updatedAt = Date.now();
    }

    io.to(roomId).emit('room:state', serializeRoom(room));
  });

  socket.on('queue:skip', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.hostId !== socket.id || room.queue.length === 0) return;

    room.queue.shift();
    const next = room.queue[0];
    room.playback.trackId = next ? next.id : null;
    room.playback.positionMs = 0;
    room.playback.state = 'paused';
    room.playback.updatedAt = Date.now();

    io.to(roomId).emit('room:state', serializeRoom(room));
  });

  socket.on('player:update', ({ roomId, state, positionMs }) => {
    const room = rooms.get(roomId);
    if (!room || room.hostId !== socket.id) return;

    room.playback.state = state || room.playback.state;
    room.playback.positionMs = Number.isFinite(positionMs) ? positionMs : room.playback.positionMs;
    room.playback.updatedAt = Date.now();

    io.to(roomId).emit('room:state', serializeRoom(room));
  });

  socket.on('chat:send', ({ roomId, text }) => {
    const room = rooms.get(roomId);
    const user = room?.users.get(socket.id);
    if (!room || !user || !text?.trim()) return;

    const message = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      user: user.name,
      text: text.trim(),
      createdAt: Date.now()
    };

    room.chat.push(message);
    room.chat = room.chat.slice(-100);

    io.to(roomId).emit('chat:new', message);
  });

  socket.on('disconnect', () => {
    for (const [roomId, room] of rooms.entries()) {
      if (!room.users.has(socket.id)) continue;

      room.users.delete(socket.id);
      if (room.hostId === socket.id) {
        const nextHost = room.users.keys().next().value;
        room.hostId = nextHost || null;
      }

      if (room.users.size === 0) {
        rooms.delete(roomId);
      } else {
        io.to(roomId).emit('room:state', serializeRoom(room));
      }
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`JamRoom server running on http://localhost:${PORT}`);
});
