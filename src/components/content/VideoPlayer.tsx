import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import ReactPlayer from 'react-player/lazy';
import {
  Captions,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { directusAssetUrl } from '@/lib/assets';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Course, Lesson, VideoCaptionTrack, VideoChapter } from '@/types/lms';

/** Narrow shape for optional HLS quality menu (react-player + hls.js). */
type HlsLite = {
  levels: Array<{ height: number; width: number; bitrate: number }>;
  currentLevel: number;
  on?: (event: string, fn: (e: unknown, data: { level: number }) => void) => void;
};

export type VideoPlayerProps = {
  lesson: Lesson;
  course: Pick<Course, 'title' | 'slug' | 'default_completion_threshold' | 'default_video_player_theme'>;
  initialPosition?: number;
  disableProgressTracking?: boolean;
  onProgress?: (state: { position: number; watched: number; duration: number }) => void;
  /** Fired on playhead updates (used for transcript sync). */
  onPlayheadSeconds?: (seconds: number) => void;
  onComplete?: () => void;
  autoPlayNext?: () => void;
  /** When the learner completes the video and it ends, show “Next up” if provided; otherwise show course-complete UI. */
  nextLessonTitle?: string | null;
  /** Parent-driven seek (e.g. chapter list). Bump `id` whenever seconds should apply. */
  seekRequest?: { id: number; seconds: number } | null;
};

function isMobileSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOS = /iP(ad|hone|od)/.test(ua);
  return iOS && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|mercury/i.test(ua);
}

function resolveVideoUrl(lesson: Lesson): string | undefined {
  switch (lesson.video_source) {
    case 'youtube':
      return lesson.video_youtube_id
        ? `https://www.youtube.com/watch?v=${encodeURIComponent(lesson.video_youtube_id)}`
        : undefined;
    case 'vimeo':
      return lesson.video_vimeo_id ? `https://vimeo.com/${encodeURIComponent(lesson.video_vimeo_id)}` : undefined;
    case 'directus_file': {
      const url = directusAssetUrl(lesson.video_file);
      return url;
    }
    case 'external_url':
      return lesson.video_url ?? undefined;
    default:
      return undefined;
  }
}

function captionFileId(row: VideoCaptionTrack): string | { id: string } | undefined {
  return row.file_id ?? row.file;
}

function buildFileTracks(lesson: Lesson) {
  const rows = lesson.video_captions ?? [];
  return rows
    .map((row) => {
      const file = captionFileId(row);
      const src = directusAssetUrl(file);
      if (!src) return null;
      return {
        kind: 'subtitles' as const,
        src,
        srcLang: row.language_code,
        label: row.label,
        default: Boolean(row.is_default),
      };
    })
    .filter(Boolean) as Array<{
    kind: 'subtitles';
    src: string;
    srcLang: string;
    label: string;
    default: boolean;
  }>;
}

function parseChapters(raw: Lesson['video_chapters']): VideoChapter[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((c) => typeof c?.start === 'number' && typeof c?.title === 'string');
  if (typeof raw === 'string') {
    try {
      const v = JSON.parse(raw) as unknown;
      return Array.isArray(v) ? parseChapters(v as VideoChapter[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function completionThresholdRatio(lesson: Lesson, course: Pick<Course, 'default_completion_threshold'>): number {
  const pct = lesson.completion_threshold ?? course.default_completion_threshold ?? 90;
  const clamped = Math.min(100, Math.max(50, pct));
  return clamped / 100;
}

function getHtmlVideo(el: unknown): HTMLVideoElement | null {
  if (!el) return null;
  if (el instanceof HTMLVideoElement) return el;
  return null;
}

export function VideoPlayer({
  lesson,
  course,
  initialPosition,
  disableProgressTracking = false,
  onProgress,
  onPlayheadSeconds,
  onComplete,
  autoPlayNext,
  nextLessonTitle,
  seekRequest,
}: VideoPlayerProps) {
  const location = useLocation();
  const theme = course.default_video_player_theme === 'dark' ? 'dark' : 'light';
  const shellRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<InstanceType<typeof ReactPlayer>>(null);
  const watchedSetRef = useRef(new Set<number>());
  const completionFiredRef = useRef(false);
  const progressStoppedRef = useRef(false);
  const wallMsRef = useRef(0);
  const lastPathRef = useRef(location.pathname);
  const lastSeekRequestIdRef = useRef(0);

  const [useNativeControls] = useState(() => isMobileSafari());
  const playedSecondsRef = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [playedSeconds, setPlayedSeconds] = useState(0);
  const [loaded, setLoaded] = useState(0);
  const [volume, setVolume] = useState(0.9);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [scrubbing, setScrubbing] = useState<number | null>(null);
  const [resumeToast, setResumeToast] = useState<{ until: number; at: number } | null>(null);
  const [postEnd, setPostEnd] = useState<'idle' | 'next' | 'done'>('idle');
  const [countdown, setCountdown] = useState(10);
  const [hlsLevels, setHlsLevels] = useState<Array<{ height: number; width: number; bitrate: number; index: number }>>(
    [],
  );
  const [hlsLevel, setHlsLevel] = useState<number | null>(null);
  const [captionsMenuOpen, setCaptionsMenuOpen] = useState(false);
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false);
  const [captionTrack, setCaptionTrack] = useState<'off' | string>('off');

  const url = useMemo(() => resolveVideoUrl(lesson), [lesson]);
  const chapters = useMemo(() => parseChapters(lesson.video_chapters), [lesson.video_chapters]);
  const fileTracks = useMemo(() => buildFileTracks(lesson), [lesson]);
  const supportsFileTracks = lesson.video_source === 'directus_file' || lesson.video_source === 'external_url';

  const threshold = useMemo(() => completionThresholdRatio(lesson, course), [lesson, course]);

  const flushProgress = useCallback(() => {
    if (disableProgressTracking || progressStoppedRef.current) return;
    const dur = duration || lesson.video_duration_seconds || 0;
    onProgress?.({
      position: playedSecondsRef.current,
      watched: watchedSetRef.current.size,
      duration: dur,
    });
    wallMsRef.current = 0;
  }, [disableProgressTracking, duration, lesson.video_duration_seconds, onProgress]);

  const tryMarkCompleteFromProgress = useCallback(() => {
    if (disableProgressTracking || completionFiredRef.current || progressStoppedRef.current) return;
    const dur = duration || lesson.video_duration_seconds || 0;
    if (!dur || dur <= 0) return;
    const watched = watchedSetRef.current.size;
    if (watched / dur >= threshold) {
      completionFiredRef.current = true;
      progressStoppedRef.current = true;
      onComplete?.();
      flushProgress();
    }
  }, [disableProgressTracking, duration, flushProgress, lesson.video_duration_seconds, onComplete, threshold]);

  const markCompleteManual = useCallback(() => {
    if (completionFiredRef.current) return;
    completionFiredRef.current = true;
    progressStoppedRef.current = true;
    onComplete?.();
    flushProgress();
  }, [flushProgress, onComplete]);

  /** Apply caption selection to the underlying HTML5 video when available. */
  useEffect(() => {
    if (!supportsFileTracks) return;
    const internal = playerRef.current?.getInternalPlayer();
    const video = getHtmlVideo(internal);
    if (!video || !video.textTracks) return;
    const tracks = Array.from(video.textTracks);
    tracks.forEach((t, idx) => {
      const label = fileTracks[idx]?.label ?? t.label;
      const lang = fileTracks[idx]?.srcLang ?? t.language;
      const key = `${lang}:${label}`;
      if (captionTrack === 'off') {
        t.mode = 'disabled';
      } else {
        t.mode = key === captionTrack || lang === captionTrack ? 'showing' : 'disabled';
      }
    });
  }, [captionTrack, fileTracks, supportsFileTracks, playing]);

  useEffect(() => {
    if (!fileTracks.length) return;
    const def = fileTracks.find((t) => t.default);
    if (def) {
      setCaptionTrack(`${def.srcLang}:${def.label}`);
    }
  }, [lesson.id, fileTracks]);

  useEffect(() => {
    watchedSetRef.current = new Set();
    completionFiredRef.current = false;
    progressStoppedRef.current = false;
    wallMsRef.current = 0;
    lastSeekRequestIdRef.current = 0;
    setPostEnd('idle');
    setCountdown(10);
    setPlayedSeconds(0);
    setDuration(0);
    setLoaded(0);
    setPlaying(false);
  }, [lesson.id]);

  useEffect(() => {
    if (disableProgressTracking) return;
    const onVis = () => {
      if (document.visibilityState === 'hidden') flushProgress();
    };
    const onUnload = () => flushProgress();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [disableProgressTracking, flushProgress]);

  useEffect(() => {
    if (disableProgressTracking) return;
    const onFs = () => flushProgress();
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, [disableProgressTracking, flushProgress]);

  useEffect(() => {
    if (disableProgressTracking) return;
    if (lastPathRef.current !== location.pathname) {
      flushProgress();
      lastPathRef.current = location.pathname;
    }
  }, [disableProgressTracking, flushProgress, location.pathname]);

  useEffect(() => {
    if (disableProgressTracking || progressStoppedRef.current) return;
    if (!playing) return;
    const id = window.setInterval(() => {
      const t = Math.floor(playedSecondsRef.current);
      if (t >= 0) watchedSetRef.current.add(t);
      wallMsRef.current += 1000;
      if (wallMsRef.current >= 15000) {
        flushProgress();
      }
      tryMarkCompleteFromProgress();
    }, 1000);
    return () => window.clearInterval(id);
  }, [disableProgressTracking, playing, flushProgress, tryMarkCompleteFromProgress]);

  useEffect(() => {
    if (postEnd !== 'next') return;
    if (countdown === 0) {
      autoPlayNext?.();
      setPostEnd('idle');
      return;
    }
    const t = window.setTimeout(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [postEnd, countdown, autoPlayNext]);

  const onReady = useCallback(() => {
    const resume = lesson.resume_from_last_position !== false;
    if (initialPosition != null && resume && initialPosition > 0) {
      playerRef.current?.seekTo(initialPosition, 'seconds');
      setResumeToast({ at: initialPosition, until: Date.now() + 5000 });
      window.setTimeout(() => setResumeToast(null), 5000);
    }

    const internal = playerRef.current?.getInternalPlayer() as unknown;
    const hls = internal && typeof internal === 'object' && 'hls' in internal ? (internal as { hls: HlsLite }).hls : null;
    if (hls?.levels?.length) {
      setHlsLevels(
        hls.levels.map((l, index) => ({
          index,
          height: l.height,
          width: l.width,
          bitrate: l.bitrate,
        })),
      );
      setHlsLevel(typeof hls.currentLevel === 'number' ? hls.currentLevel : null);
      hls.on?.('hlsLevelSwitched', (_e: unknown, data: { level: number }) => setHlsLevel(data.level));
    } else {
      setHlsLevels([]);
      setHlsLevel(null);
    }
  }, [initialPosition, lesson.resume_from_last_position]);

  useEffect(() => {
    if (!seekRequest || seekRequest.id === lastSeekRequestIdRef.current) return;
    lastSeekRequestIdRef.current = seekRequest.id;
    const next = Math.max(0, seekRequest.seconds);
    playerRef.current?.seekTo(next, 'seconds');
    playedSecondsRef.current = next;
    setPlayedSeconds(next);
    flushProgress();
  }, [seekRequest, flushProgress]);

  const seekTo = useCallback((sec: number) => {
    const next = Math.max(0, sec);
    playerRef.current?.seekTo(next, 'seconds');
    playedSecondsRef.current = next;
    setPlayedSeconds(next);
    flushProgress();
  }, [flushProgress]);

  const togglePlay = useCallback(() => setPlaying((p) => !p), []);

  const toggleMute = useCallback(() => {
    setMuted((m) => !m);
  }, []);

  const toggleFs = useCallback(async () => {
    const el = shellRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      await el.requestFullscreen().catch(() => {});
    } else {
      await document.exitFullscreen().catch(() => {});
    }
    flushProgress();
  }, [flushProgress]);

  const togglePip = useCallback(async () => {
    const internal = playerRef.current?.getInternalPlayer();
    const video = getHtmlVideo(internal);
    if (!video || !document.pictureInPictureEnabled) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch {
      /* ignore */
    }
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!shellRef.current?.contains(document.activeElement) && document.activeElement !== shellRef.current) {
        return;
      }
      const step = e.shiftKey ? 10 : 5;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekTo(playedSeconds - step);
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekTo(playedSeconds + step);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume((v) => Math.min(1, v + 0.05));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume((v) => Math.max(0, v - 0.05));
          break;
        case 'm':
        case 'M':
          toggleMute();
          break;
        case 'f':
        case 'F':
          void toggleFs();
          break;
        case 'c':
        case 'C': {
          if (!fileTracks.length) break;
          setCaptionsMenuOpen(false);
          const keys = ['off', ...fileTracks.map((t) => `${t.srcLang}:${t.label}`)];
          const current = captionTrack === 'off' ? 'off' : captionTrack;
          const idx = keys.indexOf(current);
          const next = keys[(idx + 1) % keys.length];
          setCaptionTrack(next === 'off' ? 'off' : next);
          break;
        }
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9': {
          e.preventDefault();
          const n = Number(e.key);
          const dur = duration || lesson.video_duration_seconds || 0;
          if (!dur) return;
          seekTo((dur * n) / 10);
          break;
        }
        default:
          break;
      }
    },
    [
      captionTrack,
      duration,
      fileTracks,
      lesson.video_duration_seconds,
      playedSeconds,
      seekTo,
      toggleFs,
      toggleMute,
      togglePlay,
    ],
  );

  const shellTheme =
    theme === 'dark'
      ? 'bg-slate-950 text-slate-50 ring-1 ring-slate-800'
      : 'bg-slate-900 text-slate-50 ring-1 ring-slate-200';

  if (!url) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        This lesson has no playable video URL (check <code>video_source</code> and related fields).
      </div>
    );
  }

  const displayTime = scrubbing ?? playedSeconds;
  const durDisplay = duration || lesson.video_duration_seconds || 0;

  return (
    <div className="space-y-3">
      <div
        ref={shellRef}
        tabIndex={0}
        role="group"
        aria-label={`Video player: ${lesson.title}`}
        onKeyDown={onKeyDown}
        className={cn('relative overflow-hidden rounded-xl outline-none', shellTheme)}
      >
        <div className="relative aspect-video w-full bg-black">
          <ReactPlayer
            ref={playerRef}
            className="absolute inset-0 [&>video]:h-full [&>video]:w-full"
            url={url}
            width="100%"
            height="100%"
            playing={playing}
            volume={volume}
            muted={muted}
            playbackRate={rate}
            controls={useNativeControls}
            progressInterval={0.25}
            config={{
              file: {
                attributes: { crossOrigin: 'anonymous' as const },
                tracks: supportsFileTracks ? fileTracks : [],
              },
            }}
            onReady={onReady}
            onPlay={() => {
              setPlaying(true);
              if (!disableProgressTracking) flushProgress();
            }}
            onPause={() => {
              setPlaying(false);
              flushProgress();
            }}
            onSeek={() => {
              flushProgress();
            }}
            onDuration={(d) => setDuration(d)}
            onProgress={(state) => {
              playedSecondsRef.current = state.playedSeconds;
              setPlayedSeconds(state.playedSeconds);
              setLoaded(state.loaded);
              onPlayheadSeconds?.(Math.floor(state.playedSeconds));
            }}
            onEnded={() => {
              setPlaying(false);
              flushProgress();
              if (completionFiredRef.current) {
                if (nextLessonTitle) {
                  setCountdown(10);
                  setPostEnd('next');
                } else {
                  setPostEnd('done');
                }
              }
            }}
          />

          {!useNativeControls ? (
            <>
              <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent p-3 text-sm">
                <span className="pointer-events-none line-clamp-2 font-semibold">{lesson.title}</span>
                <span className="pointer-events-none line-clamp-2 text-right text-xs text-white/70">{course.title}</span>
              </div>

              <div className="pointer-events-none absolute inset-x-0 bottom-0 space-y-2 bg-gradient-to-t from-black/80 to-transparent p-3">
                <div className="pointer-events-auto relative pt-3">
                  {chapters.map((ch) => {
                    const pct = durDisplay > 0 ? (ch.start / durDisplay) * 100 : 0;
                    return (
                      <div
                        key={`${ch.start}-${ch.title}`}
                        className="absolute bottom-2 h-3 w-px -translate-x-1/2 bg-white/70"
                        style={{ left: `${pct}%` }}
                        title={ch.title}
                      />
                    );
                  })}
                  <input
                    type="range"
                    min={0}
                    max={durDisplay || 0}
                    step={0.1}
                    value={Math.min(durDisplay || 0, displayTime)}
                    aria-label="Seek"
                    onChange={(e) => setScrubbing(Number(e.target.value))}
                    onMouseUp={() => {
                      if (scrubbing != null) seekTo(scrubbing);
                      setScrubbing(null);
                    }}
                    onKeyUp={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        if (scrubbing != null) seekTo(scrubbing);
                        setScrubbing(null);
                      }
                    }}
                    className="relative z-10 w-full accent-indigo-400"
                  />
                  <div className="pointer-events-none absolute bottom-4 left-0 right-0 h-1 rounded bg-white/20">
                    <div className="h-full rounded bg-white/35" style={{ width: `${(loaded || 0) * 100}%` }} />
                    <div
                      className="absolute inset-y-0 left-0 rounded bg-indigo-400"
                      style={{ width: `${durDisplay ? (playedSeconds / durDisplay) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div className="pointer-events-auto flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    aria-label={playing ? 'Pause' : 'Play'}
                    className="rounded-md p-2 hover:bg-white/10"
                    onClick={togglePlay}
                  >
                    {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                  </button>
                  <button
                    type="button"
                    aria-label="Back 10 seconds"
                    className="rounded-md p-2 hover:bg-white/10"
                    onClick={() => seekTo(playedSeconds - 10)}
                  >
                    <RotateCcw className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Forward 10 seconds"
                    className="rounded-md p-2 hover:bg-white/10"
                    onClick={() => seekTo(playedSeconds + 10)}
                  >
                    <RotateCw className="h-5 w-5" />
                  </button>
                  <span className="ml-1 font-mono text-xs text-white/90">
                    {formatTime(displayTime)} / {formatTime(durDisplay)}
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={muted ? 'Unmute' : 'Mute'}
                      className="rounded-md p-2 hover:bg-white/10"
                      onClick={toggleMute}
                    >
                      {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                    </button>
                    <input
                      aria-label="Volume"
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={muted ? 0 : volume}
                      onChange={(e) => {
                        setMuted(false);
                        setVolume(Number(e.target.value));
                      }}
                      className="w-20 accent-indigo-400"
                    />
                    <label className="ml-2 flex items-center gap-1 text-xs text-white/80">
                      <span className="sr-only">Speed</span>
                      <select
                        aria-label="Playback speed"
                        className="rounded border border-white/20 bg-black/40 px-1 py-1 text-xs"
                        value={rate}
                        onChange={(e) => setRate(Number(e.target.value))}
                      >
                        {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((r) => (
                          <option key={r} value={r}>
                            {r}x
                          </option>
                        ))}
                      </select>
                    </label>

                    {fileTracks.length ? (
                      <div className="relative">
                        <button
                          type="button"
                          aria-label="Captions"
                          aria-expanded={captionsMenuOpen}
                          className="rounded-md p-2 hover:bg-white/10"
                          onClick={() => {
                            setCaptionsMenuOpen((o) => !o);
                            setQualityMenuOpen(false);
                          }}
                        >
                          <Captions className="h-5 w-5" />
                        </button>
                        {captionsMenuOpen ? (
                          <div className="absolute bottom-10 right-0 z-20 min-w-[10rem] rounded-md border border-white/10 bg-black/90 p-1 text-xs shadow-lg">
                            <button
                              type="button"
                              className="block w-full rounded px-2 py-1 text-left hover:bg-white/10"
                              onClick={() => {
                                setCaptionTrack('off');
                                setCaptionsMenuOpen(false);
                              }}
                            >
                              Off
                            </button>
                            {fileTracks.map((t) => {
                              const key = `${t.srcLang}:${t.label}`;
                              return (
                                <button
                                  type="button"
                                  key={key}
                                  className="block w-full rounded px-2 py-1 text-left hover:bg-white/10"
                                  onClick={() => {
                                    setCaptionTrack(key);
                                    setCaptionsMenuOpen(false);
                                  }}
                                >
                                  {t.label}
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {hlsLevels.length > 1 ? (
                      <div className="relative">
                        <button
                          type="button"
                          aria-label="Quality"
                          aria-expanded={qualityMenuOpen}
                          className="rounded-md px-2 py-1 text-xs hover:bg-white/10"
                          onClick={() => {
                            setQualityMenuOpen((o) => !o);
                            setCaptionsMenuOpen(false);
                          }}
                        >
                          Quality
                        </button>
                        {qualityMenuOpen ? (
                          <div className="absolute bottom-10 right-0 z-20 max-h-48 min-w-[8rem] overflow-auto rounded-md border border-white/10 bg-black/90 p-1 text-xs shadow-lg">
                            {hlsLevels.map((lvl) => (
                              <button
                                type="button"
                                key={lvl.index}
                                className="block w-full rounded px-2 py-1 text-left hover:bg-white/10"
                                onClick={() => {
                                  const internal = playerRef.current?.getInternalPlayer() as unknown;
                                  const hls =
                                    internal && typeof internal === 'object' && 'hls' in internal
                                      ? (internal as { hls: HlsLite }).hls
                                      : null;
                                  if (hls) hls.currentLevel = lvl.index;
                                  setHlsLevel(lvl.index);
                                  setQualityMenuOpen(false);
                                }}
                              >
                                {lvl.height ? `${lvl.height}p` : `Level ${lvl.index}`}
                                {hlsLevel === lvl.index ? ' ✓' : ''}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <button
                      type="button"
                      aria-label="Picture in picture"
                      className="rounded-md p-2 hover:bg-white/10"
                      onClick={() => void togglePip()}
                    >
                      <PictureInPicture2 className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Fullscreen"
                      className="rounded-md p-2 hover:bg-white/10"
                      onClick={() => void toggleFs()}
                    >
                      {document.fullscreenElement ? (
                        <Minimize className="h-5 w-5" />
                      ) : (
                        <Maximize className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {resumeToast ? (
            <div className="absolute bottom-24 left-3 right-3 rounded-md bg-black/80 p-3 text-xs text-white shadow-lg md:left-auto md:right-4 md:w-80">
              <p>
                Resuming from <span className="font-mono">{formatTime(resumeToast.at)}</span>
              </p>
              <button
                type="button"
                className="mt-2 text-indigo-300 underline"
                onClick={() => {
                  seekTo(0);
                  setResumeToast(null);
                }}
              >
                Start from beginning
              </button>
            </div>
          ) : null}

          {postEnd === 'next' && nextLessonTitle ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4 text-center">
              <div className="max-w-md rounded-xl bg-slate-950 p-6 text-white shadow-xl ring-1 ring-white/10">
                <p className="text-sm text-white/80">Next up</p>
                <p className="mt-1 text-lg font-semibold">{nextLessonTitle}</p>
                <p className="mt-3 text-sm text-white/80">Starting in {countdown}s…</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-900"
                    onClick={() => {
                      autoPlayNext?.();
                      setPostEnd('idle');
                    }}
                  >
                    Play now
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-white/30 px-4 py-2 text-sm text-white"
                    onClick={() => setPostEnd('idle')}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {postEnd === 'done' ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4 text-center">
              <div className="max-w-md rounded-xl bg-slate-950 p-6 text-white shadow-xl ring-1 ring-white/10">
                <p className="text-lg font-semibold">You finished the course</p>
                <p className="mt-2 text-sm text-white/80">Great work — you can continue from your dashboard.</p>
                <button
                  type="button"
                  className="mt-4 rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-900"
                  onClick={() => setPostEnd('idle')}
                >
                  Close
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50"
          onClick={markCompleteManual}
        >
          Mark as complete
        </button>
      </div>
    </div>
  );
}
