import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL;
const API_BASE = import.meta.env.VITE_SERVER_URL || '';

export default function useSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [roomState, setRoomState] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [error, setError] = useState(null);
  const [mySocketId, setMySocketId] = useState(null);
  const [lobbyRooms, setLobbyRooms] = useState([]);

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
    });

    socket.on('disconnect', () => {
      setConnected(false);
      setMySocketId(null);
    });

    socket.on('connect_error', () => {
      setError('Server is starting up, please wait… (reconnecting automatically)');
    });

    socket.on('room:state', (state) => {
      setRoomState(state);
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

  const addToQueue = useCallback((roomId, track, addedBy) => {
    socketRef.current?.emit('queue:add', { roomId, track, addedBy });
  }, []);

  const skipTrack = useCallback((roomId) => {
    socketRef.current?.emit('queue:skip', { roomId });
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
    addToQueue,
    skipTrack,
    updatePlayback,
    sendChat,
    setPermissions
  };
}
