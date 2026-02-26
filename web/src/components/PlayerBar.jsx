import React, { useEffect, useRef, useState, useCallback } from 'react';
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
const API_BASE = import.meta.env.VITE_SERVER_URL || '';

export default function PlayerBar({
  currentItem,
  playbackState,
  canControl,
  isHost,
  onPlayPause,
  onSkip,
  onPositionUpdate
}) {
  const audioRef = useRef(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [needsInteraction, setNeedsInteraction] = useState(false);

  const loadedTrackIdRef = useRef(null);
  const isLoadingRef = useRef(false);
  const canControlRef = useRef(canControl);
  const onSkipRef = useRef(onSkip);
  const playbackStateRef = useRef(playbackState);
  const streamCacheRef = useRef(new Map());

  useEffect(() => { canControlRef.current = canControl; }, [canControl]);
  useEffect(() => { onSkipRef.current = onSkip; }, [onSkip]);
  useEffect(() => { playbackStateRef.current = playbackState; }, [playbackState]);

  // ── Audio event listeners (bound once) ──────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => { setIsPlaying(true); setNeedsInteraction(false); };
    const onPause = () => {
      // Only set paused if we're not in the middle of loading a new track
      if (!isLoadingRef.current) setIsPlaying(false);
    };
    const onTimeUpdate = () => setPosition(audio.currentTime * 1000);
    const onEnded = () => {
      setIsPlaying(false);
      if (canControlRef.current && onSkipRef.current) onSkipRef.current();
    };
    const onDurationChange = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration * 1000);
      }
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('durationchange', onDurationChange);

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('durationchange', onDurationChange);
    };
  }, []);

  // ── Volume sync ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = isMuted ? 0 : volume / 100;
  }, [volume, isMuted]);

  // ── Load track when currentItem changes ─────────────────────────────────
  const currentTrackId = currentItem?.track?.trackId;

  useEffect(() => {
    if (!currentTrackId) return;
    if (loadedTrackIdRef.current === currentTrackId) return;
    loadedTrackIdRef.current = currentTrackId;

    const audio = audioRef.current;
    if (!audio) return;

    setIsLoading(true);
    isLoadingRef.current = true;
    setPosition(0);
    setDuration(0);
    setIsPlaying(false);
    setNeedsInteraction(false);

    // Check stream URL cache
    const cached = streamCacheRef.current.get(currentTrackId);
    if (cached) {
      startAudio(audio, cached);
      return;
    }

    // Resolve stream URL from server
    fetch(`${API_BASE}/api/stream/${currentTrackId}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        if (!data.url) throw new Error('No stream URL returned');
        streamCacheRef.current.set(currentTrackId, data.url);
        // Only load if this is still the current track
        if (loadedTrackIdRef.current === currentTrackId) {
          startAudio(audio, data.url);
        }
      })
      .catch(err => {
        console.error('Stream resolution failed:', err);
        setIsLoading(false);
        isLoadingRef.current = false;
      });
  }, [currentTrackId]); // eslint-disable-line

  // ── Start audio with URL, seek to correct position, and auto-play ──────
  const startAudio = useCallback((audio, url) => {
    audio.src = url;
    audio.load();

    const ps = playbackStateRef.current;

    const onCanPlay = () => {
      audio.removeEventListener('canplay', onCanPlay);

      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration * 1000);
      }

      // Seek to correct position
      if (ps?.positionMs > 0) {
        const elapsed = ps.state === 'playing'
          ? Date.now() - (ps.updatedAt || Date.now())
          : 0;
        const seekSec = Math.min(
          ((ps.positionMs || 0) + elapsed) / 1000,
          audio.duration || Infinity
        );
        if (seekSec > 1) audio.currentTime = seekSec;
      }

      // Auto-play if room says playing
      if (ps?.state === 'playing') {
        const playPromise = audio.play();
        if (playPromise) {
          playPromise
            .then(() => {
              setIsLoading(false);
              isLoadingRef.current = false;
            })
            .catch(() => {
              // Browser blocked autoplay — show "Tap to sync"
              setNeedsInteraction(true);
              setIsLoading(false);
              isLoadingRef.current = false;
            });
        } else {
          setIsLoading(false);
          isLoadingRef.current = false;
        }
      } else {
        setIsLoading(false);
        isLoadingRef.current = false;
      }
    };

    audio.addEventListener('canplay', onCanPlay, { once: true });
  }, []);

  // ── Sync play/pause/seek from server — skip while loading ──────────────
  const lastSyncRef = useRef({ trackId: null, state: null, positionMs: 0, updatedAt: 0 });

  useEffect(() => {
    const audio = audioRef.current;
    if (!playbackState || !audio) return;

    // Don't interfere while loading
    if (isLoadingRef.current) {
      lastSyncRef.current = { ...playbackState };
      return;
    }

    const prev = lastSyncRef.current;

    // Ignore if nothing meaningful changed
    if (
      prev.trackId === playbackState.trackId &&
      prev.state === playbackState.state &&
      prev.updatedAt === playbackState.updatedAt
    ) return;

    lastSyncRef.current = { ...playbackState };

    // If track changed, the load effect handles it
    if (prev.trackId !== playbackState.trackId) return;

    // Same track — sync play/pause/seek
    if (playbackState.state === 'playing') {
      const playPromise = audio.play();
      if (playPromise) playPromise.catch(() => setNeedsInteraction(true));

      const serverPos = playbackState.positionMs || 0;
      if (Math.abs(serverPos - position) > 2000) {
        audio.currentTime = serverPos / 1000;
      }
    } else {
      audio.pause();
    }
  }, [playbackState]); // eslint-disable-line

  // ── Media Session API (lock screen / notification shade) ────────────────
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const track = currentItem?.track;
    if (track) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title || 'Unknown Track',
        artist: track.user || 'Unknown Artist',
        album: 'JamRoom',
        artwork: track.artworkUrl
          ? [
            { src: track.artworkUrl.replace('-large', '-t200x200'), sizes: '200x200', type: 'image/jpeg' },
            { src: track.artworkUrl.replace('-large', '-t500x500'), sizes: '500x500', type: 'image/jpeg' },
          ]
          : [],
      });
    }

    navigator.mediaSession.setActionHandler('play', () => {
      if (!canControlRef.current) return;
      audioRef.current?.play();
      if (onPlayPause) onPlayPause('playing', position);
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      if (!canControlRef.current) return;
      audioRef.current?.pause();
      if (onPlayPause) onPlayPause('paused', position);
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      if (canControlRef.current && onSkipRef.current) onSkipRef.current();
    });

    return () => {
      try {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
      } catch (_) { }
    };
  }, [currentItem, onPlayPause]); // eslint-disable-line

  // ── Resume playback when returning from background ──────────────────────
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      const audio = audioRef.current;
      if (!audio) return;
      const ps = playbackStateRef.current;
      if (ps?.state === 'playing' && audio.paused) {
        setTimeout(() => {
          audio.play().catch(() => { });
        }, 300);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────
  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio || !canControl || isLoading) return;
    if (isPlaying) audio.pause(); else audio.play().catch(() => { });
    if (onPlayPause) onPlayPause(isPlaying ? 'paused' : 'playing', position);
  };

  const handleTapToSync = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const ps = playbackStateRef.current;

    audio.play().then(() => {
      setNeedsInteraction(false);
      // Sync position after play succeeds
      if (ps?.positionMs > 0 && ps.state === 'playing') {
        const elapsed = Date.now() - (ps.updatedAt || Date.now());
        audio.currentTime = ((ps.positionMs + elapsed) / 1000);
      }
    }).catch(() => { });
  };

  const handleSeek = (val) => {
    if (!canControl || isLoading) return;
    const audio = audioRef.current;
    if (audio) audio.currentTime = val / 1000;
    setPosition(val);
    if (onPositionUpdate) onPositionUpdate('playing', val);
  };

  const handleSkip = () => { if (canControl && !isLoading && onSkip) onSkip(); };
  const toggleMute = () => setIsMuted((m) => !m);

  const track = currentItem?.track;
  const loadingIcon = <LoadingOutlined style={{ fontSize: 20, color: '#1677ff' }} spin />;

  return (
    <div className="safe-bottom bg-[#1a1a2e] border-t border-[#303030] px-2 sm:px-4 lg:px-6 flex items-center h-16 sm:h-20 gap-2 sm:gap-4 shrink-0">
      {/* Hidden native audio element — replaces SoundCloud widget iframe */}
      <audio ref={audioRef} preload="auto" style={{ display: 'none' }} />

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
        {needsInteraction ? (
          <Button
            type="primary"
            shape="round"
            size="large"
            icon={<CaretRightOutlined />}
            onClick={handleTapToSync}
            className="!animate-pulse"
          >
            Tap to sync
          </Button>
        ) : isLoading ? (
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
