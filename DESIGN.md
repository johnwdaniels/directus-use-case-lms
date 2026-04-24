# LMS Template Design

A full design for the LMS template before any Cursor execution. Read this end to end, push back on anything, and once you sign off I'll align the execution files (`PLAN.md`, `MCP_PROMPTS.md`, `FRONTEND_PROMPTS.md`, `VIDEO_DESIGN.md`) to match.

## 1. What we're building

A self-paced online course platform. Think Udemy, Teachable, Coursera. Instructors create courses made of modules and lessons. Learners enroll, work through lessons, take quizzes, submit assignments, earn certificates and badges. Admins run the site and moderate content.

Backend is the same Directus instance that hosts the CRM template. The LMS collections live alongside CRM collections without touching them. Frontend is a brand new React app on its own Vercel project at its own domain.

## 2. Roles

Four roles in Directus, created fresh for the LMS without modifying the CRM roles.

- **LMS Admin**: full access to all LMS collections. Runs the site.
- **Instructor**: can create and edit their own courses, modules, lessons, quizzes, assignments. Can see enrollments in their courses, grade submissions, respond to reviews, post announcements. Cannot see other instructors' courses in edit mode.
- **Learner**: can browse the catalog, enroll, track their own progress, submit quizzes and assignments, earn certificates and badges, leave reviews.
- **Guest Browser** (Public role): can browse the catalog, view course detail pages, see free preview lessons, verify a certificate by code. No personal data.

The existing CRM roles (CRM Admin, Sales, etc.) stay as they are. A single user can be assigned both an LMS role and a CRM role if needed.

## 3. Data model

Roughly 20 collections. Grouped below by what they do.

### 3.1 Taxonomy

- **`categories`**: hierarchical (self-referencing `parent` M2O). Courses belong to one category. Tree used on the catalog page for filtering.
- **`course_tags`**: flat list of tags. M2M to courses. Named `course_tags` rather than `tags` so it doesn't collide with the CRM's existing `tags` collection.

### 3.2 Course structure

- **`courses`**: the top-level unit. Fields include title, slug, short description, long description (markdown), cover image, trailer video, instructor (M2O to `directus_users`), category, tags (M2M), level enum (beginner/intermediate/advanced), language, price (0 = free), currency, status (draft/published/archived), published_at, duration_minutes (denormalized total), lesson_count (denormalized), certificate_template (nullable M2O), default_completion_threshold (percent for video completion), featured boolean.
- **`modules`**: a course is made of ordered modules. Fields: course (M2O), title, description, sort_order.
- **`lessons`**: the playable unit. Fields: module (M2O), title, slug, sort_order, lesson_type enum (video, text, pdf, quiz, assignment, external_link), is_preview boolean (if true, viewable without enrollment), estimated_duration_minutes, plus content fields that vary by type with conditional visibility in Studio:
  - `video_*` fields (detailed in `VIDEO_DESIGN.md`)
  - `content_markdown` for text lessons
  - `pdf_file` for PDF lessons
  - `quiz` M2O for quiz lessons
  - `assignment` M2O for assignment lessons
  - `external_url` + `external_url_title` for external link lessons
- **`lesson_resources`**: attachments on a lesson. M2O to lessons, M2O to `directus_files`, plus title and optional description. Rendered in the Resources tab under the player.

### 3.3 Enrollment and progress

- **`enrollments`**: unique on (user, course). Fields: user, course, enrolled_at, started_at (first lesson opened), completed_at, progress_percent (denormalized 0-100), last_lesson (M2O, for "Continue learning"), status enum (active, completed, refunded), order (nullable M2O for paid enrollments).
- **`lesson_progress`**: unique on (user, lesson). Fields: user, lesson, enrollment (M2O, for queries), last_position_seconds, watched_seconds, completed_at, last_watched_at. Video-specific fields detailed in `VIDEO_DESIGN.md`. For non-video lesson types, `completed_at` is set when the learner clicks "Mark complete" or submits a quiz/assignment.

### 3.4 Assessments

- **`quizzes`**: attached to lessons. Fields: title, description, pass_percent (default 70), max_attempts (default 3, 0 = unlimited), shuffle_questions boolean, show_correct_answers enum (never, after_pass, always), time_limit_minutes (0 = untimed).
- **`questions`**: belongs to a quiz. Fields: quiz (M2O), sort_order, prompt (markdown), question_type enum (single_choice, multiple_choice, true_false, short_answer, essay, matching, ordering), points (default 1), explanation (shown after answered, markdown).
- **`question_options`**: for choice-based questions. Fields: question (M2O), sort_order, label, is_correct, match_pair (for matching questions).
- **`quiz_attempts`**: one row per attempt. Fields: user, quiz, started_at, submitted_at, score_points, score_percent, passed boolean, attempt_number.
- **`quiz_responses`**: one row per answered question per attempt. Fields: attempt (M2O), question (M2O), chosen_options (M2M for choice questions), text_response (for short_answer and essay), is_correct (auto-graded or null for essay pending manual grade), points_awarded, grader_notes.
- **`assignments`**: attached to lessons. Fields: title, instructions (markdown), max_points, accepted_file_types, max_file_size_mb, due_days_from_enrollment (nullable).
- **`submissions`**: one per user per assignment (latest wins, with history). Fields: user, assignment, submitted_at, file (M2O to `directus_files`), text_response (markdown), status enum (submitted, grading, graded, returned), score_points, score_percent, grader (M2O to users), grader_feedback (markdown), graded_at.

### 3.5 Credentials

- **`certificate_templates`**: reusable certificate designs. Fields: name, background_image (M2O), layout enum (classic, modern, minimal), merge_fields JSON (defines where name, course, date, instructor signature go), signature_image (nullable M2O), issuer_name, issuer_title. Preview rendered live in the admin UI.
- **`certificates`**: issued instances. Fields: user, course, enrollment, template, issued_at, verification_code (unique, URL-safe 12-char), pdf_file (M2O to `directus_files`, generated on issue). Publicly verifiable at `/verify/:code`.
- **`badges`**: reusable badge definitions. Fields: name, description, icon (M2O), criteria_type enum (complete_course, complete_category, quiz_score_above, streak, custom), criteria_value (JSON), is_active.
- **`user_badges`**: earned badges. Fields: user, badge, earned_at, evidence_context JSON (what triggered it).

### 3.6 Social and communication

- **`reviews`**: course reviews. Fields: user, course, rating (1-5), title, body (markdown), status enum (published, flagged, removed), created_at. Unique on (user, course). Instructors can reply but not edit.
- **`review_replies`**: instructor replies. Fields: review (M2O), author (M2O, must be course instructor), body, created_at.
- **`announcements`**: course-level announcements. Fields: course (M2O), author (M2O, instructor or admin), title, body (markdown), pinned boolean, visibility enum (all_enrolled, active_only), created_at. Shown on the learner dashboard when they visit a course they're enrolled in.
- **`site_announcements`**: site-wide, admin-only. Fields: title, body, severity enum (info, warning, critical), starts_at, ends_at, is_active. Banner at the top of the learner app while active.

### 3.7 Extensions to `directus_users`

Added on top of existing user fields without disturbing CRM fields:

- `bio` (markdown)
- `headline` (short tagline)
- `expertise` (tags)
- `social_twitter`, `social_linkedin`, `social_youtube`, `social_website`
- `total_students` (denormalized, updated nightly)
- `total_courses` (denormalized)
- `average_rating` (denormalized)
- `is_instructor` (boolean, so we can query instructors without joining the role table)

## 4. Video (summary, full detail in `VIDEO_DESIGN.md`)

Video is the most important lesson type and gets its own document. Quick recap here:

- Four sources: YouTube, Vimeo, Directus file upload, external URL (mp4 or HLS).
- One `<VideoPlayer />` component with a consistent UI across all four sources.
- Real progress tracking: counts unique seconds watched, not max scrub position. Lesson marks complete when watched seconds cross the threshold (default 90 percent).
- Captions (VTT files via a junction), transcripts, chapter markers on the scrub bar, playback speed, keyboard shortcuts, picture-in-picture, resume from last position, autoplay next.

## 5. Assessments in practice

**Quizzes** auto-grade everything except essay questions. The flow is: learner starts attempt (row in `quiz_attempts` created), answers questions (rows in `quiz_responses`), submits. A Directus Flow on `quiz_attempts.submitted_at` change computes score for all auto-gradable responses, sets `passed`, and writes back. Essay responses stay `is_correct = null` with `points_awarded = 0` until an instructor grades them manually in the Instructor Grading Queue, at which point the attempt score recomputes.

**Assignments** are always manually graded. Learner uploads a file and/or writes a text response. It lands in the instructor's Grading Queue. Instructor enters score and feedback. Learner sees the grade in their dashboard. Resubmission is allowed if the instructor returns it (`status = returned`).

## 6. Credentials in practice

**Certificates** are issued by a Directus Flow on `enrollments.completed_at` change. The Flow looks up the course's `certificate_template`, generates a verification code, renders the merged certificate as PDF (using a small Node script in the Flow that runs html2canvas + jspdf against the template), stores the PDF in `directus_files`, and creates the `certificates` row. The learner sees it on their "My Certificates" page and can share a public verify URL.

**Badges** are issued by a separate Flow that runs on schedule (nightly) and on key events (enrollment completion, quiz pass). It evaluates each active badge's `criteria_type` against the user's progress and inserts `user_badges` rows for new earns. Idempotent so re-runs don't duplicate.

## 7. Directus Flows

All the automation. Each one has a specific event trigger and a specific job.

1. **Course publish validation** (filter hook on `courses.items.update` when status changes to published): rejects the change if the course has zero modules, zero lessons, or missing cover image. Returns a clear error the instructor can act on.
2. **Normalize video source on lesson save** (filter hook on `lessons.items.create/update`): extracts clean IDs from pasted YouTube/Vimeo URLs, validates external URLs, auto-fills duration from oEmbed where possible.
3. **Auto-grade quiz on submit** (event hook on `quiz_attempts.items.update` when `submitted_at` goes from null to set): scores auto-gradable responses, computes percent, sets `passed`.
4. **Recompute enrollment progress** (event hook on `lesson_progress.items.create/update`): recalculates `enrollments.progress_percent`, updates `enrollments.last_lesson`, sets `enrollments.completed_at` if all lessons done.
5. **Issue certificate on enrollment completion** (event hook on `enrollments.items.update` when `completed_at` is set): generates verification code, renders PDF, creates `certificates` row.
6. **Update course denormalized counters** (event hooks on `lessons` and `modules` create/delete): keeps `courses.lesson_count` and `courses.duration_minutes` in sync.
7. **Update instructor denormalized stats** (scheduled nightly): recomputes `total_students`, `total_courses`, `average_rating` for every user with `is_instructor = true`.
8. **Evaluate badges** (scheduled nightly + on-demand from key events): issues `user_badges` for any newly matched criteria.
9. **Send enrollment welcome** (event hook on `enrollments.items.create`): queues an email via Directus notifications to the learner with course access info. Email template is configurable.
10. **Announcement fan-out** (event hook on `announcements.items.create` when `pinned = true`): creates `directus_notifications` rows for every enrolled learner.
11. **Cleanup orphaned lesson progress** (scheduled weekly): removes `lesson_progress` rows whose `lesson_id` no longer exists. Edge case cleanup.

## 8. Permissions model

Key rules, all scoped with `$CURRENT_USER`:

- Learners read their own `enrollments`, their own `lesson_progress`, their own `quiz_attempts`, their own `submissions`, their own `certificates`, their own `user_badges`.
- Learners create `enrollments` only for published courses, create `quiz_attempts` only for quizzes attached to lessons in courses they're enrolled in, create `submissions` only for their own enrollments.
- Instructors read/update courses where `instructor = $CURRENT_USER`. Nested permission for grading: they can read/update `submissions` where `assignment.lesson.module.course.instructor = $CURRENT_USER`, same pattern for `quiz_responses`.
- Instructors read enrollments where `course.instructor = $CURRENT_USER` but cannot modify them.
- Public role reads published courses, categories, tags, instructor public profiles, free preview lessons only, and `certificates` only via the verification endpoint (which filters by `verification_code` with no other PII exposed).
- Admins have unrestricted access to LMS collections.

## 9. Frontend

Brand new React 18 + Vite + TypeScript app. Separate GitHub repo, separate Vercel project. Not a monorepo with CRM.

### Stack

- Routing: React Router v6
- Server state: TanStack Query
- Tables: TanStack Table
- Forms: React Hook Form + Zod
- Auth state: Zustand with Directus SDK cookie auth
- UI: shadcn/ui (slate base, to differentiate visually from the CRM which is neutral)
- Rich text rendering: react-markdown + remark-gfm + rehype-raw
- Rich text editing: TipTap
- Video: react-player wrapped in custom controls
- PDF viewing: react-pdf
- PDF generation (certificates): html2canvas + jspdf
- Drag and drop: dnd-kit (curriculum builder, category tree)
- Charts: recharts (instructor and admin analytics)

### Layouts

Four distinct layouts rendered by route group:

- **PublicLayout**: marketing header (logo, catalog, search, log in / sign up), footer. Used on home, catalog, course detail, categories, instructors, verify.
- **LearnerLayout**: app shell with sidebar (My Learning, Completed, Certificates, Badges, Browse). Used on learner dashboards. The course player uses its own fullscreen-optimized layout, not this one.
- **InstructorLayout**: app shell with instructor sidebar (Dashboard, My Courses, Grading, Students, Analytics, Announcements). Used on all instructor pages.
- **AdminLayout**: admin console shell. Used on all admin pages.

### Route map

**Public**
- `/` home (hero, featured courses, categories, top instructors)
- `/courses` catalog with sidebar filters (category tree, level, price, rating, language, tags) and sort
- `/courses/:slug` course detail (sticky enrollment card, curriculum outline with preview lessons, instructor bio, reviews)
- `/categories` category list
- `/categories/:slug` category detail (courses in that category plus descendants)
- `/instructors` instructor list
- `/instructors/:username` instructor profile (bio, courses, reviews)
- `/verify/:code` public certificate verification page
- `/login`, `/signup`, `/forgot-password`

**Learner**
- `/my-learning` active enrollments grid with "Continue learning" on top
- `/my-completed` completed courses
- `/my-certificates` certificates with download and share
- `/my-badges` earned badges plus available badges with progress
- `/my-profile` profile edit
- `/learn/:courseSlug/:lessonId` the course player (three-column: curriculum sidebar, lesson content, resources/transcript/chapters tabs)

**Instructor**
- `/instructor` dashboard (student activity, recent reviews, revenue if paid, pending grading)
- `/instructor/courses` list of my courses
- `/instructor/courses/new` new course wizard
- `/instructor/courses/:id` course editor with tabs: Details, Curriculum, Pricing, Settings, Announcements
- `/instructor/courses/:id/quizzes/:quizId` quiz editor
- `/instructor/courses/:id/assignments/:assignmentId` assignment editor
- `/instructor/courses/:id/students` enrolled students table
- `/instructor/courses/:id/analytics` course analytics (enrollment over time, completion rate, drop-off by lesson, average quiz score)
- `/instructor/grading` grading queue with tabs for assignments and essay quiz responses

**Admin**
- `/admin` dashboard (site-wide metrics)
- `/admin/users` user management
- `/admin/categories` category tree with dnd-kit reorder
- `/admin/tags` tag management
- `/admin/badges` badge management with criteria builder
- `/admin/certificate-templates` certificate templates with live preview
- `/admin/reviews` moderation queue
- `/admin/site-announcements` site-wide announcements

### Shared primitives

- `CourseCard` with three variants (catalog large, row strip, sidebar thumbnail)
- `CurriculumOutline` with three variants (preview read-only, learner progress, instructor editor)
- `ProgressBar`, `LessonIcon`, `StarRating`, `EmptyState`
- `RichText` (markdown renderer)
- `RichTextEditor` (TipTap)
- `VideoPlayer` (see `VIDEO_DESIGN.md`)
- `PdfViewer`
- `QuizRunner` (fullscreen quiz experience)
- `CertificateRenderer` (used for preview and export)
- `Announcement` banner

## 10. Build order

Two passes, matching how the prompt files are organized:

1. **Backend pass 1 (schema)**: collections, fields, relationships, UI interfaces. Prompts L1-L9 in `MCP_PROMPTS.md`.
2. **Backend pass 2 (flows, permissions, seed)**: L10-L13. Seed includes sample users, two fully fleshed-out courses, a category tree, sample reviews, sample badges, sample certificates. Enough to smoke test the frontend without manual data entry.
3. **Frontend pass**: LF1-LF10 in `FRONTEND_PROMPTS.md`. Starts with repo scaffold and auth, builds out public pages, learner dashboards, course player, instructor tools, admin console, Vercel deploy.

I recommend you run backend pass 1, review in Studio, then backend pass 2, then smoke test against the seed data before touching the frontend. That way schema mistakes are caught early and don't propagate into TypeScript types and components.

## 11. Things that make this feel like a real product, not a tutorial

Specific design choices worth calling out:

- Video progress uses unique-seconds-watched, not max scrub. Scrubbing to the end doesn't mark complete.
- Certificates have a public verification URL with a code, so learners can actually prove completion.
- Instructors get real grading tools, not a placeholder. The grading queue is a tab in their app.
- Reviews have an instructor reply thread, not just a rating.
- Site-wide and course-level announcements both exist. Different needs.
- Denormalized counters (`total_students`, `lesson_count`, `progress_percent`) keep dashboards fast. Kept in sync by flows.
- The public role is real. Anyone can browse the catalog and verify a certificate without an account.
- Drafts and archive are first-class. Published courses are a deliberate state transition, validated by a flow.
- Free preview lessons are supported at the data level (`lessons.is_preview`) and the access model.
- The admin certificate template editor renders live so admins don't guess at layout.

## 12. Things explicitly out of scope for this template

Calling out so there's no ambiguity:

- Live cohort-based courses with scheduled sessions. This is self-paced only. Live sessions can be added later with a `sessions` collection.
- Subscriptions and bundles. Pricing is per-course one-time. A bundles collection is a later addition.
- Real payment processing. The `orders` collection is a stub; wiring up Stripe is a separate project.
- Discussion forums. Out of scope. If needed, integrate a third-party like Discourse.
- Mobile native apps. Responsive web only.
- White-labeling for multi-tenant. Single-tenant platform.
- Real-time features (live watch-along, chat). Not in scope.
- AI transcripts, AI quiz generation. Fields exist to store them; generation is not built in.

## 13. Open design choices for you to confirm

Before I update the execution files, I want your calls on these:

1. **Paid courses**: the schema has a `price` field but no Stripe integration. Should I leave the pricing fields as-is (works for free courses, visible placeholder for paid), or strip them out for v1 to keep things simpler?
2. **Free vs paid preview**: currently `is_preview` on a lesson means "anyone can watch this without enrolling." Should that include paid courses too (sample lesson style) or only apply to free courses?
3. **Certificate auto-issue**: issues on enrollment completion. Should it require the learner to also pass all quizzes, or just watch all the lessons? Current design requires all lessons complete, which does not require quiz passing unless the quiz is a lesson (which it often is).
4. **Review gating**: right now anyone enrolled can leave a review at any time. Should we require the course to be at least 50 percent complete before a review can be left? Common on Udemy.
5. **Instructor revenue share**: out of scope per section 12, but flagging: should I include an `instructor_revenue_share_percent` field on courses for later, or strip it?
6. **Badge criteria builder**: should the admin UI expose a full visual criteria builder, or is a JSON textarea with a docs link enough for v1?
7. **Certificate customization depth**: should instructors be able to choose their own template per course, or should the admin pick one global default?
8. **Player library**: `react-player` vs Plyr vs Mux Player. My default is `react-player` for breadth of source support. (Same question from `VIDEO_DESIGN.md`, surfacing here too.)

Answer these and I'll update the three execution files so they match this design exactly. If you want to just accept my defaults (everything as written above, `react-player`, keep price fields, require 50 percent for reviews, let instructors pick templates, JSON criteria builder for v1), say "go with defaults" and I'll align the files.
