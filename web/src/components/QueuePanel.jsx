import React from 'react';
import { List, Button, Typography, Tag, Empty, Avatar } from 'antd';
import { DeleteOutlined, CaretRightOutlined, SoundOutlined } from '@ant-design/icons';

const { Text } = Typography;

export default function QueuePanel({ queue, currentTrackId, isHost, onSkip }) {
  if (!queue || queue.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="Queue is empty — search and add tracks!"
        style={{ marginTop: 40 }}
      />
    );
  }

  return (
    <div className="panel-scroll" style={{ height: '100%' }}>
      <List
        dataSource={queue}
        renderItem={(item, index) => {
          const isActive = item.id === currentTrackId;
          return (
            <List.Item
              className={isActive ? 'queue-item-active' : ''}
              style={{ padding: '10px 12px' }}
              actions={
                isHost && isActive
                  ? [
                      <Button
                        key="skip"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={onSkip}
                      >
                        Skip
                      </Button>
                    ]
                  : []
              }
            >
              <List.Item.Meta
                avatar={
                  isActive ? (
                    <Avatar
                      size={40}
                      icon={<SoundOutlined />}
                      style={{ background: '#1677ff' }}
                    />
                  ) : (
                    <Avatar
                      shape="square"
                      size={40}
                      src={item.track.artworkUrl?.replace('-large', '-t200x200')}
                      style={{ borderRadius: 6 }}
                    />
                  )
                }
                title={
                  <Text style={{ color: isActive ? '#1677ff' : '#e0e0e0' }}>
                    {isActive && <CaretRightOutlined style={{ marginRight: 6 }} />}
                    {item.track.title}
                  </Text>
                }
                description={
                  <span>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {item.track.user} · Added by{' '}
                    </Text>
                    <Tag color="blue" style={{ fontSize: 11 }}>
                      {item.addedBy}
                    </Tag>
                  </span>
                }
              />
            </List.Item>
          );
        }}
      />
    </div>
  );
}
