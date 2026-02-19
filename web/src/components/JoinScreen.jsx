import React, { useState } from 'react';
import { Card, Input, Button, Typography, Divider } from 'antd';
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
        className="w-full max-w-sm mx-4 sm:mx-0"
        style={{
          borderRadius: 16,
          background: '#1f1f1f',
          border: '1px solid #303030',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
        }}
      >
        <div className="flex flex-col items-center gap-4 sm:gap-6 text-center">
          <div>
            <SoundOutlined className="text-4xl sm:text-5xl text-blue-500" />
            <Title level={2} className="!mt-3 !mb-1 !text-xl sm:!text-2xl" style={{ color: '#fff' }}>
              JamRoom
            </Title>
            <Text type="secondary" className="text-sm sm:text-base">Listen together in real-time</Text>
          </div>

          <Divider style={{ margin: '0' }} />

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
        </div>
      </Card>
    </div>
  );
}
