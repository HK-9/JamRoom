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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Search
        placeholder="Search SoundCloud tracks..."
        enterButton={<><SearchOutlined /> Search</>}
        size="large"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onSearch={handleSearch}
        loading={loading}
        style={{ marginBottom: 12 }}
      />

      {error && (
        <Alert message={error} type="error" showIcon closable style={{ marginBottom: 12 }} />
      )}

      <div className="panel-scroll" style={{ flex: 1 }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 40 }}>
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
                className="search-result-item"
                style={{ padding: '8px 12px', cursor: 'pointer' }}
                actions={[
                  <Button
                    key="add"
                    type="primary"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => onAdd(track)}
                  >
                    Add
                  </Button>
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar
                      shape="square"
                      size={48}
                      src={track.artworkUrl?.replace('-large', '-t200x200')}
                      style={{ borderRadius: 6 }}
                    />
                  }
                  title={<Text style={{ color: '#e0e0e0' }}>{track.title}</Text>}
                  description={
                    <Text type="secondary" style={{ fontSize: 12 }}>
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
