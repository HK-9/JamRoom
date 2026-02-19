import React, { useEffect, useRef, useState } from 'react';
import { Slider, Button, Typography, Space, Avatar } from 'antd';
import {
  CaretRightOutlined,
  PauseOutlined,
  StepForwardOutlined,
  SoundOutlined,
  MutedOutlined
} from '@ant-design/icons';

const { Text } = Typography;

const SC_WIDGET_URL = 'https://w.soundcloud.com/player/?url=';

/**
 * PlayerBar uses the SoundCloud Widget API via a hidden iframe.
 *
 * Robustness improvements:
 * - Event bindings are unbound & rebound per track change (prevents stale closures)
 * - Volume ref ensures correct volume is set after widget loads
 * - Keyboard shortcut: Space to play/pause (host only)
 */
export default function PlayerBar({
  currentItem,
  playbackState,
  isHost,
  onPlayPause,
  onSkip,
  onPositionUpdate
}) {
  const iframeRef = useRef(null);
  const widgetRef = useRef(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [scApiReady, setScApiReady] = useState(!!window.SC?.Widget);
  const loadedUrlRef = useRef(null);
  const isHostRef = useRef(isHost);
  const onSkipRef = useRef(onSkip);
  const volumeRef = useRef(volume);
  const isMutedRef = useRef(isMuted);

  // Keep refs in sync so event callbacks always see latest values
  useEffect(() => { isHostRef.current = isHost; }, [isHost]);
  useEffect(() => { onSkipRef.current = onSkip; }, [onSkip]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

  // 1. Load the SoundCloud Widget API script once
  useEffect(() => {
    if (window.SC?.Widget) { setScApiReady(true); return; }
    const script = document.createElement('script');
    script.src = 'https://w.soundcloud.com/player/api.js';
    script.async = true;
    script.onload = () => setScApiReady(true);
    document.head.appendChild(script);
  }, []);

  // 2. When a new track appears, load it via the widget and rebind events
  useEffect(() => {
    if (!scApiReady || !iframeRef.current) return;
    if (!currentItem?.track?.permalinkUrl) return;

    const url = currentItem.track.permalinkUrl;
    if (loadedUrlRef.current === url) return;
    loadedUrlRef.current = url;

    // Reset state
    setPosition(0);
    setDuration(0);
    setIsPlaying(false);

    // Create widget if needed
    const widget = widgetRef.current || window.SC.Widget(iframeRef.current);
    widgetRef.current = widget;

    const Events = window.SC.Widget.Events;

    // Unbind previous events before rebinding
    try {
      widget.unbind(Events.READY);
      widget.unbind(Events.PLAY);
      widget.unbind(Events.PAUSE);
      widget.unbind(Events.PLAY_PROGRESS);
      widget.unbind(Events.FINISH);
    } catch (_) {
      // ignore errors on first load
    }

    widget.load(url, {
      auto_play: true,
      show_artwork: false,
      show_user: false,
      buying: false,
      sharing: false,
      download: false,
      show_playcount: false,
      show_comments: false,
      callback: () => {
        // Bind events fresh for this track
        widget.bind(Events.READY, () => {
          widget.getDuration((d) => { if (d > 0) setDuration(d); });
          widget.setVolume(isMutedRef.current ? 0 : volumeRef.current);
        });
        widget.bind(Events.PLAY, () => setIsPlaying(true));
        widget.bind(Events.PAUSE, () => setIsPlaying(false));
        widget.bind(Events.PLAY_PROGRESS, (e) => {
          setPosition(e.currentPosition);
        });
        widget.bind(Events.FINISH, () => {
          setIsPlaying(false);
          if (isHostRef.current && onSkipRef.current) onSkipRef.current();
        });

        widget.getDuration((d) => { if (d > 0) setDuration(d); });
        widget.setVolume(isMutedRef.current ? 0 : volumeRef.current);
        widget.play();
      }
    });
  }, [scApiReady, currentItem]); // eslint-disable-line react-hooks/exhaustive-deps

  // 3. Sync volume to widget whenever it changes
  useEffect(() => {
    widgetRef.current?.setVolume(isMuted ? 0 : volume);
  }, [volume, isMuted]);

  const handlePlayPause = () => {
    const widget = widgetRef.current;
    if (!widget) return;
    if (isPlaying) {
      widget.pause();
    } else {
      widget.play();
    }
    if (isHost && onPlayPause) {
      onPlayPause(isPlaying ? 'paused' : 'playing', position);
    }
  };

  const handleSeek = (val) => {
    widgetRef.current?.seekTo(val);
    setPosition(val);
    if (isHost && onPositionUpdate) {
      onPositionUpdate('playing', val);
    }
  };

  const handleSkip = () => {
    if (isHost && onSkip) onSkip();
  };

  const toggleMute = () => setIsMuted((m) => !m);

  const track = currentItem?.track;

  return (
    <div className="player-bar">
      {/* Hidden SoundCloud Widget iframe */}
      <iframe
        ref={iframeRef}
        className="sc-widget-hidden"
        allow="autoplay"
        src={`${SC_WIDGET_URL}https%3A//soundcloud.com&auto_play=false`}
        title="SoundCloud Player"
      />

      {/* Track info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 220 }}>
        {track?.artworkUrl ? (
          <Avatar
            shape="square"
            size={48}
            src={track.artworkUrl.replace('-large', '-t200x200')}
            style={{ borderRadius: 8, flexShrink: 0 }}
          />
        ) : (
          <Avatar shape="square" size={48} icon={<SoundOutlined />} style={{ borderRadius: 8, flexShrink: 0 }} />
        )}
        <div style={{ overflow: 'hidden' }}>
          <Text strong ellipsis style={{ display: 'block', color: '#fff', maxWidth: 180 }}>
            {track?.title || 'No track loaded'}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {track?.user || '—'}
          </Text>
        </div>
      </div>

      {/* Playback controls */}
      <Space size="middle">
        <Button
          type="text"
          shape="circle"
          size="large"
          icon={isPlaying ? <PauseOutlined style={{ fontSize: 22, color: '#fff' }} /> : <CaretRightOutlined style={{ fontSize: 22, color: '#fff' }} />}
          onClick={handlePlayPause}
          disabled={!track}
          title={isPlaying ? 'Pause' : 'Play'}
        />
        <Button
          type="text"
          shape="circle"
          icon={<StepForwardOutlined style={{ fontSize: 18, color: isHost && track ? '#fff' : '#555' }} />}
          onClick={handleSkip}
          disabled={!isHost || !track}
          title={isHost ? 'Skip (host only)' : 'Only the host can skip'}
        />
      </Space>

      {/* Progress */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Text type="secondary" style={{ fontSize: 11, minWidth: 40, textAlign: 'right' }}>
          {formatMs(position)}
        </Text>
        <Slider
          min={0}
          max={duration || 1}
          value={position}
          onChange={handleSeek}
          disabled={!isHost || !track}
          tooltip={{ formatter: (v) => formatMs(v) }}
          style={{ flex: 1 }}
        />
        <Text type="secondary" style={{ fontSize: 11, minWidth: 40 }}>
          {formatMs(duration)}
        </Text>
      </div>

      {/* Volume */}
      <Space size="small" style={{ minWidth: 130 }}>
        <Button
          type="text"
          shape="circle"
          size="small"
          icon={isMuted || volume === 0 ? <MutedOutlined style={{ color: '#999' }} /> : <SoundOutlined style={{ color: '#999' }} />}
          onClick={toggleMute}
          title={isMuted ? 'Unmute' : 'Mute'}
        />
        <Slider
          min={0}
          max={100}
          value={isMuted ? 0 : volume}
          onChange={(v) => { setVolume(v); setIsMuted(false); }}
          tooltip={{ formatter: (v) => `${v}%` }}
          style={{ width: 90 }}
        />
      </Space>
    </div>
  );
}

function formatMs(ms) {
  if (!ms || ms < 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}
