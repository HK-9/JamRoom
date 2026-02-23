import React, { useEffect, useRef, useState } from 'react';
import { Slider, Button, Typography, Avatar, Spin } from 'antd';
import {
  CaretRightOutlined,
  PauseOutlined,
  StepForwardOutlined,
  SoundOutlined,
  MutedOutlined,
  LoadingOutlined
} from '@ant-design/icons';

const { Text } = Typography;
const SC_WIDGET_URL = 'https://w.soundcloud.com/player/?url=';

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
  const [isLoading, setIsLoading] = useState(false);        // ← new
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

  // 2. Load track ONLY when the permalink URL actually changes
  const currentUrl = currentItem?.track?.permalinkUrl;
  useEffect(() => {
    if (!scApiReady || !iframeRef.current || !currentUrl) return;
    if (loadedUrlRef.current === currentUrl) return;      // ← same track, skip
    loadedUrlRef.current = currentUrl;

    setPosition(0);
    setDuration(0);
    setIsPlaying(false);
    setIsLoading(true);                                    // ← show spinner

    const widget = widgetRef.current || window.SC.Widget(iframeRef.current);
    widgetRef.current = widget;
    const E = window.SC.Widget.Events;

    try {
      widget.unbind(E.READY); widget.unbind(E.PLAY); widget.unbind(E.PAUSE);
      widget.unbind(E.PLAY_PROGRESS); widget.unbind(E.FINISH);
    } catch (_) { }

    widget.load(currentUrl, {
      auto_play: true, show_artwork: false, show_user: false,
      buying: false, sharing: false, download: false,
      show_playcount: false, show_comments: false,
      callback: () => {
        widget.bind(E.READY, () => {
          widget.getDuration((d) => { if (d > 0) setDuration(d); });
          widget.setVolume(isMutedRef.current ? 0 : volumeRef.current);
          setIsLoading(false);                             // ← loaded
        });
        widget.bind(E.PLAY, () => { setIsPlaying(true); setIsLoading(false); });
        widget.bind(E.PAUSE, () => setIsPlaying(false));
        widget.bind(E.PLAY_PROGRESS, (e) => setPosition(e.currentPosition));
        widget.bind(E.FINISH, () => {
          setIsPlaying(false);
          if (canControlRef.current && onSkipRef.current) onSkipRef.current();
        });
        widget.getDuration((d) => { if (d > 0) setDuration(d); });
        widget.setVolume(isMutedRef.current ? 0 : volumeRef.current);
        widget.play();
      }
    });
  }, [scApiReady, currentUrl]);    // ← depends on URL string, not object ref

  // 3. Sync ONLY from player:sync events (not room:state)
  //    playbackState changes come from both room:state & player:sync,
  //    but we only care when the actual values change.
  const lastSyncRef = useRef({ trackId: null, state: null, positionMs: 0, updatedAt: 0 });
  useEffect(() => {
    if (!playbackState || !widgetRef.current) return;
    const prev = lastSyncRef.current;

    // Ignore if nothing meaningful changed
    if (
      prev.trackId === playbackState.trackId &&
      prev.state === playbackState.state &&
      prev.updatedAt === playbackState.updatedAt
    ) return;

    lastSyncRef.current = { ...playbackState };

    // If the track changed, the load effect above handles it
    if (prev.trackId !== playbackState.trackId) return;

    // Same track — sync play/pause/seek
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
    if (!widget || !canControl || isLoading) return;
    if (isPlaying) widget.pause(); else widget.play();
    if (onPlayPause) onPlayPause(isPlaying ? 'paused' : 'playing', position);
  };

  const handleSeek = (val) => {
    if (!canControl || isLoading) return;
    widgetRef.current?.seekTo(val);
    setPosition(val);
    if (onPositionUpdate) onPositionUpdate('playing', val);
  };

  const handleSkip = () => { if (canControl && !isLoading && onSkip) onSkip(); };
  const toggleMute = () => setIsMuted((m) => !m);

  const track = currentItem?.track;
  const loadingIcon = <LoadingOutlined style={{ fontSize: 20, color: '#1677ff' }} spin />;

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
        {isLoading ? (
          <div className="w-10 h-10 flex items-center justify-center">
            <Spin indicator={loadingIcon} />
          </div>
        ) : (
          <Button
            type="text" shape="circle" size="large"
            icon={isPlaying
              ? <PauseOutlined className="!text-lg sm:!text-xl" style={{ color: canControl ? '#fff' : '#555' }} />
              : <CaretRightOutlined className="!text-lg sm:!text-xl" style={{ color: canControl ? '#fff' : '#555' }} />}
            onClick={handlePlayPause}
            disabled={!track || !canControl}
            title={canControl ? (isPlaying ? 'Pause' : 'Play') : 'Host controls only'}
          />
        )}
        <Button
          type="text" shape="circle"
          icon={<StepForwardOutlined style={{ fontSize: 16, color: canControl && track && !isLoading ? '#fff' : '#555' }} />}
          onClick={handleSkip}
          disabled={!track || !canControl || isLoading}
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
          disabled={!canControl || !track || isLoading}
          tooltip={{ formatter: (v) => formatMs(v) }}
          className="flex-1"
        />
        <span className="text-[10px] sm:text-xs text-gray-400 w-8 sm:w-10 shrink-0 hidden sm:block">
          {formatMs(duration)}
        </span>
      </div>

      {/* Volume controls */}
      <div className="flex items-center gap-1 w-20 sm:w-32 shrink-0">
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
