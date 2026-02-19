import React, { useState } from 'react';
import { Modal, Input, Typography, Alert } from 'antd';
import { LockOutlined } from '@ant-design/icons';

const { Text } = Typography;

/**
 * PasswordModal — shown when a user tries to join a password-protected room.
 *
 * Props:
 *   room        — { roomId, name } the room to join
 *   userName    — the user's display name (already entered)
 *   onConfirm   — (roomId, name, password) => Promise<void>
 *   onCancel    — () => void
 */
export default function PasswordModal({ room, userName, onConfirm, onCancel }) {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleOk = async () => {
        if (!password.trim()) return;
        setLoading(true);
        setError('');
        try {
            await onConfirm(room.roomId, userName, password.trim());
        } catch (err) {
            setError(err.message || 'Wrong password, try again.');
            setPassword('');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            open
            title={
                <span className="flex items-center gap-2 text-white">
                    <LockOutlined className="text-yellow-400" />
                    Join "{room.name}"
                </span>
            }
            onOk={handleOk}
            onCancel={onCancel}
            okText="Join"
            confirmLoading={loading}
            okButtonProps={{ disabled: !password.trim() }}
            styles={{
                content: { background: '#1f1f1f', border: '1px solid #303030' },
                header: { background: '#1f1f1f', borderBottom: '1px solid #303030' },
                footer: { background: '#1f1f1f', borderTop: '1px solid #303030' },
                mask: { backdropFilter: 'blur(4px)' }
            }}
        >
            <div className="flex flex-col gap-3 py-2">
                <Text type="secondary" className="text-sm">
                    This room is password protected. Enter the password to join.
                </Text>
                <Input.Password
                    size="large"
                    prefix={<LockOutlined />}
                    placeholder="Room password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onPressEnter={handleOk}
                    autoFocus
                />
                {error && <Alert message={error} type="error" showIcon />}
            </div>
        </Modal>
    );
}
