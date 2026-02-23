import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL;
const API_BASE = import.meta.env.VITE_SERVER_URL || '';

export default function useSocket(notify) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [roomState, setRoomState] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [error, setError] = useState(null);
  const [mySocketId, setMySocketId] = useState(null);
  const [lobbyRooms, setLobbyRooms] = useState([]);
  const notifyRef = useRef(notify);
  const prevUsersRef = useRef(0);
  const prevQueueRef = useRef(0);
  const activeRoomRef = useRef(null);   // { roomId, userName } for auto-rejoin
  const wasInRoomRef = useRef(false);   // tracks if we were in a room before disconnect

  useEffect(() => { notifyRef.current = notify; }, [notify]);

  // Fetch initial room list via REST (before socket lobby:update arrives)
  useEffect(() => {
    fetch(`${API_BASE}/api/rooms`)
      .then((r) => r.json())
      .then((d) => setLobbyRooms(d.rooms || []))
      .catch(() => { });
  }, []);

  useEffect(() => {
    const socket = io(SERVER_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 12,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 15000,
      timeout: 20000
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setMySocketId(socket.id);
      setError(null);

      // Auto-rejoin room after reconnection
      const active = activeRoomRef.current;
      if (active && wasInRoomRef.current) {
        socket.emit('room:rejoin', { roomId: active.roomId, name: active.userName });
      }
    });

    socket.on('disconnect', () => {
      setConnected(false);
      // Don't clear mySocketId or roomState so UI stays intact during brief disconnect
      if (activeRoomRef.current) {
        wasInRoomRef.current = true;
      }
    });

    socket.on('connect_error', () => {
      setError('Server is starting up, please wait… (reconnecting automatically)');
    });

    socket.on('room:state', (state) => {
      setRoomState((prev) => {
        const fn = notifyRef.current;
        if (fn && prev) {
          // Detect new user joining
          const prevUsers = prev.users || [];
          const newUsers = state.users || [];
          if (newUsers.length > prevUsers.length) {
            const prevIds = new Set(prevUsers.map(u => u.socketId));
            const joined = newUsers.filter(u => !prevIds.has(u.socketId));
            joined.forEach(u => fn('JamRoom', `${u.name} joined the room`));
          }
          // Detect new track added to queue
          const prevQueue = prev.queue || [];
          const newQueue = state.queue || [];
          if (newQueue.length > prevQueue.length) {
            const lastTrack = newQueue[newQueue.length - 1];
            if (lastTrack?.track?.title) {
              fn('New track added', `${lastTrack.track.title}`, lastTrack.track.artworkUrl || undefined);
            }
          }
        }
        return state;
      });
      setChatMessages(state.chat || []);
    });

    socket.on('player:sync', ({ playback }) => {
      setRoomState((prev) => prev ? { ...prev, playback } : prev);
    });

    socket.on('chat:new', (msg) => {
      setChatMessages((prev) => [...prev.slice(-99), msg]);
    });

    socket.on('lobby:update', ({ rooms }) => {
      setLobbyRooms(rooms || []);
    });

    socket.on('error:message', (e) => setError(e.message));

    // Connect immediately so lobby:update starts arriving
    socket.connect();

    return () => { socket.disconnect(); };
  }, []);

  /* ── Room actions ── */

  const createRoom = useCallback((name, password) => {
    return new Promise((resolve, reject) => {
      const socket = socketRef.current;
      if (!socket) return reject(new Error('Not connected'));
      socket.once('room:created', resolve);
      socket.once('room:create:error', ({ message }) => reject(new Error(message)));
      socket.emit('room:create', { name, password: password || '' });
    });
  }, []);

  const joinRoom = useCallback((roomId, name, password) => {
    return new Promise((resolve, reject) => {
      const socket = socketRef.current;
      if (!socket) return reject(new Error('Not connected'));
      setError(null);

      const onState = (state) => {
        socket.off('room:join:error', onError);
        resolve(state);
      };
      const onError = ({ message }) => {
        socket.off('room:state', onState);
        reject(new Error(message));
      };

      socket.once('room:state', onState);
      socket.once('room:join:error', onError);

      const doJoin = () => socket.emit('room:join', { roomId, name, password: password || '' });

      if (socket.connected) {
        doJoin();
      } else {
        socket.once('connect', doJoin);
      }
    });
  }, []);

  // Track active room for auto-rejoin
  const setActiveRoom = useCallback((roomId, userName) => {
    activeRoomRef.current = roomId ? { roomId, userName } : null;
    wasInRoomRef.current = false;
  }, []);

  const addToQueue = useCallback((roomId, track, addedBy) => {
    socketRef.current?.emit('queue:add', { roomId, track, addedBy });
  }, []);

  const skipTrack = useCallback((roomId) => {
    socketRef.current?.emit('queue:skip', { roomId });
  }, []);

  const playTrack = useCallback((roomId, trackItemId) => {
    socketRef.current?.emit('queue:play', { roomId, trackItemId });
  }, []);

  const removeFromQueue = useCallback((roomId, trackItemId) => {
    socketRef.current?.emit('queue:remove', { roomId, trackItemId });
  }, []);

  const updatePlayback = useCallback((roomId, state, positionMs) => {
    socketRef.current?.emit('player:update', { roomId, state, positionMs });
  }, []);

  const sendChat = useCallback((roomId, text) => {
    const trimmed = text?.trim();
    if (!trimmed) return;
    socketRef.current?.emit('chat:send', { roomId, text: trimmed });
  }, []);

  const setPermissions = useCallback((roomId, allowMemberControl) => {
    socketRef.current?.emit('room:set-permissions', { roomId, allowMemberControl });
  }, []);

  const isHost = !!(roomState?.hostId && mySocketId && roomState.hostId === mySocketId);
  const canControl = isHost || !!roomState?.settings?.allowMemberControl;

  return {
    connected,
    roomState,
    chatMessages,
    error,
    mySocketId,
    isHost,
    canControl,
    lobbyRooms,
    createRoom,
    joinRoom,
    setActiveRoom,
    addToQueue,
    skipTrack,
    playTrack,
    removeFromQueue,
    updatePlayback,
    sendChat,
    setPermissions
  };
}
