import { useCallback, useEffect, useRef } from 'react';

/**
 * useNotifications — thin wrapper around the browser Notification API.
 *
 * • Requests permission once on mount.
 * • Exposes `notify(title, body, icon?)` that only fires when the tab is hidden.
 */
export default function useNotifications() {
    const permissionRef = useRef(
        typeof Notification !== 'undefined' ? Notification.permission : 'denied'
    );

    // Ask for permission once
    useEffect(() => {
        if (typeof Notification === 'undefined') return;
        if (Notification.permission === 'default') {
            Notification.requestPermission().then((p) => {
                permissionRef.current = p;
            });
        }
    }, []);

    const notify = useCallback((title, body, icon) => {
        if (typeof Notification === 'undefined') return;
        if (permissionRef.current !== 'granted') return;
        if (!document.hidden) return; // only when tab is not focused

        try {
            new Notification(title, {
                body,
                icon: icon || '/icons/icon-192.png',
                badge: '/icons/icon-192.png',
                tag: `jamroom-${Date.now()}`, // unique tag so notifications stack
                silent: false,
            });
        } catch (_) {
            // Notification constructor can throw in some environments
        }
    }, []);

    return { notify };
}
