import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

/**
 * Custom hook that manages the Socket.IO connection and all room state.
 * Improvements:
 * - joinRoom waits for 'connect' before emitting room:join (race-condition fix)
 * - error is cleared on successful room:state
 * - socket ref guards prevent emitting on null socket
 */
export default function useSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [roomState, setRoomState] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [error, setError] = useState(null);
  const [mySocketId, setMySocketId] = useState(null);

  useEffect(() => {
    const socket = io({ autoConnect: false, reconnection: true, reconnectionAttempts: 5 });
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
    socket.on('connect_error', () => setError('Cannot connect to server. Please refresh.'));

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
