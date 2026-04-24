# LMS Video Player Design

This document covers how video works across the LMS template, on both the Directus backend and the React frontend. It extends what's already in `PLAN.md`, `MCP_PROMPTS.md`, and `FRONTEND_PROMPTS.md`. Review this before running any Cursor prompts so we can lock in the video behavior.

## Goals

- Instructors can add a video lesson by pasting a YouTube link, pasting a Vimeo link, uploading a file to Directus, or pointing at an external URL (mp4, HLS manifest).
- Learners get one consistent player UI regardless of source.
- Progress is tracked accurately. A lesson marks complete when the learner watches past a threshold (default 90 percent), and the player resumes from the last watched position on return.
- Captions, transcripts, chapters, and playback speed are supported so the platform reads as a serious course platform rather than a wrapper around an embed.

## Why four video sources rather than one

Most LMS templates assume YouTube embeds and stop there. For this template I want all four because instructors have different constraints:

- **YouTube** is the most common. Directus ships with an embed interface for it.
- **Vimeo** is common for paid/private courses that don't want public YouTube exposure.
- **Directus file upload** is the "it just works" path for short videos and keeps the asset inside the platform.
- **External URL** covers Mux, Cloudflare Stream, Wistia, Bunny, or any self-hosted HLS/mp4 that instructors already have a pipeline for.

All four run through the same player component, so learner experience is identical.

## Backend schema changes

These fields live on the existing `lessons` collection. They only apply when `lesson_type = "video"`, so every field below should be configured with conditional visibility in the Directus Studio so they only render in the form when the lesson type is video.

### Fields to add to `lessons`

| Field | Type | Interface | Notes |
|---|---|---|---|
| `video_source` | string (enum) | `select-dropdown` | Values: `youtube`, `vimeo`, `directus_file`, `external_url`. Default `youtube`. Required when `lesson_type = "video"`. |
| `video_youtube_id` | string | `input` (or YouTube embed interface if available in your Directus version) | Store just the video ID, not the full URL. A Flow normalizes pasted URLs to the ID on create/update. Shown only when `video_source = "youtube"`. |
| `video_vimeo_id` | string | `input` | Same pattern as YouTube. Shown only when `video_source = "vimeo"`. |
| `video_file` | uuid | `file` (M2O to `directus_files`) | Shown only when `video_source = "directus_file"`. Accept mp4, webm. |
| `video_url` | string | `input` | For external sources (mp4, HLS `.m3u8`, DASH `.mpd`). Shown only when `video_source = "external_url"`. |
| `video_duration_seconds` | integer | `input` | Duration in seconds. Auto-filled by a Flow when possible (YouTube/Vimeo oEmbed returns duration; files can be probed). Also editable by the instructor for fallback. Used for display and for computing progress thresholds. |
| `video_thumbnail` | uuid | `file-image` (M2O to `directus_files`) | Optional override. If empty, the frontend derives one from YouTube/Vimeo or uses the course cover. |
| `video_captions` | array | `list-m2m` to `directus_files` through a junction `lessons_captions_files` | VTT files. Each row carries a language code. See "Captions" below. |
| `video_transcript` | text | `input-rich-text-md` | Optional. Displayed next to the player and indexed for search. |
| `video_chapters` | json | `input-code` (language: json) | Array of `{ "start": seconds, "title": string }`. Used to render chapter markers on the scrub bar. |
| `allow_download` | boolean | `boolean` | Instructor can permit download for `directus_file` and `external_url` sources. Always false for YouTube/Vimeo. |
| `resume_from_last_position` | boolean | `boolean` | Default true. If false, the video always starts at 0 for this lesson. |
| `completion_threshold` | integer | `input` (min 50, max 100) | Default 90. Percent of duration that counts as complete. Per-lesson override of the course-wide default. |

### Course-level defaults

Add to `courses` so instructors can set a default once per course:

| Field | Type | Interface | Notes |
|---|---|---|---|
| `default_completion_threshold` | integer | `input` (min 50, max 100) | Default 90. Used when a lesson doesn't set its own. |
| `default_video_player_theme` | string (enum) | `select-dropdown` | `light` or `dark`. Cosmetic only. |

### Captions junction

Create collection `lessons_captions_files`:

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `lesson_id` | uuid | M2O to `lessons` |
| `file_id` | uuid | M2O to `directus_files` (expects a `.vtt`) |
| `language_code` | string | e.g. `en`, `es`, `fr-CA`. Used as the `srclang` attribute. |
| `label` | string | Human-readable label (e.g. "English", "Español"). Used as the track label in the player. |
| `is_default` | boolean | If true, this track is selected by default. |

### Progress fields on `lesson_progress`

Already planned but calling out the video-specific columns to confirm:

| Field | Type | Notes |
|---|---|---|
| `last_position_seconds` | integer | Where the learner last was in the video. Written on pause, on page unload, and every 15 seconds during playback. |
| `watched_seconds` | integer | Cumulative unique seconds watched (not just max position) so skipping ahead doesn't mark complete. See "Progress tracking" below. |
| `completed_at` | timestamp | Set when `watched_seconds / video_duration_seconds >= completion_threshold / 100`. |
| `last_watched_at` | timestamp | Updated on every progress write. Drives the "Continue learning" strip on the learner dashboard. |

## Directus Flows for video

Add two Flows on top of the existing L10-series:

### Flow V1: Normalize video inputs on lesson save

- Trigger: filter hook on `lessons.items.create` and `lessons.items.update`
- Logic:
  - If `video_source = "youtube"`: accept either a full URL or an ID in `video_youtube_id`. Regex-extract the ID. Store just the 11-char ID.
  - If `video_source = "vimeo"`: same pattern, extract numeric ID.
  - If `video_source = "external_url"`: validate it's a real URL and strip tracking params.
  - If `video_duration_seconds` is empty and `video_source` is YouTube or Vimeo, call the respective oEmbed endpoint and fill it in.
  - Reject save with a clear error if the source field matches but its paired ID/file/URL is empty.

### Flow V2: Video progress webhook (optional, Phase 2)

- Trigger: custom endpoint that the frontend hits
- Logic: write `last_position_seconds`, `watched_seconds`, `last_watched_at` to `lesson_progress`. If threshold crossed, set `completed_at` and call the existing enrollment progress recompute flow.
- Keeps write volume off the SDK path and lets us throttle.

For the first cut, skip V2 and let the frontend write directly via the SDK. Add V2 later if we see performance issues.

## Frontend player design

### Component: `<VideoPlayer />`

Single component. All lesson-type-video content renders through it. Lives at `src/components/lesson/VideoPlayer.tsx`.

Props:

```ts
type VideoPlayerProps = {
  lesson: Lesson            // full lesson record with video fields + captions
  courseSlug: string
  onProgress: (state: { position: number; watched: number; duration: number }) => void
  onComplete: () => void
  initialPosition?: number   // resumes from this second, if provided
  themeOverride?: 'light' | 'dark'
}
```

Library choice: **`react-player`** (lazy-loaded). It handles YouTube, Vimeo, HLS, mp4, DASH, and local files through one API. We wrap it with our own controls shell so the YouTube player and the file player feel identical.

Internals:

1. Resolve a `url` from the lesson record:
   - `youtube` → `https://www.youtube.com/watch?v={video_youtube_id}`
   - `vimeo` → `https://vimeo.com/{video_vimeo_id}`
   - `directus_file` → `{DIRECTUS_URL}/assets/{video_file}?access_token=...` (authenticated asset URL)
   - `external_url` → raw URL (HLS handled by react-player's HLS adapter)
2. Render the player with `controls={false}` and draw our own controls overlay so the chrome is consistent. For YouTube's embed restrictions, fall back to native controls when our overlay can't drive the player (rare, mostly on mobile Safari).
3. Load captions from `lesson.video_captions` into `<track>` elements with the right `srclang`, `label`, and `default` attribute.
4. Render chapter markers as ticks on the scrub bar using `lesson.video_chapters`. Hover on a tick shows the chapter title.

### Controls shell

Top row of the player frame:
- Title (left), course title (right, muted).

Bottom row:
- Play/pause
- Backward 10s / Forward 10s
- Scrub bar with buffered range, played range, chapter ticks, thumbnail preview on hover (YouTube/Vimeo native, file-sourced shows just the timestamp)
- Current time / total time
- Volume (with mute toggle)
- Playback speed (0.5, 0.75, 1, 1.25, 1.5, 1.75, 2)
- Captions menu (lists languages from `video_captions`, plus Off)
- Quality menu (only shown when source reports multiple renditions, which is HLS mostly)
- Picture-in-picture
- Fullscreen

Keyboard shortcuts while focused:
- Space: play/pause
- ← / →: seek -5s / +5s
- Shift + ← / →: seek -10s / +10s
- ↑ / ↓: volume +/-
- M: mute
- F: fullscreen
- C: toggle captions
- 0-9: jump to 0-90 percent

### Progress tracking

This is the part that matters most for the LMS to feel real, so it gets its own behavior contract.

- On play, start a ticker every 1 second that maintains a `Set<number>` of whole-second positions watched (rounded down).
- Every 15 seconds of wall-clock playtime, write to Directus:
  - `last_position_seconds = current playhead`
  - `watched_seconds = size of the set`
  - `last_watched_at = now`
- On pause, seek, tab hide, and route change, flush the pending write immediately.
- On the client side, compute `percent = watched_seconds / duration`. When `percent >= threshold`, call `onComplete()`, write `completed_at = now`, and stop writing progress beyond that point.
- On load, if `initialPosition` is set and `resume_from_last_position` is true, seek to that position and show a small "Resuming from 4:12" toast. The learner can click "Start from beginning" to override.

This approach means scrubbing to the end doesn't mark a lesson complete. The learner has to actually watch across the threshold percentage of unique seconds. That's the right default for a paid course platform.

### Autoplay next

After completion, show a 10-second "Next up: {lesson title}" countdown overlay with a cancel button. On confirm or timeout, route to the next lesson in the curriculum. If the current lesson is the last in the course and the course is complete, route to the certificate page instead.

### Where the player renders

- **CoursePlayer page** (`/learn/:courseSlug/:lessonId`, from `LF5`): three-column layout. The center column is the `<VideoPlayer />`. Resources, transcript, and chapters live in tabs under it. Curriculum sidebar is on the left.
- **Course preview on the marketing page** (`/courses/:slug`, from `LF4`): if the course has a `preview_lesson` marked, render the same `<VideoPlayer />` but with progress tracking disabled. This lets prospective learners preview a lesson before enrolling.

### Captions, transcripts, chapters in the UI

Under the player, three tabs:
- **Transcript**: renders `video_transcript` as markdown. When playing, highlight the line closest to the current timestamp if the transcript includes timecodes in `[mm:ss]` format at the start of lines (opportunistic; plain transcripts still work).
- **Chapters**: list of `video_chapters` as clickable rows. Click seeks to that timestamp.
- **Resources**: downloads and external links attached to the lesson.

## Instructor authoring UX

On `CourseEditor > Curriculum > Lesson editor` (from `LF8`), when the instructor sets lesson type to Video:

1. A "Source" selector shows the four options as a segmented control.
2. Based on source:
   - YouTube/Vimeo: one input field for URL or ID. Below it, a live preview thumbnail once the ID is valid.
   - Directus file: file upload with a dropzone.
   - External URL: input with a quick "Test playback" button that loads the URL in a mini player to confirm it works.
3. Duration auto-fills when possible; otherwise the instructor types it.
4. Thumbnail override is optional.
5. "Captions" is a repeater of `{ file upload, language code dropdown, label, is_default }`.
6. "Chapters" is a repeater of `{ minute input, second input, title }` that serializes to the `video_chapters` JSON.
7. "Transcript" is a markdown editor.
8. "Advanced" accordion exposes `completion_threshold`, `resume_from_last_position`, `allow_download`.

All of this is the same form, populated from the `lessons` record, wired through React Hook Form + Zod.

## Open design choices to confirm

1. **Should we use a different player library than `react-player`?** Alternatives: Plyr (slicker UI, more configuration), Video.js (more industrial, larger bundle), Mux Player (best-in-class but opinionated toward Mux). `react-player` is the right call if we want one API for four sources. Happy to switch to Plyr if you prefer a more polished default chrome.
2. **Should YouTube videos count progress as "watched" the same way as file videos?** YouTube's iframe API does give us time updates, so yes, the same progress model works. Flagging it because YouTube's terms of service prohibit some kinds of background playback tracking, and we should confirm we're okay with the standard embed telemetry.
3. **Should we support DRM?** Not in scope for a template. If someone needs DRM they'll bring Mux or Cloudflare Stream and we just play their signed HLS URL.
4. **Should `video_transcript` be AI-generated?** Out of scope for this template. We store the field so instructors can paste one in. Whisper-based auto-generation can be a follow-up Flow if you want it later.
5. **Do we want one lesson to have multiple video variants (e.g., language dubs)?** Not in v1. If this matters, we'd add a `video_variants` collection. Flagging so you can say yes or no before we lock the schema.

## Impact on the existing files

If you greenlight this design, I'll update:

- `PLAN.md` — add a "Video" subsection under `lessons`, list the new fields and flows.
- `MCP_PROMPTS.md` — extend L3 (the `lessons` prompt) to include all the new fields with correct Directus interfaces and conditional visibility. Add new prompts for the captions junction collection and the two Flows (V1, V2-optional).
- `FRONTEND_PROMPTS.md` — expand LF3 with the full `<VideoPlayer />` spec above. Expand LF5 to wire progress tracking into `CoursePlayer`. Expand LF8 to spec the instructor video editor form.

Say the word and I'll push those updates. If any of the five open choices above need adjusting, tell me and I'll bake it into the update pass.
