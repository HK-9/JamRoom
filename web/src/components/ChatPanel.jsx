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
    <div className="flex flex-col h-full">
      <div className="panel-scroll flex-1 py-1 sm:py-2">
        {messages.length === 0 && (
          <Text type="secondary" className="block text-center p-3 text-sm">
            No messages yet. Say hi! 👋
          </Text>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="chat-msg px-1">
            <span className="chat-msg-user">{msg.user}</span>
            <span style={{ color: '#e0e0e0' }}>{msg.text}</span>
            <span className="chat-msg-time hidden sm:inline">
              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 pt-2">
        <Input
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPressEnter={handleSend}
          className="flex-1"
        />
        <Button type="primary" icon={<SendOutlined />} onClick={handleSend} disabled={!text.trim()}>
          <span className="hidden sm:inline">Send</span>
        </Button>
      </div>
    </div>
  );
}
