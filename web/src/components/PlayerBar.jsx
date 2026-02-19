import React, { useEffect, useRef, useState } from 'react';
import { Slider, Button, Typography, Avatar } from 'antd';
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
 * PlayerBar
 *
 * Props:
 *   canControl — true if this user can play/pause/skip (host OR allowMemberControl)
 *   isHost     — true only if this user is the room host
 *
 * "player:sync" from server is handled in useSocket → roomState.playback,
 * so we watch playbackState to stay in sync with other members' actions.
 */
export default function PlayerBar({
  currentItem,
  playbackState,
  canControl,
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
  const canControlRef = useRef(canControl);
  const onSkipRef = useRef(onSkip);
  const volumeRef = useRef(volume);
  const isMutedRef = useRef(isMuted);

  useEffect(() => { canControlRef.current = canControl; }, [canControl]);
  useEffect(() => { onSkipRef.current = onSkip; }, [onSkip]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

  // 1. Load SC Widget API
  useEffect(() => {
    if (window.SC?.Widget) { setScApiReady(true); return; }
    const s = document.createElement('script');
    s.src = 'https://w.soundcloud.com/player/api.js';
    s.async = true;
    s.onload = () => setScApiReady(true);
    document.head.appendChild(s);
  }, []);

  // 2. Load track when currentItem changes
  useEffect(() => {
    if (!scApiReady || !iframeRef.current || !currentItem?.track?.permalinkUrl) return;
    const url = currentItem.track.permalinkUrl;
    if (loadedUrlRef.current === url) return;
    loadedUrlRef.current = url;

    setPosition(0); setDuration(0); setIsPlaying(false);

    const widget = widgetRef.current || window.SC.Widget(iframeRef.current);
    widgetRef.current = widget;
    const E = window.SC.Widget.Events;

    try {
      widget.unbind(E.READY); widget.unbind(E.PLAY); widget.unbind(E.PAUSE);
      widget.unbind(E.PLAY_PROGRESS); widget.unbind(E.FINISH);
    } catch (_) { }

    widget.load(url, {
      auto_play: true, show_artwork: false, show_user: false,
      buying: false, sharing: false, download: false,
      show_playcount: false, show_comments: false,
      callback: () => {
        widget.bind(E.READY, () => {
          widget.getDuration((d) => { if (d > 0) setDuration(d); });
          widget.setVolume(isMutedRef.current ? 0 : volumeRef.current);
        });
        widget.bind(E.PLAY, () => setIsPlaying(true));
        widget.bind(E.PAUSE, () => setIsPlaying(false));
        widget.bind(E.PLAY_PROGRESS, (e) => setPosition(e.currentPosition));
        widget.bind(E.FINISH, () => {
          setIsPlaying(false);
          // Only the host auto-skips on finish to prevent N simultaneous skips
          if (canControlRef.current && onSkipRef.current) onSkipRef.current();
        });
        widget.getDuration((d) => { if (d > 0) setDuration(d); });
        widget.setVolume(isMutedRef.current ? 0 : volumeRef.current);
        widget.play();
      }
    });
  }, [scApiReady, currentItem]); // eslint-disable-line

  // 3. Sync when server playback state changes (from another member's action)
  const lastSyncAt = useRef(0);
  useEffect(() => {
    if (!playbackState || !widgetRef.current) return;
    const now = Date.now();
    // Debounce: don't react to our own updates
    if (now - lastSyncAt.current < 300) return;
    lastSyncAt.current = now;

    const widget = widgetRef.current;
    if (playbackState.state === 'playing') {
      widget.play();
      if (Math.abs((playbackState.positionMs || 0) - position) > 2000) {
        widget.seekTo(playbackState.positionMs || 0);
      }
    } else {
      widget.pause();
    }
  }, [playbackState]); // eslint-disable-line

  // 4. Volume sync
  useEffect(() => { widgetRef.current?.setVolume(isMuted ? 0 : volume); }, [volume, isMuted]);

  const handlePlayPause = () => {
    const widget = widgetRef.current;
    if (!widget || !canControl) return;
    if (isPlaying) widget.pause(); else widget.play();
    if (onPlayPause) onPlayPause(isPlaying ? 'paused' : 'playing', position);
  };

  const handleSeek = (val) => {
    if (!canControl) return;
    widgetRef.current?.seekTo(val);
    setPosition(val);
    if (onPositionUpdate) onPositionUpdate('playing', val);
  };

  const handleSkip = () => { if (canControl && onSkip) onSkip(); };
  const toggleMute = () => setIsMuted((m) => !m);

  const track = currentItem?.track;

  return (
    <div className="safe-bottom bg-[#1a1a2e] border-t border-[#303030] px-2 sm:px-4 lg:px-6 flex items-center h-16 sm:h-20 gap-2 sm:gap-4 shrink-0">
      <iframe
        ref={iframeRef}
        className="sc-widget-hidden"
        allow="autoplay"
        src={`${SC_WIDGET_URL}https%3A//soundcloud.com&auto_play=false`}
        title="SoundCloud Player"
      />

      {/* Track info */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0 sm:w-44 lg:w-56">
        {track?.artworkUrl ? (
          <Avatar shape="square" size={40} src={track.artworkUrl.replace('-large', '-t200x200')} className="!rounded-lg shrink-0" />
        ) : (
          <Avatar shape="square" size={40} icon={<SoundOutlined />} className="!rounded-lg shrink-0" />
        )}
        <div className="min-w-0 hidden sm:block">
          <Text strong ellipsis className="!block !text-white !text-sm">{track?.title || 'No track loaded'}</Text>
          <Text type="secondary" className="!text-xs">{track?.user || '—'}</Text>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          type="text" shape="circle" size="large"
          icon={isPlaying
            ? <PauseOutlined className="!text-lg sm:!text-xl" style={{ color: canControl ? '#fff' : '#555' }} />
            : <CaretRightOutlined className="!text-lg sm:!text-xl" style={{ color: canControl ? '#fff' : '#555' }} />}
          onClick={handlePlayPause}
          disabled={!track || !canControl}
          title={canControl ? (isPlaying ? 'Pause' : 'Play') : 'Host controls only'}
        />
        <Button
          type="text" shape="circle"
          icon={<StepForwardOutlined style={{ fontSize: 16, color: canControl && track ? '#fff' : '#555' }} />}
          onClick={handleSkip}
          disabled={!track || !canControl}
          title={canControl ? 'Skip' : 'Host controls only'}
        />
      </div>

      {/* Progress */}
      <div className="flex-1 flex items-center gap-1.5 sm:gap-2 min-w-0">
        <span className="text-[10px] sm:text-xs text-gray-400 w-8 sm:w-10 text-right shrink-0 hidden sm:block">
          {formatMs(position)}
        </span>
        <Slider
          min={0} max={duration || 1} value={position}
          onChange={handleSeek}
          disabled={!canControl || !track}
          tooltip={{ formatter: (v) => formatMs(v) }}
          className="flex-1"
        />
        <span className="text-[10px] sm:text-xs text-gray-400 w-8 sm:w-10 shrink-0 hidden sm:block">
          {formatMs(duration)}
        </span>
      </div>

      {/* Volume — desktop only */}
      <div className="hidden lg:flex items-center gap-1 w-32 shrink-0">
        <Button
          type="text" shape="circle" size="small"
          icon={isMuted || volume === 0
            ? <MutedOutlined style={{ color: '#999' }} />
            : <SoundOutlined style={{ color: '#999' }} />}
          onClick={toggleMute}
        />
        <Slider
          min={0} max={100} value={isMuted ? 0 : volume}
          onChange={(v) => { setVolume(v); setIsMuted(false); }}
          tooltip={{ formatter: (v) => `${v}%` }}
          className="flex-1"
        />
      </div>
    </div>
  );
}

function formatMs(ms) {
  if (!ms || ms < 0) return '0:00';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}
