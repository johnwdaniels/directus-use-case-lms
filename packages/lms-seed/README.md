# LMS Seed Script

Generates realistic seed data for the Directus LMS data model.

## Prerequisites

- Node.js 18+
- A running Directus instance with the LMS schema applied
- All 19 LMS Flows created (the script pauses/resumes flows automatically)

## Setup

```bash
cd packages/lms-seed
npm install
```

## Usage

```bash
export DIRECTUS_URL="https://your-directus-instance.railway.app"
export DIRECTUS_ADMIN_TOKEN="your_admin_token_here"

npm run seed
```

Dry-run mode (read-only, no writes):

```bash
DRY_RUN=true npm run seed
```

## What gets created

| Entity | Target count |
|---|---|
| Categories | 10 root + 30 subcategories = 40 |
| Course tags | 30 |
| Users | 2 LMS Admins + 6 Instructors + 12 Learners = 20 |
| Certificate templates | 3 (1 set as default) |
| Badges | 10 |
| Courses | 40 (70% Published, 20% Draft, 10% Archived) |
| Modules | ~240 (4–8 per course) |
| Lessons | ~900 (3–6 per module) |
| Quizzes | 15 (with 5–15 questions each) |
| Assignments | 10 |
| Enrollments | ~200 |
| Lesson progress | ~1,000+ |
| Quiz attempts | 50 |
| Submissions | 30 |
| User badges | ~40 |
| Reviews | ~100 |
| Announcements | 15 (5 site-wide, 10 course-specific) |

## Idempotency / Deduplification

The script is safe to run multiple times. It deduplicates by:

| Collection | Dedup key |
|---|---|
| `categories` | `slug` |
| `course_tags` | `name` |
| `courses` | `slug` |
| `badges` | `name` |
| `certificate_templates` | `name` |
| `directus_users` | `email` |

Records that already exist are counted as **skipped** and their IDs are reused for relations.

> **Note:** `modules`, `lessons`, `quizzes`, `assignments`, `enrollments`, and downstream records (lesson_progress, quiz_attempts, submissions, reviews, announcements) are **not** deduped — re-running will create duplicates for these. Use a fresh Directus instance or manually clear these collections before re-seeding.

## Flow management

The script temporarily **suspends** four flows that would slow seeding or interfere:

- `[LMS] Normalize Video Source` — makes external oEmbed HTTP calls per lesson
- `[LMS] Recompute Enrollment Progress` — fires once per lesson_progress record
- `[LMS] Review Gating` — may block some seed reviews
- `[LMS] Default Enrollment Fields` — defaults are set directly in the script

It then **re-enables** the `[LMS] Issue Certificate on Completion` flow before patching enrollments to `completed`, so certificates are issued via the production code path (with real `certificate_number` and `verification_code` generation).

All flows are re-enabled at the end of the run.

## Generated passwords

Passwords for seeded users are logged **once** to stdout at the end of the run. They are not stored anywhere in the code. Copy them before the terminal session closes.

## Faker seed

The script uses `faker.seed(1337)` for reproducible data. Change the seed constant in `index.ts` to generate a different dataset.

## Course distribution

- **70%** Published · **20%** Draft · **10%** Archived
- **30%** Free · **70%** Paid ($29–$199)
- Lesson types: 50% video · 25% text · 15% PDF · ~5% quiz · ~5% assignment
- Video lessons use rotating YouTube placeholder IDs with realistic duration values
- 20% of video lessons include a transcript, 10% include chapter markers
- Preview lessons (`is_preview = true`) are set only on **free** courses (max 2 per course)

## Instructor → category mapping

| Instructor | Primary categories |
|---|---|
| Sarah Chen | Web Development |
| Marcus Thompson | Data Science |
| Emma Rodriguez | Design |
| James Wilson | Business, Health & Fitness |
| Olivia Park | Marketing, Personal Development, Language |
| Alex Kim | Photography, Music |
