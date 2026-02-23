import React from 'react';
import { List, Button, Typography, Tag, Empty, Avatar, Tooltip } from 'antd';
import {
  DeleteOutlined,
  CaretRightOutlined,
  SoundOutlined,
  PlayCircleOutlined,
  CloseOutlined
} from '@ant-design/icons';

const { Text } = Typography;

/**
 * QueuePanel
 *
 * Props:
 *   canControl    — true if user can play/skip
 *   onPlay(id)    — jump to any track in the queue
 *   onRemove(id)  — remove a track from the queue
 *   onSkip        — advance to next track
 */
export default function QueuePanel({ queue, currentTrackId, canControl, onPlay, onRemove, onSkip }) {
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
          const actions = [];

          // Play button — show on non-active tracks (if canControl)
          if (!isActive && canControl) {
            actions.push(
              <Tooltip key="play" title="Play now">
                <Button
                  size="small"
                  type="primary"
                  ghost
                  icon={<PlayCircleOutlined />}
                  onClick={() => onPlay?.(item.id)}
                />
              </Tooltip>
            );
          }

          // Skip button — show on active track (if canControl)
          if (isActive && canControl) {
            actions.push(
              <Tooltip key="skip" title="Skip to next">
                <Button
                  size="small"
                  icon={<CaretRightOutlined />}
                  onClick={onSkip}
                >
                  <span className="hidden sm:inline">Skip</span>
                </Button>
              </Tooltip>
            );
          }

          // Remove button — always available for any track
          actions.push(
            <Tooltip key="remove" title="Remove from queue">
              <Button
                size="small"
                danger
                icon={<CloseOutlined />}
                onClick={() => onRemove?.(item.id)}
              />
            </Tooltip>
          );

          return (
            <List.Item
              className={`${isActive ? 'queue-item-active' : ''} !px-2 sm:!px-3 !py-2`}
              actions={actions}
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
                  <Text
                    className="!block !text-sm truncate cursor-pointer hover:!text-blue-400 transition-colors"
                    style={{ color: isActive ? '#1677ff' : '#e0e0e0' }}
                    onClick={() => canControl && !isActive && onPlay?.(item.id)}
                  >
                    {isActive && <SoundOutlined className="mr-1 animate-pulse" />}
                    {item.track.title}
                  </Text>
                }
                description={
                  <span className="flex items-center gap-1 overflow-hidden">
                    <Text type="secondary" className="!text-xs truncate">
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
