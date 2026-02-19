import React, { useEffect, useRef, useState } from 'react';
import { Button, FlatList, SafeAreaView, Text, TextInput, View } from 'react-native';
import { io } from 'socket.io-client';

export default function App() {
  const [serverUrl, setServerUrl] = useState('http://localhost:4000');
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState('demo-room');
  const [chatText, setChatText] = useState('');
  const [roomState, setRoomState] = useState(null);
  const [connected, setConnected] = useState(false);

  const socketRef = useRef(null);

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  const join = () => {
    socketRef.current?.disconnect();

    const socket = io(serverUrl, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('room:join', { roomId, name });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('room:state', setRoomState);
  };

  const sendChat = () => {
    const text = chatText.trim();
    if (!text) return;
    socketRef.current?.emit('chat:send', { roomId, text });
    setChatText('');
  };

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, gap: 8 }}>
      <Text style={{ fontSize: 22, fontWeight: '600' }}>JamRoom Mobile</Text>
      <Text>Status: {connected ? 'Connected' : 'Disconnected'}</Text>
      <TextInput placeholder="Server URL" value={serverUrl} onChangeText={setServerUrl} style={{ borderWidth: 1, padding: 8 }} />
      <TextInput placeholder="Your name" value={name} onChangeText={setName} style={{ borderWidth: 1, padding: 8 }} />
      <TextInput placeholder="Room ID" value={roomId} onChangeText={setRoomId} style={{ borderWidth: 1, padding: 8 }} />
      <Button title="Join room" onPress={join} />

      <Text style={{ marginTop: 12, fontWeight: '600' }}>Now Playing</Text>
      <Text>{roomState?.nowPlaying ? `${roomState.nowPlaying.track.title} — ${roomState.nowPlaying.track.user}` : 'none'}</Text>

      <Text style={{ marginTop: 12, fontWeight: '600' }}>Queue</Text>
      <FlatList
        data={roomState?.queue || []}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => <Text>{index + 1}. {item.track.title} — {item.track.user}</Text>}
      />

      <Text style={{ marginTop: 12, fontWeight: '600' }}>Chat</Text>
      <FlatList
        data={roomState?.chat || []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <Text>{item.user}: {item.text}</Text>}
      />

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput placeholder="Message" value={chatText} onChangeText={setChatText} style={{ borderWidth: 1, padding: 8, flex: 1 }} />
        <Button title="Send" onPress={sendChat} />
      </View>
    </SafeAreaView>
  );
}
