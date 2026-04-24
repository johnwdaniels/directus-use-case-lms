# LMS Template Plan

Backend: Directus on Railway (same instance as the CRM, new collections added alongside). Frontend: React on Vercel (brand new repo, brand new Vercel project, no relationship to the CRM frontend). Goal: a working mock of a modern learning platform that covers the course-catalog + self-paced learner + instructor-authoring loop end to end.

## 1. Scope for v1

Research across modern LMS platforms (Docebo, TalentLMS, Cypher, 360Learning, Thinkific) converges on a core set of capabilities. The v1 template covers:

- Course catalog with search, filters, categories, difficulty levels, and instructor profiles
- Course structure (course → module → lesson) with mixed lesson types: video, text, PDF, quiz, assignment, external link
- Self-paced enrollment and progress tracking per lesson and per course
- Quizzes with multiple question types (single choice, multiple choice, true/false, short answer, essay)
- Assignments with file upload, URL, or text submission, plus instructor grading
- Certificates issued on course completion
- Badges awarded on milestones
- Course reviews and ratings
- Announcements per course
- Instructor dashboard (my courses, students, grading queue, analytics)
- Learner dashboard (in progress, completed, recommended, certificates, badges)
- Admin console (users, categories, site-wide settings)

Out of scope for v1 (flag as v2): SCORM and xAPI, live sessions with embedded video, discussions and forums, cohort-based courses, learning paths (course sequences), gamification beyond badges (points, leaderboards), payment processing, multi-language content, offline/mobile downloads.

## 2. Schema

### 2.1 Shared user model

`directus_users` is shared with the CRM. Add these LMS-specific fields (do not modify the CRM fields already there):

- bio (text, rich text)
- headline (string, short tagline for instructor cards)
- expertise (M2M to categories, so an instructor can be tied to the subjects they teach)
- social_twitter, social_linkedin, social_youtube, social_website (strings)
- total_students (integer, denormalized, updated by a flow)
- total_courses (integer, denormalized)
- average_rating (decimal, denormalized across their courses)

### 2.2 Taxonomy

**categories** (hierarchical, used for course browsing)
- id (uuid pk)
- name (string, required)
- slug (string, unique)
- parent (M2O categories, nullable, for a tree)
- description (text)
- icon (string, lucide icon name or file)
- cover_image (file-image, for category landing pages)
- sort_order (int)
- course_count (int, denormalized)

**course_tags** (flat tags for free-form labeling, independent of the CRM `tags` collection)
- id
- name (unique, lowercase)
- slug

Junction: **courses_tags** linking courses to course_tags.

Junction: **lessons_captions_files** linking lessons to VTT files for video captions (fields: lesson, file, language_code, label, is_default).

Junction: **lessons_resources** linking lessons to downloadable files (fields: lesson, file, title, description).

Junction: **submissions_files** linking submissions to uploaded files.

Junction: **quiz_responses_options** linking a quiz response to selected question_options for choice questions.

### 2.3 Course structure

**courses**
- id (uuid pk)
- title (string, required)
- slug (string, unique, auto-generated from title)
- subtitle (string) for the short tagline
- description (text, rich text)
- learning_objectives (JSON array of strings, or a separate `course_objectives` collection)
- prerequisites (M2M courses, a course can require other courses)
- category (M2O categories, required)
- tags (M2M via courses_tags)
- cover_image (file-image)
- trailer_video_url (string, supports YouTube/Vimeo/Mux embed)
- difficulty (enum: Beginner, Intermediate, Advanced, All Levels)
- language (enum: English, Spanish, French, German, Portuguese, Japanese, Mandarin, Other)
- duration_minutes (int, computed from sum of lesson durations)
- price (decimal)
- currency (enum, default USD)
- is_free (bool, computed or manual)
- status (Draft, Published, Archived)
- visibility (Public, Unlisted, Private)
- instructor (M2O directus_users, required)
- co_instructors (M2M directus_users via courses_co_instructors)
- enrollment_limit (int, nullable means unlimited)
- enrollment_deadline (datetime, nullable)
- self_paced (bool, default true)
- passing_score (int 0-100, default 70)
- default_completion_threshold (int 50-100, default 90, percent of video watched to count lesson complete)
- default_video_player_theme (enum: light, dark, default light)
- published_at (datetime)
- average_rating (decimal, 0-5, denormalized)
- rating_count (int, denormalized)
- enrollment_count (int, denormalized)
- completion_count (int, denormalized)

**modules** (course sections)
- id (uuid pk)
- course (M2O courses, on delete CASCADE)
- title (string, required)
- description (text)
- sort_order (int)

**lessons**
- id (uuid pk)
- module (M2O modules, on delete CASCADE)
- title (string, required)
- lesson_type (enum: video, text, pdf, quiz, assignment, external_link)
- sort_order (int)
- duration_minutes (int)
- is_preview (bool, default false; learners can watch without enrolling)
- required (bool, default true; if false, does not count toward completion)
- completion_criteria (enum: view, time_threshold, quiz_passed, submission_accepted, manual)

Content fields for each lesson, shown conditionally based on lesson_type. Full video spec lives in `VIDEO_DESIGN.md`; listing the fields here so the schema is self-contained:

Video fields (shown when lesson_type = video):
- video_source (enum: youtube, vimeo, directus_file, external_url, default youtube, required)
- video_youtube_id (string, just the 11-char ID; normalized on save from pasted URLs)
- video_vimeo_id (string)
- video_file (M2O directus_files, for uploaded mp4/webm)
- video_url (string, for external mp4 or HLS manifest)
- video_duration_seconds (int, auto-filled from oEmbed when possible)
- video_thumbnail (M2O directus_files, optional override)
- video_captions (M2M directus_files via lessons_captions_files junction; each row carries language_code, label, is_default)
- video_transcript (text, rich text markdown)
- video_chapters (JSON, array of `{start: seconds, title: string}`)
- allow_download (bool, only applies to directus_file and external_url sources)
- resume_from_last_position (bool, default true)
- completion_threshold (int 50-100, nullable; when null, course.default_completion_threshold applies)

Other content fields:
- text_body (text, rich text, for text lessons)
- pdf_file (M2O directus_files)
- quiz (M2O quizzes, for quiz lessons)
- assignment (M2O assignments, for assignment lessons)
- external_url (string, for external_link lessons)
- resources (M2M directus_files via lessons_resources, downloadable extras)

### 2.4 Enrollment and progress

**enrollments**
- id (uuid pk)
- user (M2O directus_users, required)
- course (M2O courses, required)
- status (enum: active, completed, dropped, suspended)
- enrolled_at (datetime, default now)
- started_at (datetime, set on first lesson interaction)
- completed_at (datetime, set when all required lessons complete)
- progress_pct (decimal, 0-100, computed or maintained by flow)
- last_lesson (M2O lessons, the resume point)
- final_grade (decimal, 0-100, computed from graded components)
- certificate_issued (bool, default false)
- Unique constraint on (user, course)

**lesson_progress** (per-user per-lesson)
- id (uuid pk)
- user (M2O directus_users)
- lesson (M2O lessons)
- enrollment (M2O enrollments, for cascade and reporting)
- status (enum: not_started, in_progress, completed)
- completed_at (datetime)
- last_position_seconds (int, video resume point)
- watched_seconds (int, cumulative unique seconds watched so scrubbing to the end does not mark complete)
- last_watched_at (datetime)
- time_spent_seconds (int)
- Unique constraint on (user, lesson)

### 2.5 Assessments

**quizzes**
- id (uuid pk)
- course (M2O courses, nullable for standalone quizzes)
- title (string, required)
- description (text)
- time_limit_minutes (int, nullable means untimed)
- max_attempts (int, nullable means unlimited)
- passing_score (int 0-100, default 70)
- shuffle_questions (bool, default false)
- shuffle_options (bool, default false)
- show_correct_answers (enum: never, after_each_attempt, after_passing, after_all_attempts)
- show_results_immediately (bool, default true)

**questions**
- id (uuid pk)
- quiz (M2O quizzes, on delete CASCADE)
- question_type (enum: single_choice, multiple_choice, true_false, short_answer, essay, matching, ordering)
- prompt (text, rich text, required)
- points (decimal, default 1)
- sort_order (int)
- explanation (text, shown to learner after answering)
- required (bool, default true)

**question_options** (for choice-type questions)
- id (uuid pk)
- question (M2O questions, on delete CASCADE)
- label (string, required)
- is_correct (bool, default false)
- sort_order (int)
- feedback (text, shown if this option is selected)

**quiz_attempts**
- id (uuid pk)
- user (M2O directus_users, required)
- quiz (M2O quizzes, required)
- enrollment (M2O enrollments, nullable)
- attempt_number (int)
- started_at (datetime)
- submitted_at (datetime, nullable while in progress)
- score (decimal, percentage)
- points_earned (decimal)
- points_possible (decimal)
- passed (bool, nullable while ungraded)
- time_spent_seconds (int)
- status (enum: in_progress, submitted, graded)

**quiz_responses** (per-question answers in an attempt)
- id (uuid pk)
- attempt (M2O quiz_attempts, on delete CASCADE)
- question (M2O questions)
- selected_options (M2M question_options via quiz_responses_options, for choice questions)
- text_answer (text, for short_answer and essay)
- is_correct (bool, nullable for ungraded essays)
- points_earned (decimal)
- graded_by (M2O directus_users, for manually graded essays)
- grader_feedback (text)

### 2.6 Assignments

**assignments**
- id (uuid pk)
- course (M2O courses, required)
- title (string, required)
- description (text, rich text)
- instructions (text, rich text)
- due_date (datetime, nullable)
- max_points (decimal, default 100)
- passing_score (decimal)
- allow_late_submissions (bool, default true)
- late_penalty_pct (decimal, default 0)
- submission_types (JSON array or multi-select: file_upload, text_entry, url)
- rubric (text, rich text, shown to learners)

**submissions**
- id (uuid pk)
- assignment (M2O assignments, required)
- user (M2O directus_users, required)
- enrollment (M2O enrollments, nullable)
- status (enum: draft, submitted, graded, returned_for_revision)
- submitted_at (datetime, nullable while draft)
- text_response (text, rich text, nullable)
- url_response (string, nullable)
- files (M2M directus_files via submissions_files)
- grade (decimal, nullable until graded)
- grader_feedback (text, rich text)
- graded_by (M2O directus_users, nullable)
- graded_at (datetime, nullable)
- is_late (bool, computed against due_date)
- attempt_number (int)

### 2.7 Credentials

**certificate_templates** (admin-managed; exactly one is marked as the global default and used for every issued certificate)
- id (uuid pk)
- name (string, required)
- html_template (text, rich text, with merge fields like {{learner_name}}, {{course_title}}, {{completion_date}}, {{verification_code}})
- background_image (file-image)
- accent_color (color)
- is_default (bool, default false; a flow enforces only one row can be true at a time)
- issuer_name (string)
- issuer_title (string)
- signature_image (M2O directus_files, nullable)

**certificates** (issued certificates)
- id (uuid pk)
- user (M2O directus_users, required)
- course (M2O courses, required)
- enrollment (M2O enrollments, required)
- template (M2O certificate_templates)
- issued_at (datetime)
- certificate_number (string, unique, auto-generated like CERT-2026-00001)
- verification_code (string, unique, short random token for public verification URL)
- final_grade (decimal)
- pdf_file (file, nullable, generated on first view)
- Unique constraint on (user, course)

**badges**
- id (uuid pk)
- name (string, required)
- description (text)
- icon (file-image, square, transparent background preferred)
- color (color)
- criteria_type (enum: course_completion, courses_count, quiz_perfect_score, streak, manual)
- criteria_value (JSON, shape depends on criteria_type: for courses_count it is {count: N}, for course_completion it is {course_id: "..."}, etc.)

**user_badges**
- id (uuid pk)
- user (M2O directus_users)
- badge (M2O badges)
- awarded_at (datetime)
- awarded_context (string, human-readable context like "for completing Advanced React")
- Unique constraint on (user, badge)

### 2.8 Social

**reviews**
- id (uuid pk)
- course (M2O courses)
- user (M2O directus_users)
- enrollment (M2O enrollments)
- rating (int 1-5, required)
- title (string)
- body (text)
- is_approved (bool, default true, for moderation)
- helpful_count (int, default 0)
- instructor_reply (text, nullable)
- instructor_reply_at (datetime, nullable)
- Unique constraint on (user, course)

**announcements**
- id (uuid pk)
- course (M2O courses, nullable for site-wide announcements)
- title (string, required)
- body (text, rich text)
- is_pinned (bool, default false)
- published_at (datetime)
- author (M2O directus_users)

## 3. Directus configuration beyond schema

### 3.1 Roles

Four new roles, alongside the CRM roles (do not modify CRM roles):

- **LMS Admin**: full access to all LMS collections, manages users, categories, site-wide settings.
- **Instructor**: full access to own courses (where instructor = current user), full access to own courses' enrollments/submissions/reviews, read access to categories and own profile, can grade assignments and essay responses for their courses.
- **Learner**: read access to Published courses, manages own enrollments/progress/attempts/submissions/reviews, cannot see other learners' data.
- **Guest Browser**: read access to Published courses' public metadata (title, description, trailer, price, rating), no access to lesson content, no enrollments.

Most site visitors will be Guest Browser until they register as a Learner. Public role (unauthenticated) gets the Guest Browser permissions so the catalog works without login.

### 3.2 Flows

- **Course publish validation** (filter hook on courses.update when status goes to Published): set `published_at = now()` if null. Reject if the course has zero modules, zero lessons, or missing cover image.
- **Free preview validation** (filter hook on lessons.create/update): reject if `is_preview = true` but the parent course has `price > 0`. Only free courses can have preview lessons.
- **Enrollment default on create** (event hook): set `enrolled_at = now()`, default `status = active`, `progress_pct = 0`.
- **Normalize video source on lesson save** (filter hook on lessons.create/update): extract clean IDs from pasted YouTube and Vimeo URLs, validate external URLs, auto-fill `video_duration_seconds` from oEmbed where possible, reject saves where the video_source field does not match its paired ID/file/URL.
- **Recompute enrollment progress** (event hook on lesson_progress.create/update): recompute parent enrollment's `progress_pct = completed_required_lessons / total_required_lessons * 100`. If 100, set enrollment.status = completed, completed_at = now(), final_grade = weighted avg of graded components, fire the Issue certificate and Check badges flows.
- **Auto-grade quiz on submit** (event hook on quiz_attempts.update when submitted_at goes from null to set): grade auto-scoreable questions (choice + true/false), compute score, set passed = score >= quiz.passing_score, update any lesson_progress that this attempt satisfies.
- **Submission submit hook** (event hook on submissions.update when status goes to submitted): set submitted_at, compute is_late against the assignment due_date.
- **Submission graded hook** (event hook on submissions.update when grade is set): update enrollment.final_grade, update lesson_progress if this submission satisfies the linked lesson's completion criteria.
- **Issue certificate on enrollment completion** (event hook on enrollments.update when completed_at is set): look up the `certificate_templates` row flagged `is_default = true`, generate a URL-safe 12-char `verification_code`, render the merged HTML and save as a PDF into directus_files, create the `certificates` row linking user, course, enrollment, template, pdf_file, verification_code.
- **Default certificate template uniqueness** (filter hook on certificate_templates.create/update): if `is_default = true`, set `is_default = false` on every other row to enforce exactly one default.
- **Evaluate badges** (scheduled nightly plus on-demand from enrollment completion and quiz pass): for each active badge, evaluate `criteria_type` against the user's records and insert `user_badges` rows for newly earned badges. Idempotent.
- **Review gating** (filter hook on reviews.create): reject if the reviewer's enrollment in that course has `progress_pct < 50`. Learners must be at least half through a course to leave a review.
- **Denormalize course counters** (nightly + on-demand on review create/delete): recompute `enrollment_count`, `completion_count`, `average_rating`, `rating_count` for each course.
- **Denormalize instructor counters** (nightly): recompute `total_students`, `total_courses`, `average_rating` for users flagged `is_instructor = true`.
- **Welcome on enrollment** (event hook on enrollments.create): queue a notification to the learner via directus_notifications.
- **Announcement fan-out** (event hook on announcements.create when `is_pinned = true`): create directus_notifications rows for each learner enrolled in the course.
- **Cleanup orphaned progress** (scheduled weekly): remove lesson_progress rows whose lesson no longer exists.

### 3.3 File storage

Same S3/Railway storage as the CRM. Course videos, PDFs, submissions, certificates, and badge icons all go here. The `directus_files` folder structure should use folders: `lms/course-covers`, `lms/lesson-videos`, `lms/pdfs`, `lms/submissions`, `lms/certificates`, `lms/badges`.

### 3.4 Public API access

The public course catalog needs to be readable without login. Configure the Public role with read access to:
- courses (only status = Published, only fields safe to expose publicly: no admin_notes, etc.)
- modules and lessons (only is_preview = true for lessons; everything for modules)
- categories (all)
- course_tags (all)
- reviews (is_approved = true)
- directus_users (restricted fields for instructor display: first_name, last_name, avatar, bio, headline, expertise)

## 4. Hosting plan

### 4.1 Railway (Directus, reused)

Same instance as the CRM. No new Railway services needed. The new collections live alongside CRM collections in the same Postgres database. Update the Railway env vars:
- CORS_ORIGIN should be updated to include the new LMS Vercel domain plus the existing CRM domain

If the LMS volume outgrows the shared Postgres plan (courses with video files can get heavy), split storage then: move LMS file uploads to a dedicated S3 bucket.

### 4.2 Vercel (React, brand new)

New Vercel project, linked to a new GitHub repo. No shared code with the CRM frontend. Env vars:
- VITE_DIRECTUS_URL (same Railway URL as CRM)
- VITE_PUBLIC_APP_URL

Custom domain: learn.yourdomain.com or similar.

## 5. Frontend shape

Stack matches the CRM for consistency across templates: Vite, React, TypeScript, TanStack Query, React Router, Tailwind, shadcn/ui, @directus/sdk, Zustand for auth, React Hook Form, Zod, TanStack Table, dnd-kit.

Add: a video player built on `react-player` (handles YouTube, Vimeo, HLS, direct mp4 from Directus files, and external URLs through one API) wrapped in a custom controls shell so every source feels identical. Full spec in `VIDEO_DESIGN.md`. A rich text renderer (react-markdown with GFM + rehype-raw). A PDF viewer (react-pdf). A WYSIWYG editor for rich text fields (TipTap). Certificate PDF generation in the browser with html2canvas + jspdf.

### 5.1 Public pages (no login required)

- `/` home (featured courses, categories, testimonials, CTA)
- `/courses` catalog with search, filters (category, difficulty, language, price: free vs paid, duration), sort
- `/courses/:slug` course detail (title, instructor, description, curriculum outline, reviews, enroll button)
- `/categories/:slug` category landing
- `/instructors/:id` instructor profile with their courses and bio
- `/verify/:code` public certificate verification
- `/login` and `/signup`

### 5.2 Learner pages (authenticated)

- `/my/learning` in-progress courses, resume buttons, progress bars
- `/my/completed` completed courses with certificate download links
- `/my/certificates` all earned certificates
- `/my/badges` earned badges
- `/my/profile` edit own profile
- `/learn/:courseSlug` course player layout (left sidebar = curriculum, center = current lesson, bottom = progress and next/prev)
- `/learn/:courseSlug/:lessonId` specific lesson inside the player
- `/quiz/:attemptId` quiz-taking interface (distinct from the player, fullscreen focused UI)
- `/assignment/:assignmentId` assignment submission page

### 5.3 Instructor pages (role: Instructor)

- `/instructor/dashboard` overview (students across courses, recent enrollments, pending grading count, revenue placeholder)
- `/instructor/courses` list of own courses, create new
- `/instructor/courses/:id/edit` course authoring: tabs for Details, Curriculum (modules and lessons), Pricing, Settings, Announcements
- `/instructor/courses/:id/students` enrolled learners with progress
- `/instructor/courses/:id/grading` queue of pending assignment submissions and essay responses
- `/instructor/courses/:id/analytics` course analytics

### 5.4 Admin pages (role: LMS Admin)

- `/admin` dashboard (platform stats)
- `/admin/users` user management
- `/admin/categories` category tree management
- `/admin/badges` badge management
- `/admin/certificate-templates` certificate template designer
- `/admin/reviews` moderation queue
- `/admin/announcements` site-wide announcements

### 5.5 Key reusable UI pieces

- CourseCard (used in catalog, category, instructor pages, search results)
- CurriculumOutline (shows modules with nested lessons, expandable, shows lock/completion state per lesson)
- LessonPlayer (renders the right component based on lesson_type: video, text, PDF, quiz launcher, assignment launcher, iframe for external)
- VideoPlayer wrapper with progress reporting back to Directus every N seconds
- QuizRunner (one-question-at-a-time with progress bar, or all-on-one-page, configurable)
- AssignmentSubmissionForm
- ProgressBar (used across enrollment cards, course detail, player)
- CertificateViewer (renders the template with merge fields, prints nicely)
- ReviewCard and ReviewForm
- CoursePriceDisplay (handles free vs paid)

## 6. Seed data

The seed script (same shape as the CRM seed) should create:
- 10 categories across common topics: Web Development, Data Science, Design, Business, Marketing, Photography, Music, Health & Fitness, Personal Development, Language
- 30 course_tags
- 20 users across roles: 2 Admins, 6 Instructors, 12 Learners. Use @example.com emails. Instructors get bios and expertise categories.
- 40 courses distributed across categories, difficulties, and instructors. About 70% Published, 20% Draft, 10% Archived. Mix of free (30%) and paid.
- Each course: 4 to 8 modules, 3 to 6 lessons per module. Mix of lesson types: ~50% video, ~25% text, ~10% PDF, ~10% quiz, ~5% assignment.
- ~15 quizzes with 5 to 15 questions each, varied types.
- ~10 assignments with realistic prompts.
- ~200 enrollments spread across learners and courses, with varied progress (some at 0%, some in progress, some completed).
- Lesson progress records consistent with enrollment progress.
- ~50 quiz attempts with realistic scores.
- ~30 assignment submissions, mix of ungraded and graded.
- ~20 certificates issued.
- 10 badges with varied criteria.
- ~40 user_badges awarded.
- ~100 reviews with ratings skewed toward 4-5 stars but with some lower.
- ~15 announcements across courses.

Seed should be idempotent using slug (courses, categories), email (users), or external_id for records without a natural key.

## 7. Build order

1. Add LMS-specific fields to directus_users.
2. Create taxonomy collections (categories, course_tags, courses_tags).
3. Create course structure (courses, modules, lessons, junctions for prerequisites, tags, co_instructors, resources).
4. Create enrollment and progress (enrollments, lesson_progress).
5. Create assessments (quizzes, questions, question_options, quiz_attempts, quiz_responses, junction for selected_options).
6. Create assignments (assignments, submissions, junction for files).
7. Create credentials (certificate_templates, certificates, badges, user_badges).
8. Create social (reviews, announcements).
9. Configure roles (LMS Admin, Instructor, Learner, Guest Browser on Public).
10. Configure permissions (section 3.1).
11. Configure flows (section 3.2).
12. Seed data.
13. Scaffold the frontend repo, auth, app shell.
14. Build public pages (catalog, detail, category, instructor).
15. Build learner pages (my learning, course player, quiz runner, assignment form).
16. Build instructor pages (course authoring, students, grading).
17. Build admin pages.
18. Deploy to Vercel.

## 8. Resolved design decisions

These were the open questions from the design review. Settled as of this revision:

- **Pricing**: keep `price`, `currency`, `is_free` fields on courses as-is. Paid courses render with a placeholder price display. Real payment wiring (Stripe) is v2.
- **Free preview lessons**: only free courses can mark lessons as `is_preview`. Enforced by a filter hook Flow on `lessons.create/update` that rejects if the parent course has `price > 0`.
- **Certificate issuance**: auto-issue on enrollment completion. Completion means all required lessons are marked complete. Quiz-pass requirement flows naturally if the quiz is a required lesson.
- **Review gating**: reviews require at least 50 percent course progress. Enforced by a filter hook Flow on `reviews.create` that checks the reviewer's enrollment `progress_pct`.
- **Instructor revenue share**: not in v1. No field added.
- **Badge criteria authoring**: admin UI uses a JSON textarea with a docs link, not a visual builder. Keeps v1 shippable.
- **Certificate templates**: one global default, admin-managed. No per-course template selection. `certificate_templates.is_default` is the flag; a filter hook Flow enforces exactly one default row.
- **Video player**: `react-player` wrapped in a custom controls shell. Single component handles YouTube, Vimeo, Directus file, and external URL sources. See `VIDEO_DESIGN.md` for full spec.
- **Video hosting**: lesson supports all four sources through `video_source` enum (see section 2.3).
- **Quiz grading for essays**: attempts stay `submitted` until an instructor grades the essay responses, then flip to `graded`. The grading queue is a real instructor tool.
- **Public catalog without login**: yes. Public role permissions in section 3.4 expose published courses, instructor public profiles, free preview lessons, and certificate verification.
- **Learner certificates rendering**: client-side rendering via `CertificateRenderer`, exportable to PDF with html2canvas + jspdf. Server-side PDF generation via a Flow is available on enrollment completion for emailing the learner.
- **Video progress tracking granularity**: write to Directus every 15 seconds, on pause, on seek, on tab hide, and on route change. Completion threshold default is 90 percent of unique seconds watched.
- **Course prerequisites enforcement**: warn only. Incomplete prerequisites are surfaced on the course detail page, but enrollment is not blocked.

Once these are baked into `MCP_PROMPTS.md` and `FRONTEND_PROMPTS.md`, the template is ready to run through Cursor.
