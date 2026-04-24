# Cursor Prompts: LMS Frontend on Vercel

Target: a new React app (completely separate from the CRM frontend) that pulls LMS data from the same Directus backend, supports a public course catalog, a learner experience with a course player, an instructor authoring workflow, and an admin console. Deploys to Vercel via the Vercel MCP.

## Prerequisites

- GitHub MCP connected
- Vercel MCP connected
- Directus MCP connected and pointed at the live Directus instance that now hosts both the CRM and LMS schemas

At the top of every Cursor session: **before writing any code that references a Directus collection or field, query the Directus MCP to confirm the collection and field names**. The backend has both CRM and LMS collections now; do not pull from CRM collections in this frontend.

## Stack

Same core as the CRM frontend for consistency:
- Vite + React 18 + TypeScript
- Tailwind + shadcn/ui (new-york style, slate base)
- TanStack Query
- React Router v6
- Zustand for auth
- @directus/sdk
- React Hook Form + Zod
- TanStack Table for tables
- dnd-kit for drag (used in instructor curriculum builder)
- date-fns
- lucide-react

LMS-specific additions:
- react-player (handles YouTube, Vimeo, HLS, direct mp4, external URLs through a single API; wrapped in a custom controls shell in VideoPlayer so every source feels identical)
- react-markdown with remark-gfm and rehype-raw (rich text renderer)
- react-pdf (PDF viewer)
- @tiptap/react + @tiptap/starter-kit + @tiptap/extension-link + @tiptap/extension-image (rich text editor for instructors)
- html2canvas + jspdf (certificate PDF generation client-side)
- recharts (instructor analytics)

## How to use

Each prompt is one Cursor session. Verify in the browser after each before moving on.

---

# Phase 1: Repo, scaffold, SDK, auth shell

## Prompt LF1: Create repo and scaffold

```
Goal: create a brand new GitHub repo for the LMS frontend and scaffold a Vite React TS project. This is a separate repo from the CRM frontend. Do not copy code from the CRM repo.

Step 1: use the GitHub MCP to create a new private repo named "directus-lms-frontend" with a README initialized.

Step 2: scaffold a Vite React TS app into the repo with this structure:

directus-lms-frontend/
├── .env.example
├── .env.local              (gitignored)
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── index.html
├── public/
│   └── (static assets)
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── lib/
│   │   ├── directus.ts
│   │   ├── schema.ts
│   │   ├── queries.ts
│   │   └── utils.ts
│   ├── stores/
│   │   └── auth.ts
│   ├── components/
│   │   └── ui/             (shadcn)
│   ├── pages/
│   │   └── Home.tsx
│   └── routes/
│       └── index.tsx

Step 3: install dependencies:
- react, react-dom, react-router-dom
- @directus/sdk
- @tanstack/react-query, @tanstack/react-table
- zustand
- react-hook-form, zod, @hookform/resolvers
- date-fns
- lucide-react
- tailwindcss, postcss, autoprefixer
- class-variance-authority, clsx, tailwind-merge
- @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities
- react-player (the single player library for the whole app; wrapped in custom controls)
- hls.js (peer dep for react-player when rendering HLS manifests)
- react-markdown, remark-gfm, rehype-raw
- react-pdf
- @tiptap/react, @tiptap/starter-kit, @tiptap/extension-link, @tiptap/extension-image
- html2canvas, jspdf
- recharts

Step 4: initialize Tailwind. Set up shadcn/ui with "new-york" style and "slate" base color (distinct from the CRM's "neutral" so the two UIs feel different). Install these shadcn components:
button, input, label, textarea, dropdown-menu, dialog, sheet, select, checkbox, radio-group, tabs, avatar, badge, card, popover, command, separator, skeleton, toast (sonner), scroll-area, tooltip, form, calendar, progress, hover-card, accordion, aspect-ratio.

Step 5: build src/lib/directus.ts for cookie auth. Same pattern as the CRM client but typed against the LMS schema:

```ts
import { createDirectus, authentication, rest } from '@directus/sdk';
import type { Schema } from './schema';

export const apiUrl = import.meta.env.VITE_DIRECTUS_URL as string;

export const directus = createDirectus<Schema>(apiUrl)
  .with(authentication('cookie', { credentials: 'include' }))
  .with(rest({ credentials: 'include' }));
```

Step 6: build src/lib/schema.ts by querying the Directus MCP for the LMS collections ONLY:
- directus_users (partial, LMS-relevant fields)
- categories, course_tags, courses_tags (junction), courses_prerequisites, courses_co_instructors
- courses, modules, lessons, lessons_resources
- enrollments, lesson_progress
- quizzes, questions, question_options
- quiz_attempts, quiz_responses, quiz_responses_options
- assignments, submissions, submissions_files
- certificate_templates, certificates
- badges, user_badges
- reviews, announcements

Do NOT include CRM collections (companies, contacts, deals, etc.) in the Schema type.

Step 7: .env.example:
VITE_DIRECTUS_URL=
VITE_PUBLIC_APP_URL=

Step 8: commit and push.

Stop here. Do not build auth or pages yet.
```

**Verify:** `npm run dev` boots to the default Vite page. GitHub repo is populated. `src/lib/schema.ts` covers the LMS collections only (no CRM types).

---

## Prompt LF2: Auth store, public/protected routing, app shells

```
Goal: set up two distinct layout shells (public and authenticated) since the LMS serves both anonymous visitors and logged-in users.

Step 1: Zustand auth store at src/stores/auth.ts.
- State: user (directus_users or null), role ('admin' | 'instructor' | 'learner' | 'guest' | null), status ('loading' | 'authenticated' | 'unauthenticated').
- Actions: login(email, password), signup(email, password, first_name, last_name), logout(), fetchCurrentUser().
- login uses directus.login. signup uses directus.request(registerUser(...)) then logs in.
- fetchCurrentUser reads /users/me with fields id, first_name, last_name, email, avatar, bio, headline, role.*. Map role.name to 'admin' | 'instructor' | 'learner'. If no user, status = 'unauthenticated', role = 'guest'.
- On app boot, call fetchCurrentUser to hydrate.

Step 2: public pages and layout at src/components/layout/PublicLayout.tsx.
- Top nav: logo (left), primary nav (Courses, Categories, Instructors) (center-left), search input (center-right, cmd+k opens command palette), Login / Sign Up buttons (right). If authenticated: show user avatar dropdown and "My Learning" button instead of Login.
- Footer: company links, social, copyright.
- Main content: flex-1, no padding (pages control their own).
- Feel: modern, content-forward, lots of whitespace, large hero areas, card grids for courses. Think Coursera / Udemy / Teachable rather than a CRUD admin.

Step 3: authenticated learner layout at src/components/layout/LearnerLayout.tsx.
- Same top nav as public but the "Sign up" / "Log in" are replaced with the user avatar menu.
- No sidebar for public pages or learner non-player pages. We will introduce a sidebar only inside the course player (Phase 4).

Step 4: instructor layout at src/components/layout/InstructorLayout.tsx.
- Admin-app feel, closer to the CRM shell.
- Left sidebar with: Dashboard, My Courses, Students, Grading (with badge count), Analytics, Announcements.
- Top bar with course switcher (when inside a course), create button, user avatar.

Step 5: admin layout at src/components/layout/AdminLayout.tsx.
- Similar to InstructorLayout, with an admin nav: Dashboard, Users, Categories, Badges, Certificate Templates, Reviews, Announcements, Site Settings.

Step 6: route setup at src/routes/index.tsx. Use React Router v6 with nested routes per layout.

Public (PublicLayout):
- /
- /courses
- /courses/:slug
- /categories
- /categories/:slug
- /instructors
- /instructors/:id
- /verify/:code
- /login
- /signup

Learner (LearnerLayout, role = learner or higher):
- /my/learning
- /my/completed
- /my/certificates
- /my/badges
- /my/profile
- /learn/:courseSlug          (switches to course-player layout internally)
- /learn/:courseSlug/:lessonId
- /quiz/:attemptId            (fullscreen, no layout)
- /assignment/:assignmentId

Instructor (InstructorLayout, role = instructor or admin):
- /instructor/dashboard
- /instructor/courses
- /instructor/courses/new
- /instructor/courses/:id/edit
- /instructor/courses/:id/students
- /instructor/courses/:id/grading
- /instructor/courses/:id/analytics
- /instructor/courses/:id/announcements

Admin (AdminLayout, role = admin):
- /admin
- /admin/users
- /admin/categories
- /admin/badges
- /admin/certificate-templates
- /admin/reviews
- /admin/announcements

Each route group uses a wrapper component that checks the user's role and redirects to /login or / (home) if insufficient.

Step 7: Login page src/pages/Login.tsx. Centered card, email + password, redirect to intended destination on success. Signup page src/pages/Signup.tsx: email, password, first_name, last_name. On success, redirect to /courses.

Step 8: build a placeholder Home.tsx with a hero ("Learn anything, from anywhere"), a category strip (calls directus for categories and renders cards), and a "Featured courses" strip (empty for now, we fill it in Phase 3).

Step 9: commit and push.
```

**Verify:** Navigate to / and see the home page. Click Login, log in as a seeded learner, land on /my/learning placeholder. Log in as a seeded instructor, land on /instructor/dashboard placeholder. Role gating works (learner navigating to /instructor/... redirects home).

---

# Phase 2: Shared UI primitives

## Prompt LF3: CourseCard, CurriculumOutline, ProgressBar, LessonIcon, RichText, VideoPlayer

```
Goal: build the reusable pieces every LMS page depends on. No real pages in this phase.

Step 1: CourseCard at src/components/courses/CourseCard.tsx
- Props: course (Course object), variant ('catalog' | 'continue' | 'compact')
- catalog variant (default): cover image (16:9), title, subtitle, instructor name + avatar, rating (stars + count), price or "Free" badge, duration, difficulty pill, category pill. Hover: subtle lift + shadow, shows description preview.
- continue variant: cover, title, progress bar, "Resume" button, last lesson title, time remaining estimate.
- compact variant: cover (small), title, instructor name. Used in lists and search results.
- Click navigates to /courses/:slug.

Step 2: CurriculumOutline at src/components/courses/CurriculumOutline.tsx
- Props: course (with modules.lessons expanded), variant ('preview' | 'player' | 'instructor-editor'), progress (optional map of lesson_id to status), onLessonClick.
- Renders an accordion of modules. Each module header: title, lesson count, total duration.
- Inside: list of lessons with lesson-type icon (video: play-circle, text: file-text, pdf: file, quiz: help-circle, assignment: edit, external_link: external-link), title, duration, completion checkmark (if progress provided), lock icon (if not is_preview and the user is not enrolled in preview mode).
- preview variant: expands first module by default, shows lock icons, lessons are not clickable unless is_preview.
- player variant: current lesson is highlighted with an accent bar, clicking navigates to that lesson, completed lessons have a filled check.
- instructor-editor variant (used in Phase 6): lessons are draggable (dnd-kit), has inline rename, add lesson button per module, delete buttons, "Add module" at the bottom.

Step 3: ProgressBar at src/components/courses/ProgressBar.tsx
- Props: value (0-100), size ('sm' | 'md' | 'lg'), showLabel (boolean).
- Simple colored bar with optional "X% complete" label underneath.

Step 4: LessonIcon at src/components/courses/LessonIcon.tsx
- Props: lessonType.
- Maps each type to a lucide icon with a consistent size and color.

Step 5: RichText at src/components/content/RichText.tsx
- Renders markdown (or HTML, depending on what's stored) using react-markdown with remark-gfm and rehype-raw plugins.
- Prose styles via Tailwind's typography plugin (install @tailwindcss/typography first if not present).

Step 6: VideoPlayer at src/components/content/VideoPlayer.tsx

This is the most important component in the app. Full spec:

Props:
```ts
type VideoPlayerProps = {
  lesson: Lesson            // full lesson record (all video_* fields, captions, chapters, duration)
  course: Pick<Course, 'title' | 'slug' | 'default_completion_threshold' | 'default_video_player_theme'>
  initialPosition?: number   // seconds, from lesson_progress.last_position_seconds
  disableProgressTracking?: boolean  // true when rendering as a marketing-page preview
  onProgress?: (state: { position: number; watched: number; duration: number }) => void
  onComplete?: () => void
  autoPlayNext?: () => void  // called when the after-video countdown elapses; parent routes to the next lesson
}
```

Source resolution inside the component:
- video_source === 'youtube': URL is `https://www.youtube.com/watch?v={video_youtube_id}`
- video_source === 'vimeo': URL is `https://vimeo.com/{video_vimeo_id}`
- video_source === 'directus_file': URL is `${VITE_DIRECTUS_URL}/assets/{video_file}` with credentials; SDK helper is fine
- video_source === 'external_url': URL is raw video_url (react-player auto-detects mp4 vs HLS)

Internals:
- react-player rendered with controls=false. Custom controls overlay drawn on top. If on mobile Safari and overlay cannot drive the underlying player, fall back to controls=true for that session.
- Captions: load lesson.video_captions into react-player's `config.file.tracks` (or equivalent for iframe sources). Use language_code as srclang, label as label, is_default as default.
- Chapters: parse lesson.video_chapters JSON; render chapter ticks on the scrub bar. Hover a tick shows the chapter title in a tooltip.

Custom controls shell:
- Top row: lesson title (left), course title (right, muted).
- Bottom row: play/pause, back-10s, forward-10s, scrub bar (with buffered range, played range, chapter ticks, thumbnail hover preview when available), current / total time, volume, playback speed (0.5, 0.75, 1, 1.25, 1.5, 1.75, 2), captions menu (lists languages from video_captions plus Off), quality menu (only for HLS with multiple renditions), picture-in-picture, fullscreen.

Keyboard shortcuts while the player is focused:
- Space: play/pause
- Left / Right arrow: -5s / +5s
- Shift + Left / Right: -10s / +10s
- Up / Down arrow: volume +/-
- M: mute
- F: fullscreen
- C: toggle captions
- 0 through 9: jump to 0 through 90 percent

Progress tracking (skip entirely when disableProgressTracking=true):
- On play, run a 1-second tick. Maintain a Set<number> of whole-second positions watched (Math.floor of current time).
- Every 15 seconds of wall-clock playback, call onProgress({ position: currentPlayheadSeconds, watched: set.size, duration: reportedDuration }).
- Also call onProgress on pause, seek, tab hide (visibilitychange), route change (beforeunload + React Router leave listener), and fullscreen change.
- Compute threshold = (lesson.completion_threshold ?? course.default_completion_threshold) / 100. When set.size / duration >= threshold, call onComplete() exactly once; do not continue writing progress beyond that point.

Resume:
- If initialPosition is provided AND lesson.resume_from_last_position !== false, seek to initialPosition on player ready. Show a small 5-second toast "Resuming from {formatted position}" with a "Start from beginning" link that seeks to 0.

Autoplay next:
- After onComplete fires AND the video reaches its end, render a 10-second "Next up: {next lesson title}" overlay with a Cancel button. On timeout or confirm, call autoPlayNext(). If no next lesson, show a "You finished the course" state instead (parent decides the routing).

Theming: respect course.default_video_player_theme ('light' | 'dark'). The controls shell swaps its palette accordingly.

Accessibility: all controls are keyboard-accessible, all buttons have aria-labels, captions default to on when a default track is marked is_default.

Expose a "Mark as complete" button below the player for manual completion as a fallback. Calling it fires onComplete().

Step 7: PdfViewer at src/components/content/PdfViewer.tsx
- Wraps react-pdf. Shows page navigation, zoom, download button.

Step 8: RichTextEditor at src/components/content/RichTextEditor.tsx
- TipTap-based editor for instructors. Toolbar with bold, italic, underline, heading, bullet list, numbered list, link, image, code block. Emits HTML string.

Step 9: StarRating at src/components/ui-custom/StarRating.tsx
- Renders 1-5 stars. Two modes: display (read-only, supports half stars) and input (click to set).

Step 10: Announcement at src/components/courses/Announcement.tsx
- Pin icon if pinned. Author avatar + name, title, body (rich text), published_at relative.

Step 11: EmptyState at src/components/ui-custom/EmptyState.tsx
- Generic empty placeholder: icon, title, description, primary CTA.

Commit each in its own commit.
```

**Verify:** The components exist and type-check. No real pages yet.

---

# Phase 3: Public pages

## Prompt LF4: Home, course catalog, course detail, category and instructor pages

```
Goal: build the public-facing marketing and discovery surface. All of these must work without login (Directus Public role has read permissions on published courses).

Step 1: src/pages/Home.tsx
- Hero: big headline, subtext, CTA button "Browse courses". Background: subtle gradient or a hero image.
- Category strip: horizontal scroll of CategoryCard components showing the top-level categories with icons and course counts. Click navigates to /categories/:slug.
- Featured courses strip: query courses where status = Published, visibility = Public, sort by -average_rating, limit 12. Render as a horizontal-scrolling row of CourseCards.
- "Popular in Web Development" strip: categories[0]'s courses.
- "Newly added" strip: sort by -published_at, limit 12.
- Featured instructors strip: query directus_users where role = Instructor, sort by -total_students, limit 6. InstructorCard component.
- Testimonials section: pull recent 5-star reviews, render as a carousel.
- Footer CTA: "Start learning today" with sign-up button.

Step 2: src/pages/CoursesList.tsx (the /courses catalog)
- Left sidebar (sticky, 260px): filter panel.
  - Category (multi-select tree)
  - Difficulty (checkboxes)
  - Language (checkboxes)
  - Price: Free / Paid toggle and/or price range
  - Duration: Short (<2h) / Medium (2-10h) / Long (>10h)
  - Rating: "4+ stars", "3+ stars"
  - Has certificate (boolean)
- Main content: search input at top (debounced, queries `search` on Directus), sort dropdown (Relevance, Newest, Highest rated, Most popular, Price low-high, Price high-low), results count.
- CourseCard grid, 3 columns desktop, 2 tablet, 1 mobile.
- Pagination at bottom, 24 per page.
- URL reflects filters via query string (?category=web-dev&difficulty=Beginner) so filters are shareable.

Step 3: src/pages/CourseDetail.tsx at /courses/:slug
- Query readItems('courses', { filter: { slug: { _eq: slug } }, limit: 1, fields: ['*', 'instructor.{id,first_name,last_name,avatar,bio,headline,total_students,total_courses,average_rating}', 'co_instructors.directus_users_id.{id,first_name,last_name,avatar}', 'category.{id,name,slug}', 'tags.course_tags_id.{id,name,slug}', 'modules.{id,title,description,sort_order,lessons.{id,title,lesson_type,duration_minutes,is_preview,sort_order}}', 'prerequisites.courses_id.{id,title,slug}'] }).
- Layout: two columns. Left (flex-1): course content. Right sticky (350px): enrollment card.
- Left side:
  - Breadcrumb: Category → Course
  - Title (h1), subtitle
  - Rating + review count, enrollment count, last updated date
  - Instructor row: avatar, "Created by {name}", link to instructor profile
  - Trailer video embed (if trailer_video_url)
  - Description (RichText)
  - Learning objectives (bulleted list from learning_objectives JSON)
  - Prerequisites (list with links to required courses)
  - Curriculum: CurriculumOutline variant="preview", showing total lesson/module counts and total duration. Any lesson with is_preview = true (only possible on free courses per the backend rule) shows a "Preview" label and is clickable. Clicking opens a VideoPlayer modal with disableProgressTracking=true so the anonymous visitor can sample the lesson without enrolling.
  - About the instructor (bio, headline, stats, other courses link)
  - Reviews: aggregate rating breakdown (5 stars: X, 4 stars: Y, etc.), individual review cards, pagination. If the viewer is logged in AND enrolled, show a "Leave a review" card. If their enrollment.progress_pct < 50, disable the form and show a helper message "You can leave a review once you pass 50 percent of the course ({progress_pct}% so far)." The backend review gating flow enforces the same rule; the UI just saves the user a failed submit.
- Right card (sticky):
  - Cover image
  - Price large, or "Free" badge
  - Primary button: "Enroll now" (if logged out: "Sign up to enroll", redirects to /signup?then=/courses/:slug; if logged in but not enrolled: creates enrollment and redirects to /learn/:courseSlug; if already enrolled: "Continue learning" linking to resume)
  - Included items: "X lessons", "Y hours of content", "Certificate of completion on finishing the course" (always shown; the backend issues via the global default template), "Full lifetime access", "Downloadable resources" (if any)
  - Share buttons

Step 4: src/pages/CategoriesList.tsx at /categories
- Renders the category tree. Parent categories as big cards, children as pills under them.

Step 5: src/pages/CategoryDetail.tsx at /categories/:slug
- Header: category name, description, course count.
- Filter bar (smaller version of the catalog filter).
- CourseCard grid of courses in this category (including sub-categories).

Step 6: src/pages/InstructorsList.tsx at /instructors
- Grid of InstructorCard: avatar, name, headline, students count, courses count, rating. Click -> /instructors/:id.

Step 7: src/pages/InstructorProfile.tsx at /instructors/:id
- Header: cover banner, avatar, name, headline, stats (students, courses, rating), bio, social links.
- "Courses by this instructor" section: CourseCard grid.

Step 8: src/pages/VerifyCertificate.tsx at /verify/:code
- Fetches certificate by verification_code via the public permission we set.
- Renders: large "Certificate Verified" checkmark, certificate_number, learner name, course title, issued_at, final_grade, instructor name.
- If not found: "Certificate not found" message with suggestion to check the code.

Step 9: global search (command palette) wire-up: cmd+k opens a command dialog that queries courses, instructors, and categories in parallel and shows top 3 of each. Navigate on select.

All of these pages must work for unauthenticated users. Use TanStack Query with staleTime 5 minutes for public data.

Commit and push.
```

**Verify:** Without logging in, browse /courses, filter by a category, search for a keyword, open a course detail. Try to enroll: it redirects to /signup. Sign up, land on the course player (from the next phase, for now the link to /learn/:courseSlug 404s since we haven't built it yet).

---

# Phase 4: Learner dashboard and course player

## Prompt LF5: Learner dashboards, course player layout, lesson rendering

```
Goal: the authenticated learner experience. This is where learners spend most of their time.

Step 1: src/pages/learner/MyLearning.tsx at /my/learning
- Header: "My Learning", filter tabs (All, In progress, Completed, Dropped).
- Continue learning section at top: the 3 most recently updated enrollments, as CourseCard variant="continue".
- Grid of enrolled courses (CourseCards showing progress).
- Empty state: "You have not enrolled in anything yet. Browse the catalog."

Step 2: src/pages/learner/MyCompleted.tsx at /my/completed
- Grid of completed courses. Each card shows completion date, final grade, "View certificate" button if one was issued.

Step 3: src/pages/learner/MyCertificates.tsx
- Grid of certificates. Each: thumbnail rendering of the cert template, course title, issued_at, certificate_number. Click opens CertificateViewer modal.

Step 4: src/pages/learner/MyBadges.tsx
- Grid of earned badges with the badge icon, name, awarded_at, context. Empty state encourages earning.

Step 5: src/pages/learner/MyProfile.tsx
- Form to edit own directus_users: first_name, last_name, avatar (file upload), bio, headline, social_*.
- Saves via directus.request(updateUser(userId, ...)).

Step 6: src/pages/learner/CoursePlayer.tsx at /learn/:courseSlug and /learn/:courseSlug/:lessonId
- Fetches the course with full curriculum, the user's enrollment, and lesson_progress for all lessons in that course.
- If no enrollment exists, redirect to /courses/:slug so user can enroll.
- Three-column layout:
  - Left sidebar (320px, collapsible): CurriculumOutline variant="player". Sticky. Shows progress per lesson and overall course progress at top.
  - Center (flex-1): current lesson content. Renders based on lesson.lesson_type using the primitives from Phase 2:
    - video: VideoPlayer with lesson prop (the full lesson record including all video_* fields), course prop (title, slug, default_completion_threshold, default_video_player_theme), initialPosition = lesson_progress.last_position_seconds, autoPlayNext callback that routes to the next lesson in the curriculum. onProgress writes lesson_progress.last_position_seconds, watched_seconds, last_watched_at (call upsertLessonProgress). onComplete calls markLessonComplete which sets status = completed and completed_at = now. The backend Recompute enrollment progress flow updates the enrollment.
    - text: RichText of text_body. "Mark as complete" button at bottom.
    - pdf: PdfViewer of pdf_file. "Mark as complete" button.
    - quiz: summary card showing quiz title, description, time limit, max attempts, passing score. "Start quiz" button that creates a new quiz_attempt (status in_progress, attempt_number computed) and navigates to /quiz/:attemptId.
    - assignment: summary card showing title, description, instructions, due date, max points. "Submit assignment" button navigates to /assignment/:assignmentId.
    - external_link: iframe (if embed allowed) or an "Open in new tab" button.
  - Right sidebar (300px, collapsible): tabs for Transcript (renders lesson.video_transcript as markdown; highlights the nearest line to the current playhead if the transcript uses [mm:ss] prefixes), Chapters (clickable list from lesson.video_chapters JSON; click seeks the player), Resources (downloads and external links from lessons_resources).
- Bottom bar: prev lesson, lesson title, next lesson. Keyboard: left/right arrow navigates between lessons.
- Top bar (minimal): course title, close button back to /my/learning, progress bar.

Step 7: lesson_progress mutation helpers in src/lib/queries.ts:
- upsertLessonProgress(lessonId, enrollmentId, data): finds existing progress for (user, lesson) or creates one, then updates with the provided data. Fields written on video progress: last_position_seconds, watched_seconds, last_watched_at, time_spent_seconds, status ('in_progress' on first write).
- markLessonComplete(lessonId, enrollmentId): sets status = completed, completed_at = now, last_watched_at = now. Invalidates the course enrollment query so progress_pct refetches (backend Recompute enrollment progress flow handles the math).
- Batch writes: the VideoPlayer throttles progress writes to every 15 seconds plus flushes on pause/seek/hide/unload. The helper should debounce back-to-back writes within 2 seconds to avoid doubled-up requests when several events fire simultaneously (e.g. pause followed by tab hide).

Step 8: when a lesson_progress flips to completed, invalidate the ['enrollment', courseSlug] query and the ['course-progress', courseId] query.

Commit and push.
```

**Verify:** As a learner, enroll in a course, land in /learn/:courseSlug, see the curriculum sidebar, click a video lesson, watch a bit, pause, refresh, confirm the video resumes at the paused position. Mark a text lesson complete; confirm progress_pct updates and the checkmark appears in the sidebar. Completing a quiz lesson correctly updates progress (via the backend flow).

---

# Phase 5: Quiz runner and assignment submission

## Prompt LF6: Quiz runner, assignment submission, graded view

```
Goal: distinct fullscreen experiences for taking a quiz and submitting an assignment.

Step 1: src/pages/learner/QuizRunner.tsx at /quiz/:attemptId
- Fullscreen layout, no layout chrome (no headers, no sidebars).
- Top bar: quiz title, question counter ("Question 3 of 10"), timer (if quiz.time_limit_minutes), "Save and exit" button (saves current responses, status stays in_progress).
- Center: current question.
- Renders based on question.question_type:
  - single_choice: list of options as radio buttons.
  - multiple_choice: list of options as checkboxes.
  - true_false: two buttons.
  - short_answer: single-line text input.
  - essay: textarea with rich text.
  - matching and ordering: v2 (skip for now; just show "Not implemented").
- Bottom: Prev button, "Mark for review" toggle, Next button. On the last question: "Submit quiz" button (confirm dialog).
- Flag-for-review list: a collapsible summary in the top bar.
- Autosave: every answer change, upsert the quiz_responses record for (attempt, question) with the current answer.
- On submit: update quiz_attempts.status = submitted. Wait for the backend auto-grade flow to run, then poll the attempt until status = graded (or show "Waiting for instructor" if there are essay questions).
- After submission: show a results page (src/pages/learner/QuizResult.tsx) with score, passed/failed status, per-question breakdown (if quiz.show_correct_answers allows at this stage). "Back to course" button.
- If max_attempts limit would be exceeded, block starting a new attempt in the CoursePlayer (UI check; backend also enforces).

Step 2: src/pages/learner/AssignmentSubmission.tsx at /assignment/:assignmentId
- Not fullscreen; uses LearnerLayout.
- Header: assignment title, due date (with "Late" warning if past due), points, passing score.
- Instructions (RichText).
- Rubric (RichText, collapsible).
- Submission form based on assignment.submission_types:
  - file_upload: multi-file upload to Directus files, display list with remove buttons.
  - text_entry: RichTextEditor (TipTap).
  - url: input field.
- "Save draft" and "Submit" buttons. Draft saves submission with status = draft. Submit confirms and sets status = submitted.
- If an existing submission exists: show its current status, grade (if graded), grader_feedback. If status = returned_for_revision, allow editing and resubmitting.
- If submissions are graded: show the final grade prominently, with feedback below.

Step 3: src/pages/learner/AssignmentList.tsx at /my/assignments (optional)
- List of all assignments across the learner's courses with status, due date, grade. Useful for time management.

Commit and push.
```

**Verify:** Take a quiz end to end: answer all question types, submit, see score. Submit an assignment with a file and text response. Confirm the file was uploaded to Directus files. As an instructor (Phase 7), grade the submission; as the learner, refresh the assignment page and see the grade.

---

# Phase 6: Certificates and badges rendering

## Prompt LF7: Certificate viewer with print-to-PDF and badges display

```
Goal: render earned certificates and badges, let learners download cert PDFs.

Step 1: src/components/certificates/CertificateRenderer.tsx
- Props: certificate (with template + user + course + course.instructor expanded).
- Each certificate carries its own template reference (set at issue time by the backend flow using the is_default template). Reads certificate.template.html_template and substitutes merge fields: {{learner_name}}, {{course_title}}, {{completion_date}}, {{verification_code}}, {{instructor_name}}, {{grade}}, {{issuer_name}}, {{issuer_title}}.
- Renders the resulting HTML inside a styled container that respects template.background_image, template.accent_color, and template.signature_image.
- Renders at a fixed A4 landscape aspect ratio (297mm x 210mm) with proper print styles.

Step 2: src/pages/learner/CertificateView.tsx at /my/certificates/:id
- Fetches the certificate and template.
- Renders CertificateRenderer.
- "Download PDF" button: uses html2canvas to snapshot the CertificateRenderer element, feeds into jsPDF to produce a PDF, triggers download. Cache the PDF by storing it back in the certificate's pdf_file once generated (optional for v1; pure client-side is fine).
- "Share" button: copies a link to /verify/:verificationCode to clipboard.
- "Print" button: window.print() with print styles scoped to the certificate.

Step 3: update src/pages/learner/MyBadges.tsx to use a BadgeCard component that renders the badge icon, name, awarded_at (relative), and awarded_context. Hover reveals a tooltip with full description and criteria.

Step 4: update the /verify/:code page to use CertificateRenderer for visual consistency.

Commit and push.
```

**Verify:** From /my/certificates, open a certificate, see a printable rendering. Download the PDF; open it and confirm it looks correct. Navigate to the /verify/:code URL in an incognito window and confirm it renders for an unauthenticated visitor.

---

# Phase 7: Instructor pages

## Prompt LF8: Instructor dashboard, course list, course authoring

```
Goal: the instructor workflow. This is where the most dense forms live.

Step 1: src/pages/instructor/InstructorDashboard.tsx at /instructor/dashboard
- Widgets:
  - Total students across all my courses (big number)
  - Published courses count (big number)
  - Pending grading count (submissions with status = submitted OR quiz_responses where graded_by is null and question_type in essay/short_answer, for my courses). Links to the grading queue.
  - Recent enrollments: last 10 enrollments across my courses.
  - Revenue placeholder card: total enrollment_count * course.price. Label "Template metric; real billing not wired in v1".
  - Average rating across my courses.
- Recent announcements: my recent course announcements.

Step 2: src/pages/instructor/MyCourses.tsx at /instructor/courses
- "+ Create course" button top right (opens a simple drawer with just title and category, then redirects to the full editor).
- Tabs: All, Published, Draft, Archived.
- Table of my courses: title, status badge, students, completions, average rating, published_at. Each row has actions: Edit (navigates to editor), View (navigates to /courses/:slug in a new tab), Duplicate, Archive.

Step 3: src/pages/instructor/CourseEditor.tsx at /instructor/courses/:id/edit
- Tabs across the top: Details, Curriculum, Pricing, Settings, Announcements.

- Details tab: form with title, slug (auto-from-title), subtitle, description (RichTextEditor), learning_objectives (dynamic list), category (M2O picker), tags (TagPicker for course_tags), cover_image (file upload), trailer_video_url, difficulty, language, duration_minutes (computed preview + override), default_completion_threshold (slider 50-100, default 90), default_video_player_theme (light/dark). "Save" button; autosave draft every 5s.

- Curriculum tab: CurriculumOutline variant="instructor-editor". Features:
  - Drag to reorder modules (dnd-kit)
  - Drag to reorder lessons within modules and across modules
  - "Add module" button at the bottom
  - Per-module: rename, delete, "Add lesson" button that opens a dialog to pick lesson_type and title
  - Per-lesson: click to open a side drawer with the lesson editor (title, lesson_type, sort_order, duration_minutes, is_preview, required, completion_criteria, plus the conditional content fields for that type)
  - is_preview toggle: disabled with an explanatory tooltip when the parent course has price > 0. Only free courses can have preview lessons (enforced by the backend Free preview validation flow; the UI saves the instructor a failed save).
  - Lesson editor for video lessons (see Step 3a below for the full video editor). Other types keep their simpler editors: text_body via RichTextEditor, pdf_file upload, quiz picker, assignment picker, external_url.
  - Separate "Manage quizzes" and "Manage assignments" sub-sections within the drawer for creating/editing the linked quiz or assignment (see Step 4 and Step 5)

Step 3a: Video lesson editor (part of the curriculum drawer when lesson_type = video)
- "Source" segmented control with four options: YouTube, Vimeo, Upload to Directus, External URL. Maps to video_source.
- Source-specific inputs:
  - YouTube: single input field accepting either full URL or 11-char ID. Below it, a live thumbnail preview once the ID is valid.
  - Vimeo: same pattern for Vimeo.
  - Upload to Directus: dropzone file upload (mp4, webm). On upload, read the file into a hidden <video> element to extract duration, auto-fill video_duration_seconds.
  - External URL: input field for mp4 or HLS URL, plus a "Test playback" button that opens a mini VideoPlayer preview.
- Duration: auto-filled from oEmbed (YouTube/Vimeo) or the uploaded file; editable as a fallback.
- Thumbnail override: optional file upload.
- Captions repeater: for each track, upload a .vtt file and select language_code (ISO dropdown), label, is_default. Maps to lessons_captions_files.
- Chapters repeater: minute input, second input, title input. Serializes to video_chapters JSON.
- Transcript: RichTextEditor (markdown).
- Advanced accordion (collapsed by default): completion_threshold (slider 50-100, placeholder shows course default), resume_from_last_position toggle, allow_download toggle (disabled for YouTube/Vimeo sources).

- Pricing tab: is_free toggle, price, currency. Enrollment limit, enrollment deadline, self_paced toggle, passing_score.

- Settings tab: status (Draft/Published/Archived with a "Publish" button that performs validation client-side and calls the update), visibility, co_instructors (M2M), prerequisites (M2M). Certificates are issued using a single global template managed by admins; no per-course template picker here. Include a small info banner linking admins to the Certificate Templates admin page.

- Announcements tab: simple list + create form for announcements scoped to this course.

Step 4: QuizEditor at src/components/instructor/QuizEditor.tsx (opened in a dialog or a separate page /instructor/courses/:id/quizzes/:quizId/edit)
- Fields: title, description, time_limit_minutes, max_attempts, passing_score, shuffle_questions, shuffle_options, show_correct_answers, show_results_immediately.
- Question list below, drag to reorder. Each question card: question_type dropdown, prompt (RichTextEditor), points. For choice types, inline options list with "is_correct" toggle and "Add option" button.
- "Add question" button with question_type picker.

Step 5: AssignmentEditor at src/components/instructor/AssignmentEditor.tsx
- Fields: title, description (RichTextEditor), instructions (RichTextEditor), due_date, max_points, passing_score, allow_late_submissions, late_penalty_pct, submission_types (multi-select), rubric (RichTextEditor).

Step 6: src/pages/instructor/CourseStudents.tsx at /instructor/courses/:id/students
- Table of enrollments for this course: student name + avatar, email, enrolled_at, progress_pct (bar), last_lesson, final_grade, certificate_issued.
- Filters: status (active, completed, dropped), progress buckets (0, 1-50, 51-99, 100).
- Click a row to open a drawer with full lesson_progress breakdown for that student.

Step 7: src/pages/instructor/GradingQueue.tsx at /instructor/courses/:id/grading
- Two tabs: Assignments, Essay responses.
- Assignments: list of submissions with status = submitted (and graded, as a secondary tab), student + assignment + submitted_at + lateness badge + files/text/url preview. Click opens a grading drawer: read the submission, enter grade, grader_feedback (RichTextEditor), status (graded or returned_for_revision). Save triggers the backend flow to update enrollment progress.
- Essay responses: list of quiz_responses where question.question_type in (essay, short_answer) AND is_correct is null. Click opens a drawer: read the response, enter is_correct (true/false), points_earned, grader_feedback. Save triggers grade recalc on the parent attempt.

Step 8: src/pages/instructor/CourseAnalytics.tsx at /instructor/courses/:id/analytics
- Charts (recharts):
  - Enrollments over time (line chart, last 90 days)
  - Completion rate (percentage, visualized as a donut)
  - Average lesson completion rate per lesson (bar chart showing where learners drop off)
  - Average quiz score per quiz
  - Rating distribution
- Key numbers: total students, completion count, average progress, average rating.

Commit and push.
```

**Verify:** As an instructor, create a new course from My Courses. Add two modules, three lessons each (mix of video, text, quiz). Attach a quiz and add five questions including an essay. Publish the course (should succeed since it has content). Log in as a learner, enroll, submit a quiz with the essay. Back as instructor, open the grading queue and grade the essay. Confirm the learner's attempt flips to graded and they can see the final score.

---

# Phase 8: Admin pages

## Prompt LF9: Admin console

```
Goal: the admin experience. Smaller surface; reuse CRUD patterns.

Step 1: src/pages/admin/AdminDashboard.tsx at /admin
- Platform-wide stats: total users by role, total courses by status, total enrollments, total certificates issued, total revenue (placeholder).
- Recent activity feed: last 20 enrollments, publishes, certifications across the platform.

Step 2: src/pages/admin/UsersList.tsx at /admin/users
- Table of all directus_users (full fields). Filters: role, status, created_at.
- Create user, edit user in drawer, disable user (sets status = inactive).

Step 3: src/pages/admin/CategoriesManage.tsx at /admin/categories
- Tree view of categories (dnd-kit for reordering and moving under parents).
- "+ Add category" button. Per-node: edit, delete, view courses.

Step 4: src/pages/admin/BadgesManage.tsx at /admin/badges
- Grid of badges. Create, edit, delete. Assign manually to users for criteria_type = manual badges.
- Badge editor form: name, description, icon (file upload), color, criteria_type (dropdown), criteria_value as a plain JSON textarea with a "Docs" link next to it that opens a popover with the criteria_value shape for each type (examples: `{"course_id": "uuid"}` for course_completion, `{"count": 5}` for courses_count, `{"quiz_id": "uuid"}` or `{"count": 3}` for quiz_perfect_score, `{"days": 7}` for streak, `{}` for manual). No visual criteria builder for v1; the textarea plus docs is enough. Use a JSON syntax-highlighted editor (the same input-code equivalent as in Directus Studio) if a lightweight one is already available through a library we installed; otherwise a plain textarea with a JSON.parse validation on save is fine.

Step 5: src/pages/admin/CertificateTemplates.tsx at /admin/certificate-templates
- List of templates. Exactly one row is marked as the active default (is_default = true), badged visually. The Issue Certificate backend flow uses this row for all new certificates.
- Create new template with a side-by-side editor: HTML template on the left (code editor), live preview on the right using CertificateRenderer with a sample data set (Jane Doe, "Sample Course", today's date, "VERIFY-CODE-1234", "John Smith", "92", issuer_name, issuer_title).
- Form fields: name, html_template, background_image, accent_color, issuer_name, issuer_title, signature_image, is_default toggle. Setting is_default = true on save warns the admin that the previous default will be unset automatically (via the backend flow).
- "Set as default" quick action per row in the list.

Step 6: src/pages/admin/ReviewsModerate.tsx at /admin/reviews
- Filter by is_approved = false (default), course, rating.
- Approve / reject / delete actions. Bulk selection.

Step 7: src/pages/admin/SiteAnnouncements.tsx at /admin/announcements
- List and create site-wide announcements (course = null).

Commit and push.
```

**Verify:** As admin, create a new badge with criteria_type = manual, award it to a test user. That user should see it on /my/badges. Update a category's name and confirm the change propagates to the public catalog.

---

# Phase 9: Deploy to Vercel

## Prompt LF10: Vercel deployment

```
Goal: deploy the LMS frontend as a brand new Vercel project. Do not touch the CRM Vercel project.

Step 1: use the Vercel MCP to create a new project named "directus-lms-frontend", linked to the "directus-lms-frontend" GitHub repo.
- Framework preset: Vite.
- Build command: npm run build.
- Output directory: dist.

Step 2: set environment variables on all three environments:
- VITE_DIRECTUS_URL (same Railway URL as the CRM; the backend is shared)
- VITE_PUBLIC_APP_URL

Step 3: trigger the first production deploy. If the build fails, report the error before fixing.

Step 4: capture the Vercel production URL. Use the Directus MCP to read the current CORS_ORIGIN value on Directus and append the new LMS Vercel URL (and its *.vercel.app preview pattern). If the MCP cannot edit env vars on Railway, report which env var needs updating and its new value.

Step 5: add vercel.json for SPA rewrites:

{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}

Step 6: verify the deployed site. Log in as a seeded learner. Navigate to /courses, open a course, enroll, complete a lesson. Check that cookies are being sent (network tab, requests to Directus should include credentials).

Step 7: add a preview deploy test. Open a PR modifying the homepage text; confirm Vercel creates a preview deployment and the CORS config allows the preview URL.

Report the production URL.
```

**Verify:** Visit the production URL. Do a full learner journey: browse catalog, sign up, enroll, watch a video, take a quiz, submit an assignment. Visit the CRM production URL from before; confirm it still works (backend is shared, should not have regressed).

---

# What to do if Cursor drifts

- **Cursor pulls from CRM collections**: stop. This frontend only reads LMS collections. Have Cursor delete any imports or types referencing companies, contacts, deals, etc.
- **Cursor invents a field or wrong collection name**: stop and force a Directus MCP schema query for that collection. Paste the response into its context.
- **Cursor's styling is identical to the CRM's**: the LMS is content-forward, not admin-dense. Enforce distinct visual language: hero images, larger cards, warmer tone, more whitespace.
- **Cursor skips rich text rendering**: LMS content is heavy on markdown. If it renders raw markdown strings in the UI, go back and require the RichText component.
- **Quiz runner gets too fancy and bundles a huge question-builder in the learner UI**: the quiz runner is for taking quizzes only. The question builder belongs in the instructor UI. Keep them separate.
- **Cursor adds a certificate_template picker to the course editor**: stop. Certificates use a single global default managed by admins in /admin/certificate-templates. There is no per-course template field.
- **Cursor lets instructors toggle is_preview on paid courses**: stop. The toggle must be disabled with an explanatory tooltip when the parent course has price > 0. The backend Free preview validation flow rejects otherwise.
- **Cursor builds a full video progress system from scratch instead of using the VideoPlayer component**: stop. All video rendering goes through components/content/VideoPlayer.tsx. No inline <video> tags elsewhere.
- **Cursor writes video progress on every tick instead of throttling**: stop. The VideoPlayer batches writes every 15 seconds plus flush-on-event. Every-second writes will hammer Directus.
- **Cursor allows a review to post without checking enrollment progress**: stop. The UI gates the review form at 50 percent progress. The backend flow is the backstop, not the only check.

# Deliberately not in v1

- SCORM and xAPI content
- Live sessions and scheduled cohorts
- Discussion threads per lesson or course
- Learning paths (sequences of courses)
- Points and leaderboards beyond badges
- Stripe / payment processing
- Email notifications (rely on Directus flows + external email later)
- Multi-language course content
- Offline/downloadable mobile content
- Mobile apps
- AI course recommendations
- Drip content scheduling

Each is a separate future phase.
