import React, { useState } from 'react';
import {
  ConfigProvider, Typography, Tabs, Badge, Avatar, Tag, Space,
  Divider, Alert, Button, Drawer, Input, Modal, theme
} from 'antd';
import {
  SearchOutlined, UnorderedListOutlined, MessageOutlined,
  UserOutlined, CrownOutlined, SoundOutlined, MenuOutlined,
  LockOutlined, UnlockOutlined, CheckOutlined
} from '@ant-design/icons';

import LobbyScreen from './components/LobbyScreen';
import PasswordModal from './components/PasswordModal';
import SearchPanel from './components/SearchPanel';
import QueuePanel from './components/QueuePanel';
import ChatPanel from './components/ChatPanel';
import PlayerBar from './components/PlayerBar';
import InstallPrompt from './components/InstallPrompt';
import useSocket from './hooks/useSocket';
import useSearch from './hooks/useSearch';
import useNotifications from './hooks/useNotifications';

const { Title, Text } = Typography;

const antTheme = {
  algorithm: theme.darkAlgorithm,
  token: { colorPrimary: '#1677ff', borderRadius: 8 }
};

export default function App() {
  /* ── Lobby state ── */
  const [phase, setPhase] = useState('name');  // 'name' | 'lobby' | 'password' | 'room'
  const [userName, setUserName] = useState('');
  const [pendingRoom, setPendingRoom] = useState(null); // room obj from lobby list
  const [joinError, setJoinError] = useState('');
  const [nameInput, setNameInput] = useState('');

  /* ── Room state ── */
  const [roomId, setRoomId] = useState('');
  const [unreadChat, setUnreadChat] = useState(0);
  const [activeTab, setActiveTab] = useState('search');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { notify } = useNotifications();

  const {
    connected, roomState, chatMessages, error, mySocketId,
    isHost, canControl, lobbyRooms,
    createRoom, joinRoom, addToQueue, skipTrack, playTrack, removeFromQueue,
    updatePlayback, sendChat, setPermissions
  } = useSocket(notify);

  const { results, loading, error: searchError, search } = useSearch();

  /* ── Name entry → Lobby ── */
  const handleNameSubmit = () => {
    const name = nameInput.trim();
    if (!name) return;
    setUserName(name);
    setPhase('lobby');
  };

  /* ── Create room ── */
  const handleCreate = async (name, password) => {
    const { roomId: rid } = await createRoom(name, password);
    // Auto-join as creator
    await joinRoom(rid, userName, password);
    setRoomId(rid);
    setPhase('room');
  };

  /* ── Click a lobbied room ── */
  const handleJoinRequest = (room) => {
    if (room.hasPassword) {
      setPendingRoom(room);
      setPhase('password');
    } else {
      doJoin(room.roomId, userName, '');
    }
  };

  /* ── Password confirmed ── */
  const handlePasswordConfirm = async (rid, name, password) => {
    await doJoin(rid, name, password); // throws on wrong password
    setPendingRoom(null);
  };

  async function doJoin(rid, name, password) {
    setJoinError('');
    await joinRoom(rid, name, password); // throws on error
    setRoomId(rid);
    setPhase('room');
  }

  /* ── Track actions ── */
  const handleAddTrack = (track) => addToQueue(roomId, track, userName);
  const handleSkip = () => skipTrack(roomId);
  const handlePlayPause = (state, positionMs) => updatePlayback(roomId, state, positionMs);
  const handlePositionUpdate = (state, pos) => updatePlayback(roomId, state, pos);
  const handleSendChat = (text) => sendChat(roomId, text);
  const handleTogglePermissions = () => {
    if (!isHost) return;
    setPermissions(roomId, !roomState?.settings?.allowMemberControl);
  };

  const handleTabChange = (key) => {
    setActiveTab(key);
    if (key === 'chat') setUnreadChat(0);
  };

  const prevChatLen = React.useRef(chatMessages.length);
  React.useEffect(() => {
    if (activeTab !== 'chat' && chatMessages.length > prevChatLen.current) {
      setUnreadChat((n) => n + (chatMessages.length - prevChatLen.current));
    }
    prevChatLen.current = chatMessages.length;
  }, [chatMessages, activeTab]);

  const playbackTrackId = roomState?.playback?.trackId;
  const queue = roomState?.queue;
  const currentItem = React.useMemo(() => {
    if (!playbackTrackId || !queue) return null;
    return queue.find((item) => item.id === playbackTrackId) || null;
  }, [playbackTrackId, queue]);

  /* ═══════════════════════════════════════════════════════ */
  /*  PHASE: Name entry                                      */
  /* ═══════════════════════════════════════════════════════ */
  if (phase === 'name') {
    return (
      <ConfigProvider theme={antTheme}>
        <div className="join-screen">
          <InstallPrompt />
          <div className="w-full max-w-sm mx-4">
            <div className="text-center mb-6">
              <SoundOutlined className="text-5xl text-blue-500" />
              <Title level={2} className="!mt-3 !mb-1 !text-white">JamRoom</Title>
              <Text type="secondary">Listen together in real-time</Text>
            </div>
            <div className="flex flex-col gap-3 bg-[#1f1f1f] rounded-2xl p-6 border border-[#303030] shadow-2xl">
              <Text className="!text-gray-300 text-sm">What should we call you?</Text>
              <Input
                size="large"
                prefix={<UserOutlined />}
                placeholder="Your display name"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onPressEnter={handleNameSubmit}
                autoFocus
              />
              <Button
                type="primary"
                size="large"
                block
                disabled={!nameInput.trim()}
                onClick={handleNameSubmit}
                style={{ height: 48, fontWeight: 600 }}
              >
                Continue →
              </Button>
            </div>
          </div>
        </div>
      </ConfigProvider>
    );
  }

  /* ═══════════════════════════════════════════════════════ */
  /*  PHASE: Lobby                                           */
  /* ═══════════════════════════════════════════════════════ */
  if (phase === 'lobby' || phase === 'password') {
    return (
      <ConfigProvider theme={antTheme}>
        <>
          <InstallPrompt />
          <LobbyScreen
            lobbyRooms={lobbyRooms}
            loading={!connected}
            onJoin={handleJoinRequest}
            onCreate={handleCreate}
          />
          {phase === 'password' && pendingRoom && (
            <PasswordModal
              room={pendingRoom}
              userName={userName}
              onConfirm={handlePasswordConfirm}
              onCancel={() => { setPendingRoom(null); setPhase('lobby'); }}
            />
          )}
        </>
      </ConfigProvider>
    );
  }

  /* ═══════════════════════════════════════════════════════ */
  /*  PHASE: Room                                            */
  /* ═══════════════════════════════════════════════════════ */
  const users = roomState?.users || [];
  const allowMemberControl = roomState?.settings?.allowMemberControl ?? true;

  const userList = (
    <div>
      {/* Permissions toggle — host only */}
      {isHost && (
        <div className="mb-3 px-1">
          <Button
            size="small"
            type={allowMemberControl ? 'default' : 'primary'}
            icon={allowMemberControl ? <UnlockOutlined /> : <LockOutlined />}
            onClick={handleTogglePermissions}
            className="w-full !text-xs"
          >
            {allowMemberControl ? 'Lock controls (host only)' : 'Unlock controls (everyone)'}
          </Button>
        </div>
      )}
      {!isHost && (
        <div className="mb-3 px-1">
          <Tag
            icon={allowMemberControl ? <UnlockOutlined /> : <LockOutlined />}
            color={allowMemberControl ? 'green' : 'orange'}
            className="!text-xs w-full text-center justify-center"
          >
            {allowMemberControl ? 'Everyone can control playback' : 'Host controls only'}
          </Tag>
        </div>
      )}
      <Divider style={{ margin: '0 0 8px 0' }} />
      <div className="panel-scroll" style={{ maxHeight: 'calc(100dvh - 260px)' }}>
        {users.map((u) => (
          <div
            key={u.socketId}
            className="flex items-center gap-2.5 py-2 px-1 rounded-lg"
            style={{ background: u.socketId === mySocketId ? 'rgba(22,119,255,0.08)' : 'transparent' }}
          >
            <Avatar size="small" icon={<UserOutlined />} />
            <Text className="flex-1 truncate !text-sm" style={{ color: '#e0e0e0' }}>{u.name}</Text>
            {u.socketId === roomState?.hostId && (
              <CrownOutlined style={{ color: '#faad14', fontSize: 13 }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const tabItems = [
    {
      key: 'search',
      label: <span><SearchOutlined /> <span className="hidden sm:inline">Search</span></span>,
      children: (
        <div className="p-2 sm:p-4 h-[calc(100dvh-10rem)] sm:h-[calc(100dvh-11rem)] overflow-y-auto">
          <SearchPanel results={results} loading={loading} error={searchError} onSearch={search} onAdd={handleAddTrack} />
        </div>
      )
    },
    {
      key: 'queue',
      label: (
        <span>
          <UnorderedListOutlined /> <span className="hidden sm:inline">Queue</span>
          {roomState?.queue?.length > 0 && (
            <Badge count={roomState.queue.length} size="small" offset={[6, -2]} style={{ backgroundColor: '#1677ff' }} />
          )}
        </span>
      ),
      children: (
        <div className="p-2 sm:p-4 h-[calc(100dvh-10rem)] sm:h-[calc(100dvh-11rem)] overflow-y-auto">
          <QueuePanel
            queue={roomState?.queue || []}
            currentTrackId={roomState?.playback?.trackId}
            isHost={isHost}
            canControl={canControl}
            onSkip={handleSkip}
            onPlay={(trackItemId) => playTrack(roomId, trackItemId)}
            onRemove={(trackItemId) => removeFromQueue(roomId, trackItemId)}
          />
        </div>
      )
    },
    {
      key: 'chat',
      label: (
        <span>
          <MessageOutlined /> <span className="hidden sm:inline">Chat</span>
          {unreadChat > 0 && (
            <Badge count={unreadChat} size="small" offset={[6, -2]} style={{ backgroundColor: '#52c41a' }} />
          )}
        </span>
      ),
      children: (
        <div className="p-2 sm:p-4 h-[calc(100dvh-10rem)] sm:h-[calc(100dvh-11rem)]">
          <ChatPanel messages={chatMessages} onSend={handleSendChat} />
        </div>
      )
    }
  ];

  return (
    <ConfigProvider theme={antTheme}>
      <div className="flex flex-col h-dvh bg-[#141414]">
        <InstallPrompt />

        {/* Header */}
        <header className="safe-top flex items-center justify-between px-3 sm:px-6 h-12 sm:h-14 bg-[#1f1f1f] border-b border-[#303030] shrink-0">
          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
            <Button
              type="text"
              className="md:!hidden !px-1.5"
              icon={<MenuOutlined style={{ color: '#fff', fontSize: 18 }} />}
              onClick={() => setDrawerOpen(true)}
            />
            <SoundOutlined className="text-blue-500 text-lg hidden sm:block" />
            <span className="text-white font-bold text-sm sm:text-lg truncate">JamRoom</span>
            <Tag color="blue" className="hidden md:inline-flex max-w-[120px] truncate">
              {roomState?.name || roomId}
            </Tag>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {isHost && (
              <Tag color="gold" className="!text-[10px] sm:!text-xs !mx-0 !px-1 sm:!px-2">
                <CrownOutlined />
                <span className="hidden sm:inline ml-1">Host</span>
              </Tag>
            )}
            <Tag color={connected ? 'green' : 'red'} className="!text-[10px] sm:!text-xs !mx-0 !px-1 sm:!px-2">
              {connected ? '●' : '○'}<span className="hidden sm:inline ml-1">{connected ? 'Live' : 'Offline'}</span>
            </Tag>
            <span className="text-gray-400 text-xs sm:text-sm truncate max-w-[60px] sm:max-w-none pl-1">{userName}</span>
          </div>
        </header>

        {error && <Alert message={error} type="error" showIcon closable banner style={{ borderRadius: 0 }} />}

        <div className="flex flex-1 min-h-0">
          {/* Desktop sidebar */}
          <aside className="hidden md:flex flex-col w-52 lg:w-56 bg-[#1f1f1f] border-r border-[#303030] p-3 shrink-0">
            <Text strong style={{ color: '#999', textTransform: 'uppercase', fontSize: 11, letterSpacing: 1 }}>
              In Room — {users.length}
            </Text>
            <div className="mt-2">{userList}</div>
          </aside>

          {/* Mobile drawer */}
          <Drawer
            title={<span className="text-white">People in Room ({users.length})</span>}
            placement="left"
            onClose={() => setDrawerOpen(false)}
            open={drawerOpen}
            width={260}
            styles={{
              header: { background: '#1f1f1f', borderBottom: '1px solid #303030' },
              body: { background: '#1f1f1f', padding: '12px' }
            }}
          >
            {userList}
          </Drawer>

          <main className="flex-1 min-w-0 overflow-hidden">
            <Tabs
              activeKey={activeTab}
              onChange={handleTabChange}
              items={tabItems}
              style={{ height: '100%' }}
              tabBarStyle={{ paddingLeft: 12, marginBottom: 0 }}
              size="small"
            />
          </main>
        </div>

        <PlayerBar
          currentItem={currentItem}
          playbackState={roomState?.playback}
          canControl={canControl}
          isHost={isHost}
          onPlayPause={handlePlayPause}
          onSkip={handleSkip}
          onPositionUpdate={handlePositionUpdate}
        />
      </div>
    </ConfigProvider>
  );
}
