import React, { useState, useEffect, useRef } from 'react';
import { Button, Typography } from 'antd';
import { DownloadOutlined, CloseOutlined, SoundOutlined } from '@ant-design/icons';

const { Text } = Typography;
const DISMISS_KEY = 'jamroom-install-dismissed';
const DISMISS_DAYS = 7;

export default function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [visible, setVisible] = useState(false);
    const promptRef = useRef(null);

    useEffect(() => {
        // Check if dismissed recently
        const dismissed = localStorage.getItem(DISMISS_KEY);
        if (dismissed) {
            const dismissedAt = parseInt(dismissed, 10);
            if (Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000) return;
        }

        const handler = (e) => {
            e.preventDefault();
            promptRef.current = e;
            setDeferredPrompt(e);
            setVisible(true);
        };

        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        const prompt = promptRef.current;
        if (!prompt) return;
        prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === 'accepted') {
            setVisible(false);
        }
        promptRef.current = null;
        setDeferredPrompt(null);
    };

    const handleDismiss = () => {
        setVisible(false);
        localStorage.setItem(DISMISS_KEY, Date.now().toString());
        promptRef.current = null;
        setDeferredPrompt(null);
    };

    if (!visible || !deferredPrompt) return null;

    return (
        <div
            className="fixed bottom-0 left-0 right-0 z-[9999] safe-bottom"
            style={{
                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                borderTop: '1px solid #303050',
            }}
        >
            <div className="flex items-center gap-3 px-4 py-3 max-w-lg mx-auto">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                    <SoundOutlined style={{ fontSize: 20, color: '#fff' }} />
                </div>
                <div className="flex-1 min-w-0">
                    <Text strong className="!text-white !text-sm !block">Install JamRoom</Text>
                    <Text className="!text-gray-400 !text-xs !block">Get the full app experience</Text>
                </div>
                <Button
                    type="primary"
                    size="small"
                    icon={<DownloadOutlined />}
                    onClick={handleInstall}
                    style={{ fontWeight: 600 }}
                >
                    Install
                </Button>
                <Button
                    type="text"
                    size="small"
                    icon={<CloseOutlined style={{ color: '#999' }} />}
                    onClick={handleDismiss}
                />
            </div>
        </div>
    );
}
