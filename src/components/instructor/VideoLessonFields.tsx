import { useCallback, useMemo, useState } from 'react';
import ReactPlayer from 'react-player/lazy';
import { RichTextEditor } from '@/components/content/RichTextEditor';
import { uploadLessonFile } from '@/api/instructor';
import type { Lesson, VideoSource } from '@/types/lms';
import type { UnknownRecord } from '@/api/public';

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ja', label: 'Japanese' },
];

function extractYoutubeId(input: string): string {
  const s = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  const m = s.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m?.[1] ?? '';
}

function extractVimeoId(input: string): string {
  const s = input.trim();
  if (/^\d+$/.test(s)) return s;
  const m = s.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m?.[1] ?? '';
}

export type VideoLessonFieldsProps = {
  lesson: Lesson;
  courseDefaultThreshold: number;
  paidCourse: boolean;
  onPatch: (patch: UnknownRecord) => void;
};

export function VideoLessonFields(props: VideoLessonFieldsProps) {
  const { lesson, courseDefaultThreshold, paidCourse, onPatch } = props;
  const source = (lesson.video_source ?? 'youtube') as VideoSource;
  const [ytInput, setYtInput] = useState(lesson.video_youtube_id ?? '');
  const [vmInput, setVmInput] = useState(lesson.video_vimeo_id ?? '');
  const [extUrl, setExtUrl] = useState(lesson.video_url ?? '');
  const [dur, setDur] = useState(lesson.video_duration_seconds != null ? String(lesson.video_duration_seconds) : '');

  const ytId = useMemo(() => extractYoutubeId(ytInput), [ytInput]);
  const vmId = useMemo(() => extractVimeoId(vmInput), [vmInput]);

  const setSource = useCallback(
    (next: VideoSource) => {
      onPatch({ video_source: next });
    },
    [onPatch],
  );

  async function onVideoFile(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    const up = await uploadLessonFile(f);
    const fid = String((up as UnknownRecord).id ?? '');
    onPatch({ video_file: fid, video_source: 'directus_file' });
    const url = URL.createObjectURL(f);
    await new Promise<void>((resolve) => {
      const el = document.createElement('video');
      el.src = url;
      el.onloadedmetadata = () => {
        const sec = Math.floor(el.duration || 0);
        if (sec > 0) {
          setDur(String(sec));
          onPatch({ video_duration_seconds: sec });
        }
        URL.revokeObjectURL(url);
        resolve();
      };
      el.onerror = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
    });
  }

  const chapters = useMemo(() => {
    const raw = lesson.video_chapters;
    if (Array.isArray(raw)) return raw as { start: number; title: string }[];
    if (typeof raw === 'string') {
      try {
        const j = JSON.parse(raw) as unknown;
        return Array.isArray(j) ? (j as { start: number; title: string }[]) : [];
      } catch {
        return [];
      }
    }
    return [];
  }, [lesson.video_chapters]);

  function updateChapter(i: number, field: 'm' | 's' | 'title', v: string) {
    const next = chapters.map((c, idx) => {
      if (idx !== i) return { ...c };
      if (field === 'title') return { ...c, title: v };
      const total = Math.max(0, Math.floor(Number(c.start ?? 0) / 60) * 60 + (Number(c.start ?? 0) % 60));
      const m = field === 'm' ? Number(v || 0) : Math.floor(total / 60);
      const s = field === 's' ? Number(v || 0) : total % 60;
      return { ...c, start: m * 60 + s };
    });
    onPatch({ video_chapters: next });
  }

  const captions = lesson.video_captions ?? [];

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap gap-2 rounded-lg bg-slate-100 p-1">
        {(
          [
            ['youtube', 'YouTube'],
            ['vimeo', 'Vimeo'],
            ['directus_file', 'Upload'],
            ['external_url', 'External URL'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${source === k ? 'bg-white shadow text-slate-900' : 'text-slate-600'}`}
            onClick={() => setSource(k)}
          >
            {label}
          </button>
        ))}
      </div>

      {source === 'youtube' ? (
        <div>
          <label className="block font-medium text-slate-700">YouTube URL or ID</label>
          <input className="mt-1 w-full rounded border border-slate-200 px-3 py-2" value={ytInput} onChange={(e) => setYtInput(e.target.value)} />
          {ytId ? (
            <img src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`} alt="" className="mt-2 max-h-40 rounded border border-slate-200" />
          ) : null}
          <button
            type="button"
            className="mt-2 text-xs text-indigo-600 hover:underline"
            onClick={() => {
              onPatch({ video_youtube_id: ytId, video_source: 'youtube' });
            }}
          >
            Apply ID to lesson
          </button>
        </div>
      ) : null}

      {source === 'vimeo' ? (
        <div>
          <label className="block font-medium text-slate-700">Vimeo URL or numeric ID</label>
          <input className="mt-1 w-full rounded border border-slate-200 px-3 py-2" value={vmInput} onChange={(e) => setVmInput(e.target.value)} />
          <button type="button" className="mt-2 text-xs text-indigo-600 hover:underline" onClick={() => onPatch({ video_vimeo_id: vmId, video_source: 'vimeo' })}>
            Apply Vimeo ID
          </button>
        </div>
      ) : null}

      {source === 'directus_file' ? (
        <div>
          <label className="block font-medium text-slate-700">Video file (mp4 / webm)</label>
          <input type="file" accept="video/mp4,video/webm" className="mt-1 text-xs" onChange={(e) => void onVideoFile(e.target.files)} />
        </div>
      ) : null}

      {source === 'external_url' ? (
        <div>
          <label className="block font-medium text-slate-700">MP4 or HLS URL</label>
          <input className="mt-1 w-full rounded border border-slate-200 px-3 py-2" value={extUrl} onChange={(e) => setExtUrl(e.target.value)} />
          <button type="button" className="mt-2 rounded bg-slate-100 px-3 py-1 text-xs font-medium" onClick={() => onPatch({ video_url: extUrl, video_source: 'external_url' })}>
            Save URL
          </button>
          {extUrl ? (
            <div className="mt-3">
              <p className="mb-1 text-xs font-medium text-slate-600">Test playback</p>
              <div className="aspect-video max-h-56 overflow-hidden rounded border border-slate-200 bg-black">
                <ReactPlayer url={extUrl} controls width="100%" height="100%" />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <label className="block">
        <span className="font-medium text-slate-700">Duration (seconds)</span>
        <input className="mt-1 w-full rounded border border-slate-200 px-3 py-2" value={dur} onChange={(e) => setDur(e.target.value)} onBlur={() => onPatch({ video_duration_seconds: dur === '' ? null : Number(dur) })} />
      </label>

      <div>
        <p className="font-medium text-slate-700">Chapters</p>
        <ul className="mt-2 space-y-2">
          {chapters.map((ch, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <input type="number" className="w-16 rounded border px-2 py-1" placeholder="min" defaultValue={Math.floor((ch.start ?? 0) / 60)} onBlur={(e) => updateChapter(i, 'm', e.target.value)} />
              <input type="number" className="w-16 rounded border px-2 py-1" placeholder="sec" defaultValue={(ch.start ?? 0) % 60} onBlur={(e) => updateChapter(i, 's', e.target.value)} />
              <input className="min-w-[120px] flex-1 rounded border px-2 py-1" defaultValue={ch.title} onBlur={(e) => updateChapter(i, 'title', e.target.value)} />
            </li>
          ))}
        </ul>
        <button type="button" className="mt-2 text-xs text-indigo-600" onClick={() => onPatch({ video_chapters: [...chapters, { start: 0, title: 'Chapter' }] })}>
          + Chapter
        </button>
      </div>

      <div>
        <p className="font-medium text-slate-700">Transcript</p>
        <div className="mt-1 rounded border border-slate-200">
          <RichTextEditor value={lesson.video_transcript ?? ''} onChange={(html) => onPatch({ video_transcript: html })} />
        </div>
      </div>

      <details className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">Advanced</summary>
        <div className="mt-3 space-y-3">
          <label className="block text-xs">
            Completion threshold (50–100). Course default: {courseDefaultThreshold}%
            <input
              type="range"
              min={50}
              max={100}
              value={lesson.completion_threshold ?? courseDefaultThreshold}
              onChange={(e) => onPatch({ completion_threshold: Number(e.target.value) })}
              className="mt-1 w-full"
            />
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={Boolean(lesson.resume_from_last_position)} onChange={(e) => onPatch({ resume_from_last_position: e.target.checked })} />
            Resume from last position
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              disabled={source === 'youtube' || source === 'vimeo'}
              checked={Boolean(lesson.allow_download)}
              onChange={(e) => onPatch({ allow_download: e.target.checked })}
            />
            Allow download {source === 'youtube' || source === 'vimeo' ? '(N/A for embed)' : ''}
          </label>
        </div>
      </details>

      <div>
        <p className="font-medium text-slate-700">Captions (.vtt)</p>
        <p className="text-xs text-slate-500">Stored on lesson as structured tracks when saved from the course editor.</p>
        <ul className="mt-2 space-y-2">
          {(captions as UnknownRecord[]).map((row, idx) => (
            <li key={idx} className="flex flex-wrap gap-2 text-xs">
              <span>{String(row.language_code ?? 'en')}</span>
              <span>{String(row.label ?? '')}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <select id="cap-lang" className="rounded border px-2 py-1 text-xs">
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          <input id="cap-label" className="rounded border px-2 py-1 text-xs" placeholder="Label" />
          <input
            type="file"
            accept=".vtt"
            className="text-xs"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const up = await uploadLessonFile(f);
              const fid = String((up as UnknownRecord).id ?? '');
              const lang = (document.getElementById('cap-lang') as HTMLSelectElement)?.value ?? 'en';
              const label = (document.getElementById('cap-label') as HTMLInputElement)?.value || 'Captions';
              const next = [...(captions as UnknownRecord[]), { directus_files_id: fid, language_code: lang, label, is_default: captions.length === 0 }];
              onPatch({ video_captions: next });
            }}
          />
        </div>
      </div>

      {paidCourse ? <p className="text-xs text-amber-800">Preview lesson toggle is disabled when the course is paid (free preview policy).</p> : null}
    </div>
  );
}
