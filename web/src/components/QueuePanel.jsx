import React from 'react';
import { List, Button, Typography, Tag, Empty, Avatar } from 'antd';
import { DeleteOutlined, CaretRightOutlined, SoundOutlined } from '@ant-design/icons';

const { Text } = Typography;

/**
 * QueuePanel
 *
 * Props:
 *   canControl — true if this user can skip tracks
 *   isHost     — true if user is host (only host sees the skip host controls option)
 */
export default function QueuePanel({ queue, currentTrackId, isHost, canControl, onSkip }) {
  if (!queue || queue.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="Queue is empty — search and add tracks!"
        className="!mt-10"
      />
    );
  }

  return (
    <div className="panel-scroll h-full">
      <List
        dataSource={queue}
        renderItem={(item) => {
          const isActive = item.id === currentTrackId;
          return (
            <List.Item
              className={`${isActive ? 'queue-item-active' : ''} !px-2 sm:!px-3 !py-2`}
              actions={
                isActive && canControl
                  ? [
                    <Button
                      key="skip"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={onSkip}
                    >
                      <span className="hidden sm:inline">Skip</span>
                    </Button>
                  ]
                  : []
              }
            >
              <List.Item.Meta
                avatar={
                  isActive ? (
                    <Avatar size={40} icon={<SoundOutlined />} style={{ background: '#1677ff' }} />
                  ) : (
                    <Avatar
                      shape="square"
                      size={40}
                      src={item.track.artworkUrl?.replace('-large', '-t200x200')}
                      className="!rounded-md"
                    />
                  )
                }
                title={
                  <Text className="!text-sm truncate" style={{ color: isActive ? '#1677ff' : '#e0e0e0' }}>
                    {isActive && <CaretRightOutlined className="mr-1" />}
                    {item.track.title}
                  </Text>
                }
                description={
                  <span className="flex flex-wrap items-center gap-1">
                    <Text type="secondary" className="!text-xs">
                      {item.track.user} · Added by
                    </Text>
                    <Tag color="blue" className="!text-[11px]">{item.addedBy}</Tag>
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
