import React, { useState, useEffect, useRef } from 'react';
import { Input, Button, Typography } from 'antd';
import { SendOutlined } from '@ant-design/icons';

const { Text } = Typography;

export default function ChatPanel({ messages, onSend }) {
  const [text, setText] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (text.trim()) {
      onSend(text.trim());
      setText('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-scroll" style={{ flex: 1, padding: '8px 0' }}>
        {messages.length === 0 && (
          <Text type="secondary" style={{ padding: 12, display: 'block', textAlign: 'center' }}>
            No messages yet. Say hi! 👋
          </Text>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="chat-msg">
            <span className="chat-msg-user">{msg.user}</span>
            <span style={{ color: '#e0e0e0' }}>{msg.text}</span>
            <span className="chat-msg-time">
              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
        <Input
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPressEnter={handleSend}
          style={{ flex: 1 }}
        />
        <Button type="primary" icon={<SendOutlined />} onClick={handleSend} disabled={!text.trim()}>
          Send
        </Button>
      </div>
    </div>
  );
}
