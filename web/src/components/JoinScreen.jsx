import React, { useState } from 'react';
import { Card, Input, Button, Typography, Space, Divider } from 'antd';
import { SoundOutlined, UserOutlined, HomeOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

export default function JoinScreen({ onJoin }) {
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState('demo-room');

  const handleJoin = () => {
    if (name.trim() && roomId.trim()) {
      onJoin(roomId.trim(), name.trim());
    }
  };

  return (
    <div className="join-screen">
      <Card
        style={{
          width: 420,
          borderRadius: 16,
          background: '#1f1f1f',
          border: '1px solid #303030',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%', textAlign: 'center' }}>
          <div>
            <SoundOutlined style={{ fontSize: 48, color: '#1677ff' }} />
            <Title level={2} style={{ margin: '12px 0 4px', color: '#fff' }}>
              JamRoom
            </Title>
            <Text type="secondary">Listen together in real-time</Text>
          </div>

          <Divider style={{ margin: '8px 0' }} />

          <Input
            size="large"
            prefix={<UserOutlined />}
            placeholder="Your display name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onPressEnter={handleJoin}
          />

          <Input
            size="large"
            prefix={<HomeOutlined />}
            placeholder="Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            onPressEnter={handleJoin}
          />

          <Button
            type="primary"
            size="large"
            block
            onClick={handleJoin}
            disabled={!name.trim() || !roomId.trim()}
            style={{ height: 48, fontWeight: 600, borderRadius: 10 }}
          >
            Join Room
          </Button>
        </Space>
      </Card>
    </div>
  );
}
