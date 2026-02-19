import React, { useState } from 'react';
import { Input, List, Button, Avatar, Typography, Empty, Spin, Alert } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';

const { Text } = Typography;
const { Search } = Input;

export default function SearchPanel({ onSearch, results, loading, error, onAdd }) {
  const [query, setQuery] = useState('');

  const handleSearch = (value) => {
    const q = (value || query).trim();
    if (q) onSearch(q);
  };

  return (
    <div className="flex flex-col h-full">
      <Search
        placeholder="Search SoundCloud tracks..."
        enterButton={<><SearchOutlined /> <span className="hidden sm:inline">Search</span></>}
        size="large"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onSearch={handleSearch}
        loading={loading}
        className="mb-2 sm:mb-3"
      />

      {error && (
        <Alert message={error} type="error" showIcon closable className="mb-2 sm:mb-3" />
      )}

      <div className="panel-scroll flex-1">
        {loading && (
          <div className="text-center py-10">
            <Spin size="large" />
          </div>
        )}

        {!loading && results.length === 0 && (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Search for tracks to add to the queue"
          />
        )}

        {!loading && results.length > 0 && (
          <List
            dataSource={results}
            renderItem={(track) => (
              <List.Item
                className="search-result-item !px-2 sm:!px-3 !py-2 cursor-pointer"
                actions={[
                  <Button
                    key="add"
                    type="primary"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => onAdd(track)}
                  >
                    <span className="hidden sm:inline">Add</span>
                  </Button>
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar
                      shape="square"
                      size={40}
                      src={track.artworkUrl?.replace('-large', '-t200x200')}
                      className="!rounded-md"
                    />
                  }
                  title={<Text className="!text-sm truncate !text-gray-200">{track.title}</Text>}
                  description={
                    <Text type="secondary" className="!text-xs">
                      {track.user} · {formatDuration(track.durationMs)}
                    </Text>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </div>
    </div>
  );
}

function formatDuration(ms) {
  if (!ms || ms < 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}
