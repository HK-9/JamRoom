import React, { useState } from 'react';
import { ConfigProvider, Layout, Typography, Tabs, Badge, Avatar, Tag, Space, Divider, Alert, theme } from 'antd';
import {
  SearchOutlined,
  UnorderedListOutlined,
  MessageOutlined,
  UserOutlined,
  CrownOutlined,
  SoundOutlined
} from '@ant-design/icons';

import JoinScreen from './components/JoinScreen';
import SearchPanel from './components/SearchPanel';
import QueuePanel from './components/QueuePanel';
import ChatPanel from './components/ChatPanel';
import PlayerBar from './components/PlayerBar';
import useSocket from './hooks/useSocket';
import useSearch from './hooks/useSearch';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

export default function App() {
  const [joined, setJoined] = useState(false);
  const [userName, setUserName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [unreadChat, setUnreadChat] = useState(0);
  const [activeTab, setActiveTab] = useState('search');

  const {
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
  } = useSocket();

  const { results, loading, error: searchError, search } = useSearch();

  const handleJoin = (rid, name) => {
    setRoomId(rid);
    setUserName(name);
    joinRoom(rid, name);
    setJoined(true);
  };

  const handleAddTrack = (track) => {
    addToQueue(roomId, track, userName);
  };

  const handleSkip = () => {
    skipTrack(roomId);
  };

  const handlePlayPause = (state, positionMs) => {
    updatePlayback(roomId, state, positionMs);
  };

  const handlePositionUpdate = (state, positionMs) => {
    updatePlayback(roomId, state, positionMs);
  };

  const handleSendChat = (text) => {
    sendChat(roomId, text);
  };

  const handleTabChange = (key) => {
    setActiveTab(key);
    if (key === 'chat') setUnreadChat(0);
  };

  // Track unread chat messages when not on chat tab
  const prevChatLen = React.useRef(chatMessages.length);
  React.useEffect(() => {
    if (activeTab !== 'chat' && chatMessages.length > prevChatLen.current) {
      setUnreadChat((n) => n + (chatMessages.length - prevChatLen.current));
    }
    prevChatLen.current = chatMessages.length;
  }, [chatMessages, activeTab]);

  // Find the currently playing queue item
  const currentItem = React.useMemo(() => {
    if (!roomState?.playback?.trackId || !roomState.queue) return null;
    return roomState.queue.find((item) => item.id === roomState.playback.trackId) || null;
  }, [roomState]);

  if (!joined) {
    return (
      <ConfigProvider theme={{ algorithm: theme.darkAlgorithm, token: { colorPrimary: '#1677ff', borderRadius: 8 } }}>
        <JoinScreen onJoin={handleJoin} />
      </ConfigProvider>
    );
  }

  const users = roomState?.users || [];

  const tabItems = [
    {
      key: 'search',
      label: (
        <span>
          <SearchOutlined /> Search
        </span>
      ),
      children: (
        <div style={{ padding: 16, height: 'calc(100vh - 180px)' }}>
          <SearchPanel
            results={results}
            loading={loading}
            error={searchError}
            onSearch={search}
            onAdd={handleAddTrack}
          />
        </div>
      )
    },
    {
      key: 'queue',
      label: (
        <span>
          <UnorderedListOutlined /> Queue
          {roomState?.queue?.length > 0 && (
            <Badge
              count={roomState.queue.length}
              size="small"
              offset={[6, -2]}
              style={{ backgroundColor: '#1677ff' }}
            />
          )}
        </span>
      ),
      children: (
        <div style={{ padding: 16, height: 'calc(100vh - 180px)' }}>
          <QueuePanel
            queue={roomState?.queue || []}
            currentTrackId={roomState?.playback?.trackId}
            isHost={isHost}
            onSkip={handleSkip}
          />
        </div>
      )
    },
    {
      key: 'chat',
      label: (
        <span>
          <MessageOutlined /> Chat
          {unreadChat > 0 && (
            <Badge
              count={unreadChat}
              size="small"
              offset={[6, -2]}
              style={{ backgroundColor: '#52c41a' }}
            />
          )}
        </span>
      ),
      children: (
        <div style={{ padding: 16, height: 'calc(100vh - 180px)' }}>
          <ChatPanel messages={chatMessages} onSend={handleSendChat} />
        </div>
      )
    }
  ];

  return (
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm, token: { colorPrimary: '#1677ff', borderRadius: 8 } }}>
      <Layout style={{ height: '100vh' }}>
        {/* Header */}
        <Header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            height: 56,
            borderBottom: '1px solid #303030'
          }}
        >
          <Space>
            <SoundOutlined style={{ fontSize: 22, color: '#1677ff' }} />
            <Title level={4} style={{ margin: 0, color: '#fff' }}>
              JamRoom
            </Title>
            <Tag color="blue">{roomId}</Tag>
          </Space>
          <Space>
            {isHost && <Tag icon={<CrownOutlined />} color="gold">Host</Tag>}
            <Tag color={connected ? 'green' : 'red'}>
              {connected ? 'Connected' : 'Disconnected'}
            </Tag>
            <Text style={{ color: '#999' }}>{userName}</Text>
          </Space>
        </Header>

        {/* Global socket error banner */}
        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            closable
            banner
            style={{ borderRadius: 0 }}
          />
        )}

        <Layout>
          {/* Sidebar — Users */}
          <Sider
            width={220}
            style={{ borderRight: '1px solid #303030', padding: '16px 12px' }}
          >
            <Text strong style={{ color: '#999', textTransform: 'uppercase', fontSize: 11, letterSpacing: 1 }}>
              In Room — {users.length}
            </Text>
            <Divider style={{ margin: '8px 0' }} />
            <div className="panel-scroll" style={{ maxHeight: 'calc(100vh - 200px)' }}>
              {users.map((u) => (
                <div
                  key={u.socketId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 4px',
                    borderRadius: 8,
                    background: u.socketId === mySocketId ? 'rgba(22,119,255,0.08)' : 'transparent'
                  }}
                >
                  <Avatar size="small" icon={<UserOutlined />} />
                  <Text style={{ color: '#e0e0e0', flex: 1 }}>{u.name}</Text>
                  {u.socketId === roomState?.hostId && (
                    <CrownOutlined style={{ color: '#faad14', fontSize: 14 }} />
                  )}
                </div>
              ))}
            </div>
          </Sider>

          {/* Main Content — Tabs */}
          <Content style={{ overflow: 'hidden' }}>
            <Tabs
              activeKey={activeTab}
              onChange={handleTabChange}
              items={tabItems}
              style={{ height: '100%' }}
              tabBarStyle={{ paddingLeft: 16, marginBottom: 0 }}
            />
          </Content>
        </Layout>

        {/* Player Bar */}
        <PlayerBar
          currentItem={currentItem}
          playbackState={roomState?.playback}
          isHost={isHost}
          onPlayPause={handlePlayPause}
          onSkip={handleSkip}
          onPositionUpdate={handlePositionUpdate}
        />
      </Layout>
    </ConfigProvider>
  );
}
