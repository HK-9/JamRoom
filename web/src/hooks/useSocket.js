import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

/**
 * Custom hook that manages the Socket.IO connection and all room state.
 *
 * In development (Vite proxy): connects to same origin (VITE_SERVER_URL is empty).
 * In production (Netlify → Render): connects to VITE_SERVER_URL (the Render backend URL).
 *
 * Robustness:
 * - joinRoom waits for 'connect' before emitting room:join (race-condition fix)
 * - Reconnection with long delays to survive Render.com cold starts (~15s)
 * - connect_error shows a user-facing message
 */

const SERVER_URL = import.meta.env.VITE_SERVER_URL; // undefined in dev = same origin

export default function useSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [roomState, setRoomState] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [error, setError] = useState(null);
  const [mySocketId, setMySocketId] = useState(null);

  useEffect(() => {
    const socket = io(SERVER_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 12,
      reconnectionDelay: 2000,      // 2s before first retry
      reconnectionDelayMax: 15000,  // up to 15s between retries (handles Render cold start)
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
    socket.on('room:state', (state) => {
      setRoomState(state);
      setChatMessages(state.chat || []);
    });
    socket.on('chat:new', (msg) => {
      setChatMessages((prev) => [...prev.slice(-99), msg]);
    });
    socket.on('error:message', (e) => setError(e.message));
    socket.on('connect_error', () => {
      setError('Server is starting up, please wait… (reconnecting automatically)');
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const joinRoom = useCallback((roomId, name) => {
    const socket = socketRef.current;
    if (!socket) return;
    setError(null);

    const doJoin = () => socket.emit('room:join', { roomId, name });

    if (socket.connected) {
      doJoin();
    } else {
      socket.once('connect', doJoin);
      socket.connect();
    }
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

  const isHost = !!(roomState?.hostId && mySocketId && roomState.hostId === mySocketId);

  return {
    connected,
    roomState,
    chatMessages,
    error,
    mySocketId,
    isHost,
    joinRoom,
    addToQueue,
    skipTrack,
    updatePlayback,
    sendChat
  };
}
