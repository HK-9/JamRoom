import React, { useState } from 'react';
import { Card, Input, Button, Typography, List, Avatar, Tag, Badge, Modal, Empty, Spin, Divider, Switch, Tooltip } from 'antd';
import {
    SoundOutlined,
    LockOutlined,
    UnlockOutlined,
    PlusOutlined,
    TeamOutlined,
    LoginOutlined,
    ReloadOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

export default function LobbyScreen({ lobbyRooms, loading, onJoin, onCreate }) {
    const [view, setView] = useState('browse'); // 'browse' | 'create'
    const [roomName, setRoomName] = useState('');
    const [usePassword, setUsePassword] = useState(false);
    const [password, setPassword] = useState('');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState('');

    const handleCreate = async () => {
        if (!roomName.trim()) return;
        setCreating(true);
        setCreateError('');
        try {
            await onCreate(roomName.trim(), usePassword ? password : '');
        } catch (err) {
            setCreateError(err.message || 'Failed to create room');
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="join-screen">
            <div className="w-full max-w-lg mx-4">

                {/* Header */}
                <div className="text-center mb-6">
                    <SoundOutlined className="text-5xl text-blue-500" />
                    <Title level={2} className="!mt-3 !mb-1 !text-white">JamRoom</Title>
                    <Text type="secondary">Pick a room or create your own</Text>
                </div>

                <Card
                    className="w-full"
                    style={{ background: '#1f1f1f', border: '1px solid #303030', borderRadius: 16 }}
                    bodyStyle={{ padding: '20px 24px' }}
                >
                    {/* Tab switcher */}
                    <div className="flex gap-2 mb-4">
                        <Button
                            type={view === 'browse' ? 'primary' : 'default'}
                            icon={<TeamOutlined />}
                            onClick={() => setView('browse')}
                            className="flex-1"
                        >
                            Browse Rooms
                        </Button>
                        <Button
                            type={view === 'create' ? 'primary' : 'default'}
                            icon={<PlusOutlined />}
                            onClick={() => setView('create')}
                            className="flex-1"
                        >
                            Create Room
                        </Button>
                    </div>

                    {/* ── Browse ── */}
                    {view === 'browse' && (
                        <div>
                            {loading ? (
                                <div className="text-center py-8">
                                    <Spin />
                                </div>
                            ) : lobbyRooms.length === 0 ? (
                                <Empty
                                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                                    description={<Text type="secondary">No rooms yet — create one!</Text>}
                                />
                            ) : (
                                <List
                                    dataSource={lobbyRooms}
                                    className="panel-scroll"
                                    style={{ maxHeight: 320 }}
                                    renderItem={(room) => (
                                        <List.Item
                                            className="hover:bg-[#2a2a2a] rounded-lg cursor-pointer !px-3 !py-2"
                                            onClick={() => onJoin(room)}
                                            actions={[
                                                <Button
                                                    key="join"
                                                    type="primary"
                                                    size="small"
                                                    icon={<LoginOutlined />}
                                                    onClick={(e) => { e.stopPropagation(); onJoin(room); }}
                                                >
                                                    Join
                                                </Button>
                                            ]}
                                        >
                                            <List.Item.Meta
                                                avatar={
                                                    <Avatar
                                                        icon={<SoundOutlined />}
                                                        style={{ background: '#1677ff' }}
                                                    />
                                                }
                                                title={
                                                    <span className="flex items-center gap-2">
                                                        <Text className="!text-white font-medium">{room.name}</Text>
                                                        {room.hasPassword && (
                                                            <Tooltip title="Password protected">
                                                                <LockOutlined className="text-yellow-400 text-xs" />
                                                            </Tooltip>
                                                        )}
                                                    </span>
                                                }
                                                description={
                                                    <span className="flex items-center gap-2">
                                                        <Badge
                                                            status="success"
                                                            text={
                                                                <Text type="secondary" className="!text-xs">
                                                                    {room.userCount} {room.userCount === 1 ? 'person' : 'people'}
                                                                </Text>
                                                            }
                                                        />
                                                        {!room.allowMemberControl && (
                                                            <Tag color="orange" className="!text-[10px]">Host controls</Tag>
                                                        )}
                                                    </span>
                                                }
                                            />
                                        </List.Item>
                                    )}
                                />
                            )}
                        </div>
                    )}

                    {/* ── Create ── */}
                    {view === 'create' && (
                        <div className="flex flex-col gap-3">
                            <Input
                                size="large"
                                prefix={<SoundOutlined />}
                                placeholder="Room name (e.g. Friday Vibes)"
                                value={roomName}
                                onChange={(e) => setRoomName(e.target.value)}
                                onPressEnter={handleCreate}
                                maxLength={80}
                            />

                            <div className="flex items-center justify-between px-1">
                                <div className="flex items-center gap-2">
                                    <LockOutlined className="text-gray-400" />
                                    <Text className="!text-gray-300 text-sm">Password protect</Text>
                                </div>
                                <Switch checked={usePassword} onChange={setUsePassword} size="small" />
                            </div>

                            {usePassword && (
                                <Input.Password
                                    size="large"
                                    prefix={<LockOutlined />}
                                    placeholder="Set a room password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    onPressEnter={handleCreate}
                                />
                            )}

                            {createError && (
                                <Text type="danger" className="text-sm">{createError}</Text>
                            )}

                            <Button
                                type="primary"
                                size="large"
                                block
                                loading={creating}
                                disabled={!roomName.trim() || (usePassword && !password.trim())}
                                onClick={handleCreate}
                                style={{ height: 48, fontWeight: 600 }}
                            >
                                Create & Join
                            </Button>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
