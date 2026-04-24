# Directus MCP Prompts: LMS Backend

These prompts assume the same Directus instance that already hosts the CRM. **Do not modify any existing CRM collections, roles, or flows.** Every LMS collection is new. The only shared table is `directus_users`, and we will add new fields to it without touching the CRM fields.

Run these in Cursor sessions with the Directus MCP connected. Each prompt ends with a verification step; perform it in Directus Studio before moving on.

Interface and display names are canonical Directus strings. Use these verbatim: `input`, `input-multiline`, `input-rich-text-md`, `input-rich-text-html`, `input-code`, `boolean`, `datetime`, `select-dropdown`, `select-dropdown-m2o`, `select-multiple-dropdown`, `select-color`, `tags`, `list-o2m`, `list-m2m`, `list-m2a`, `file`, `file-image`, `slug`, `group-detail`. Displays: `formatted-value`, `labels`, `boolean`, `datetime`, `color`, `image`, `file`, `related-values`, `rating`.

---

# PART 1: Schema

## Prompt L1: Extend directus_users with LMS fields

```
Using the Directus MCP, add the following fields to the existing `directus_users` collection. Do not modify or remove any existing fields. The CRM has already added title, department, phone, territory, quota_amount; leave those alone.

Add:
1. bio (text). Interface: input-rich-text-md. Display: formatted-value. Note: "Short biography for instructor profile".
2. headline (string). Interface: input. Display: formatted-value. Note: "Short tagline, shown on instructor cards".
3. social_twitter (string). Interface: input with placeholder "https://twitter.com/...".
4. social_linkedin (string). Interface: input.
5. social_youtube (string). Interface: input.
6. social_website (string). Interface: input.
7. total_students (integer, default 0). Interface: input (readonly on form). Display: formatted-value.
8. total_courses (integer, default 0). Interface: input (readonly on form).
9. average_rating (decimal, precision 3, scale 2, default 0). Interface: input (readonly). Display: rating with max=5, color=amber.

Group these new fields into a "LMS Profile" group-detail divider after the existing CRM group. Do not reorder existing fields.

After creating, list the directus_users schema and confirm the nine new fields are present alongside the existing CRM fields.
```

**Verify:** Open any user in Studio. Confirm the CRM fields (title, department, phone, territory, quota_amount) are still present and unchanged. The new LMS Profile section appears below.

---

## Prompt L2: Taxonomy collections (categories, course_tags)

```
Create two taxonomy collections. Neither should conflict with the existing CRM `tags` collection.

COLLECTION: categories
- Icon: category
- display_template: {{name}}
- sort_field: sort_order

Fields:
1. id (uuid pk hidden)
2. name (string, required). Interface: input.
3. slug (string, unique, required). Interface: slug with source field "name".
4. parent (M2O categories, nullable). Interface: select-dropdown-m2o with tree mode if available, else standard. Display template: {{name}}. On delete: SET NULL.
5. description (text). Interface: input-multiline.
6. icon (string). Interface: input with placeholder "lucide icon name like GraduationCap".
7. cover_image (file). Interface: file-image. Display: image.
8. sort_order (integer, default 0). Interface: input.
9. course_count (integer, default 0, readonly on form). Interface: input.
10. Standard timestamps.

Also add a self-referencing O2M field `children` on categories that is the reverse of `parent`. Interface: list-o2m. Display template: {{name}}.

COLLECTION: course_tags
- Icon: label
- display_template: {{name}}
- sort_field: name

Fields:
1. id (uuid pk hidden)
2. name (string, required, unique). Interface: input.
3. slug (string, unique). Interface: slug with source "name".
4. Standard timestamps.

Confirm both collections are created, the categories tree relationship works, and the course_tags display as a flat list.
```

**Verify:** Create one parent category ("Web Development") and one child category ("React"). Confirm the children appear under the parent in the Studio tree. Create two course_tags ("react", "typescript").

---

## Prompt L3: Courses collection

```
Create the `courses` collection. This is the largest collection in the LMS. Be explicit about every interface and display. Pay special attention to: the instructor M2O must render as {{first_name}} {{last_name}}, cover_image must use file-image, category must use select-dropdown-m2o rendering {{name}}.

Collection settings:
- Name: courses
- Icon: school
- display_template: {{title}}
- archive_field: status
- archive_value: Archived
- unarchive_value: Draft
- sort_field: -published_at

Fields:
1. id (uuid pk hidden)
2. title (string, required). Interface: input.
3. slug (string, unique, required). Interface: slug with source "title".
4. subtitle (string). Interface: input. Note: "Short tagline".
5. description (text). Interface: input-rich-text-md.
6. learning_objectives (json). Interface: input-code with language json OR a list-of-strings repeater if supported. Note: "Array of learning objective strings".
7. prerequisites (M2M to courses via `courses_prerequisites` junction). Interface: list-m2m. Display template: {{title}}.
8. category (M2O categories, required). Interface: select-dropdown-m2o. Display template: {{name}}.
9. tags (M2M via `courses_tags` junction to course_tags). Interface: list-m2m with tag chip style if available. Display template: {{name}}.
10. cover_image (file). Interface: file-image. Display: image.
11. trailer_video_url (string). Interface: input with placeholder "https://youtube.com/...".
12. difficulty (string). Interface: select-dropdown. Choices: Beginner, Intermediate, Advanced, All Levels. Display: labels.
13. language (string). Interface: select-dropdown. Choices: English, Spanish, French, German, Portuguese, Japanese, Mandarin, Other. Default: English.
14. duration_minutes (integer). Interface: input. Note: "Auto-computed from lessons. Can be overridden.".
15. price (decimal, precision 10, scale 2, default 0). Interface: input. Display: formatted-value with prefix "$".
16. currency (string). Interface: select-dropdown. Choices: USD, EUR, GBP, CAD, AUD, JPY. Default: USD.
17. is_free (boolean, default true). Interface: boolean.
18. status (string). Interface: select-dropdown. Choices: Draft, Published, Archived. Default: Draft. Display: labels with Draft=gray, Published=green, Archived=red.
19. visibility (string). Interface: select-dropdown. Choices: Public, Unlisted, Private. Default: Public.
20. instructor (M2O directus_users, required). Interface: select-dropdown-m2o. Display template: {{first_name}} {{last_name}}.
21. co_instructors (M2M directus_users via `courses_co_instructors` junction). Interface: list-m2m. Display template: {{first_name}} {{last_name}}.
22. enrollment_limit (integer, nullable). Interface: input. Note: "Leave blank for unlimited.".
23. enrollment_deadline (datetime, nullable). Interface: datetime.
24. self_paced (boolean, default true). Interface: boolean.
25. passing_score (integer, min 0, max 100, default 70). Interface: input.
26. default_completion_threshold (integer, min 50, max 100, default 90). Interface: input. Note: "Percent of a video lesson that must be watched for it to count complete. Can be overridden per lesson.".
27. default_video_player_theme (string). Interface: select-dropdown. Choices: light, dark. Default: light.
28. published_at (datetime, nullable). Interface: datetime.
29. average_rating (decimal, precision 3, scale 2, default 0, readonly on form). Interface: input. Display: rating.
30. rating_count (integer, default 0, readonly).
31. enrollment_count (integer, default 0, readonly).
32. completion_count (integer, default 0, readonly).
33. Standard timestamps.

Do NOT add a certificate_template M2O on courses. Certificate templates are global and the flow picks the row flagged is_default at issue time.

Form layout using group-detail dividers:
- Group "Basics": title, slug, subtitle, description, learning_objectives
- Group "Catalog": category, tags, cover_image, trailer_video_url, difficulty, language, duration_minutes
- Group "Pricing": price, currency, is_free
- Group "Publishing": status, visibility, published_at
- Group "Instruction": instructor, co_instructors, enrollment_limit, enrollment_deadline, self_paced, passing_score, prerequisites
- Group "Video defaults": default_completion_threshold, default_video_player_theme
- Group "Stats": average_rating, rating_count, enrollment_count, completion_count

Confirm the M2M junctions `courses_prerequisites`, `courses_tags`, `courses_co_instructors` were created. Confirm the display_template renders as just the title.
```

**Verify:** Create a test course. Set instructor. Add one prerequisite (to itself, just to test the M2M). Add two tags and two co-instructors. Confirm all render with names, not UUIDs.

---

## Prompt L4: Modules and lessons

```
Create the `modules` and `lessons` collections. Lessons are the most complex collection in the project because they hold content for six different lesson types; use conditional field visibility where supported.

COLLECTION: modules
- Icon: folder
- display_template: {{course.title}} / {{title}}
- sort_field: sort_order

Fields:
1. id (uuid pk hidden)
2. course (M2O courses, required, on delete CASCADE). Interface: select-dropdown-m2o. Display template: {{title}}.
3. title (string, required). Interface: input.
4. description (text). Interface: input-multiline.
5. sort_order (integer, default 0).
6. Standard timestamps.

Also add O2M `modules` on courses as the reverse of modules.course. Interface: list-o2m. Display template: {{title}}.

COLLECTION: lessons
- Icon: play_lesson
- display_template: {{module.title}} / {{title}}
- sort_field: sort_order

Fields:
1. id (uuid pk hidden)
2. module (M2O modules, required, on delete CASCADE). Interface: select-dropdown-m2o. Display template: {{title}}.
3. title (string, required). Interface: input.
4. lesson_type (string, required). Interface: select-dropdown. Choices: video, text, pdf, quiz, assignment, external_link. Default: video. Display: labels.
5. sort_order (integer, default 0).
6. duration_minutes (integer, default 0).
7. is_preview (boolean, default false).
8. required (boolean, default true).
9. completion_criteria (string). Interface: select-dropdown. Choices: view, time_threshold, quiz_passed, submission_accepted, manual. Default: view.

Video fields (show only when lesson_type = video). Set conditional visibility per field:
10. video_source (string, required when lesson_type = video). Interface: select-dropdown. Choices: youtube, vimeo, directus_file, external_url. Default: youtube. Display: labels.
11. video_youtube_id (string). Interface: input. Note: "Paste a YouTube URL or the 11-char ID. A flow normalizes this on save.". Conditional: show when lesson_type = video AND video_source = youtube.
12. video_vimeo_id (string). Interface: input. Note: "Paste a Vimeo URL or the numeric ID.". Conditional: show when lesson_type = video AND video_source = vimeo.
13. video_file (M2O directus_files, nullable). Interface: file. Display: file. Note: "mp4 or webm.". Conditional: show when lesson_type = video AND video_source = directus_file.
14. video_url (string). Interface: input. Note: "Direct mp4 URL or HLS manifest (.m3u8).". Conditional: show when lesson_type = video AND video_source = external_url.
15. video_duration_seconds (integer, default 0). Interface: input. Note: "Auto-filled from oEmbed for YouTube/Vimeo where possible. Editable fallback.". Conditional: show when lesson_type = video.
16. video_thumbnail (M2O directus_files, nullable). Interface: file-image. Display: image. Note: "Optional override. If empty, the frontend derives from source or course cover.". Conditional: show when lesson_type = video.
17. video_captions (M2M to directus_files via `lessons_captions_files` junction). Interface: list-m2m. Display template: {{label}} ({{language_code}}). Note: "VTT caption tracks.". Conditional: show when lesson_type = video.
18. video_transcript (text). Interface: input-rich-text-md. Note: "Optional markdown transcript. Indexed for search.". Conditional: show when lesson_type = video.
19. video_chapters (json, default []). Interface: input-code with language json. Note: "Array of {start: seconds, title: string} for chapter markers on the scrub bar.". Conditional: show when lesson_type = video.
20. allow_download (boolean, default false). Note: "Only meaningful for directus_file and external_url sources.". Conditional: show when lesson_type = video AND video_source IN (directus_file, external_url).
21. resume_from_last_position (boolean, default true). Conditional: show when lesson_type = video.
22. completion_threshold (integer, min 50, max 100, nullable). Interface: input. Note: "Percent of video watched to count complete. When null, course.default_completion_threshold applies.". Conditional: show when lesson_type = video.

Other content fields:
23. text_body (text). Interface: input-rich-text-md. Conditional: show when lesson_type = text.
24. pdf_file (M2O directus_files, nullable). Interface: file. Conditional: show when lesson_type = pdf.
25. quiz (M2O quizzes, nullable). Interface: select-dropdown-m2o. Display template: {{title}}. Conditional: show when lesson_type = quiz. NOTE: the quizzes collection does not exist yet; create this field as nullable and we will wire the relation later.
26. assignment (M2O assignments, nullable). Interface: select-dropdown-m2o. Display template: {{title}}. Conditional: show when lesson_type = assignment. NOTE: assignments collection does not exist yet; create nullable.
27. external_url (string). Interface: input. Conditional: show when lesson_type = external_link.
28. resources (M2M to directus_files via `lessons_resources` junction). Interface: list-m2m or files interface. Note: "Downloadable extras, shown for all lesson types.".
29. Standard timestamps.

Also create the captions junction `lessons_captions_files`:
- Fields: id (uuid pk), lesson (M2O lessons, on delete CASCADE), directus_files_id (M2O directus_files), language_code (string, required, e.g. "en", "es", "fr-CA"), label (string, required, e.g. "English", "Español"), is_default (boolean, default false).

Also add O2M `lessons` on modules as the reverse of lessons.module.

If the Directus MCP cannot configure conditional field visibility in a single call, flag which fields need manual conditional rules and I will set them in Studio.

Form layout on lessons:
- Group "Overview": title, lesson_type, sort_order, duration_minutes, is_preview, required, completion_criteria
- Group "Video content" (conditional: lesson_type = video): video_source, video_youtube_id, video_vimeo_id, video_file, video_url, video_duration_seconds, video_thumbnail, video_captions, video_transcript, video_chapters
- Group "Video advanced" (conditional: lesson_type = video, collapsed by default): allow_download, resume_from_last_position, completion_threshold
- Group "Text content": text_body (conditional: lesson_type = text)
- Group "PDF content": pdf_file (conditional: lesson_type = pdf)
- Group "Quiz content": quiz (conditional: lesson_type = quiz)
- Group "Assignment content": assignment (conditional: lesson_type = assignment)
- Group "External content": external_url (conditional: lesson_type = external_link)
- Group "Resources": resources
```

**Verify:** Create one module under your test course. Create three lessons under the module with different types (one video, one text, one quiz). Confirm that changing lesson_type in the form reveals and hides the appropriate content field groups.

---

## Prompt L5: Enrollments and lesson_progress

```
Create the `enrollments` and `lesson_progress` collections. Both are heavy-write collections tied to learner activity.

COLLECTION: enrollments
- Icon: how_to_reg
- display_template: {{user.first_name}} {{user.last_name}} / {{course.title}}
- archive_field: status
- archive_value: dropped
- sort_field: -enrolled_at

Fields:
1. id (uuid pk hidden)
2. user (M2O directus_users, required). Interface: select-dropdown-m2o. Display template: {{first_name}} {{last_name}}.
3. course (M2O courses, required). Interface: select-dropdown-m2o. Display template: {{title}}.
4. status (string). Interface: select-dropdown. Choices: active, completed, dropped, suspended. Default: active. Display: labels.
5. enrolled_at (datetime, default to $NOW on create). Interface: datetime.
6. started_at (datetime, nullable). Interface: datetime.
7. completed_at (datetime, nullable). Interface: datetime.
8. progress_pct (decimal, precision 5, scale 2, default 0). Interface: input. Display: formatted-value with suffix "%".
9. last_lesson (M2O lessons, nullable). Interface: select-dropdown-m2o. Display template: {{title}}.
10. final_grade (decimal, precision 5, scale 2, nullable). Interface: input. Display: formatted-value with suffix "%".
11. certificate_issued (boolean, default false). Interface: boolean.
12. Standard timestamps.

Unique constraint on (user, course). Apply the unique constraint at the database level if the MCP supports it; otherwise list manual steps.

COLLECTION: lesson_progress
- Icon: trending_up
- display_template: {{user.first_name}} {{user.last_name}} / {{lesson.title}} ({{status}})
- sort_field: -date_updated

Fields:
1. id (uuid pk hidden)
2. user (M2O directus_users, required). Display template: {{first_name}} {{last_name}}.
3. lesson (M2O lessons, required). Display template: {{title}}.
4. enrollment (M2O enrollments, required, on delete CASCADE). Display template: {{course.title}}.
5. status (string). Interface: select-dropdown. Choices: not_started, in_progress, completed. Default: not_started. Display: labels.
6. completed_at (datetime, nullable). Interface: datetime.
7. last_position_seconds (integer, default 0). Interface: input. Note: "For resume on video lessons.".
8. watched_seconds (integer, default 0). Interface: input. Note: "Cumulative unique seconds watched. Used for completion threshold so scrubbing to the end does not mark complete.".
9. last_watched_at (datetime, nullable). Interface: datetime.
10. time_spent_seconds (integer, default 0). Interface: input.
11. Standard timestamps.

Unique constraint on (user, lesson).

Also add:
- On courses: O2M `enrollments` reversing enrollments.course. Interface: list-o2m.
- On directus_users: O2M `enrollments` reversing enrollments.user. Interface: list-o2m. Use the Studio UI for this if the MCP cannot modify system collections.
- On enrollments: O2M `lesson_progress_items` reversing lesson_progress.enrollment. Interface: list-o2m. Display template: {{lesson.title}} ({{status}}).
```

**Verify:** Manually enroll a test user in your test course. Confirm you cannot create a duplicate enrollment (unique constraint works). Create a lesson_progress record linking the user to one lesson. Confirm the enrollment shows it in its `lesson_progress_items` list.

---

## Prompt L6: Quizzes, questions, attempts

```
Create the quiz system: quizzes, questions, question_options, quiz_attempts, quiz_responses, and the junction for selected options.

COLLECTION: quizzes
- Icon: quiz
- display_template: {{title}}

Fields:
1. id (uuid pk hidden)
2. course (M2O courses, nullable). Display template: {{title}}.
3. title (string, required). Interface: input.
4. description (text). Interface: input-rich-text-md.
5. time_limit_minutes (integer, nullable). Note: "Nullable = untimed.".
6. max_attempts (integer, nullable). Note: "Nullable = unlimited.".
7. passing_score (integer, min 0, max 100, default 70).
8. shuffle_questions (boolean, default false).
9. shuffle_options (boolean, default false).
10. show_correct_answers (string). Interface: select-dropdown. Choices: never, after_each_attempt, after_passing, after_all_attempts. Default: after_each_attempt. Display: labels.
11. show_results_immediately (boolean, default true).
12. Standard timestamps.

COLLECTION: questions
- Icon: help
- display_template: {{prompt}}
- sort_field: sort_order

Fields:
1. id (uuid pk hidden)
2. quiz (M2O quizzes, required, on delete CASCADE). Display template: {{title}}.
3. question_type (string, required). Interface: select-dropdown. Choices: single_choice, multiple_choice, true_false, short_answer, essay, matching, ordering. Default: single_choice. Display: labels.
4. prompt (text, required). Interface: input-rich-text-md.
5. points (decimal, precision 6, scale 2, default 1).
6. sort_order (integer, default 0).
7. explanation (text). Interface: input-rich-text-md. Note: "Shown to learner after answering.".
8. required (boolean, default true).
9. Standard timestamps.

COLLECTION: question_options
- Icon: list
- display_template: {{label}}
- sort_field: sort_order

Fields:
1. id (uuid pk hidden)
2. question (M2O questions, required, on delete CASCADE). Display template: {{prompt}}.
3. label (string, required).
4. is_correct (boolean, default false).
5. sort_order (integer, default 0).
6. feedback (text). Note: "Shown if this option is selected.".

Also add:
- On quizzes: O2M `questions` reversing questions.quiz.
- On questions: O2M `options` reversing question_options.question.

Now wire the lessons.quiz field to quizzes: update the lessons.quiz M2O relation to point at quizzes (it was created nullable in Prompt L4). Display template: {{title}}.

COLLECTION: quiz_attempts
- Icon: assignment_turned_in
- display_template: {{user.first_name}} / {{quiz.title}} (attempt {{attempt_number}})
- sort_field: -started_at
- archive_field: status
- archive_value: graded

Fields:
1. id (uuid pk hidden)
2. user (M2O directus_users, required). Display template: {{first_name}} {{last_name}}.
3. quiz (M2O quizzes, required). Display template: {{title}}.
4. enrollment (M2O enrollments, nullable).
5. attempt_number (integer, default 1).
6. started_at (datetime, default $NOW).
7. submitted_at (datetime, nullable).
8. score (decimal, precision 5, scale 2, nullable). Display: formatted-value with suffix "%".
9. points_earned (decimal, precision 8, scale 2, default 0).
10. points_possible (decimal, precision 8, scale 2, default 0).
11. passed (boolean, nullable).
12. time_spent_seconds (integer, default 0).
13. status (string). Interface: select-dropdown. Choices: in_progress, submitted, graded. Default: in_progress. Display: labels.
14. Standard timestamps.

COLLECTION: quiz_responses
- Icon: comment
- display_template: {{question.prompt}}
- sort_field: sort_order (or date_created)

Fields:
1. id (uuid pk hidden)
2. attempt (M2O quiz_attempts, required, on delete CASCADE). Display template: attempt {{attempt_number}}.
3. question (M2O questions, required). Display template: {{prompt}}.
4. selected_options (M2M question_options via `quiz_responses_options` junction). Interface: list-m2m. Display template: {{label}}. Note: "For choice-type questions.".
5. text_answer (text). Interface: input-multiline. Note: "For short_answer and essay.".
6. is_correct (boolean, nullable). Note: "Nullable for ungraded essays.".
7. points_earned (decimal, precision 6, scale 2, default 0).
8. graded_by (M2O directus_users, nullable). Display template: {{first_name}} {{last_name}}.
9. grader_feedback (text). Interface: input-multiline.
10. Standard timestamps.

Also add:
- On quiz_attempts: O2M `responses` reversing quiz_responses.attempt.
- On directus_users: O2M `quiz_attempts` reversing attempts.user (skip if not possible via MCP).
```

**Verify:** Create a quiz, add three questions of different types (single_choice with four options, true_false with two options, essay with no options). Check the quiz detail shows its questions as a nested list. Manually create a quiz_attempt and one quiz_response referencing a choice question with a selected option.

---

## Prompt L7: Assignments and submissions

```
Create the `assignments` and `submissions` collections, plus the file junction.

COLLECTION: assignments
- Icon: assignment
- display_template: {{title}}
- sort_field: -date_created

Fields:
1. id (uuid pk hidden)
2. course (M2O courses, required). Display template: {{title}}.
3. title (string, required). Interface: input.
4. description (text). Interface: input-rich-text-md.
5. instructions (text). Interface: input-rich-text-md.
6. due_date (datetime, nullable). Interface: datetime.
7. max_points (decimal, precision 6, scale 2, default 100).
8. passing_score (decimal, precision 6, scale 2). Default: 70.
9. allow_late_submissions (boolean, default true).
10. late_penalty_pct (decimal, precision 5, scale 2, default 0).
11. submission_types (json). Interface: select-multiple-dropdown with choices: file_upload, text_entry, url. Note: "Array of allowed submission types. Stored as JSON.".
12. rubric (text). Interface: input-rich-text-md.
13. Standard timestamps.

Now wire lessons.assignment to assignments (created nullable in Prompt L4). Display template: {{title}}.

COLLECTION: submissions
- Icon: upload_file
- display_template: {{user.first_name}} / {{assignment.title}}
- sort_field: -submitted_at
- archive_field: status
- archive_value: returned_for_revision

Fields:
1. id (uuid pk hidden)
2. assignment (M2O assignments, required). Display template: {{title}}.
3. user (M2O directus_users, required). Display template: {{first_name}} {{last_name}}.
4. enrollment (M2O enrollments, nullable).
5. status (string). Interface: select-dropdown. Choices: draft, submitted, graded, returned_for_revision. Default: draft. Display: labels.
6. submitted_at (datetime, nullable).
7. text_response (text). Interface: input-rich-text-md.
8. url_response (string). Interface: input.
9. files (M2M directus_files via `submissions_files` junction). Interface: files (list-m2m with file UI if available).
10. grade (decimal, precision 6, scale 2, nullable).
11. grader_feedback (text). Interface: input-rich-text-md.
12. graded_by (M2O directus_users, nullable). Display template: {{first_name}} {{last_name}}.
13. graded_at (datetime, nullable).
14. is_late (boolean, default false). Interface: boolean.
15. attempt_number (integer, default 1).
16. Standard timestamps.

Also add:
- On assignments: O2M `submissions` reversing submissions.assignment.
- On directus_users: O2M `submissions` reversing submissions.user (via MCP if possible).
```

**Verify:** Create an assignment under your test course. Create a submission against it with a text_response and set status to submitted.

---

## Prompt L8: Certificates and badges

```
Create certificate_templates, certificates, badges, and user_badges.

COLLECTION: certificate_templates
- Icon: workspace_premium
- display_template: {{name}}{{#if is_default}} (default){{/if}}

Fields:
1. id (uuid pk hidden)
2. name (string, required). Interface: input.
3. html_template (text, required). Interface: input-code with language html. Note: "HTML template with merge fields: {{learner_name}}, {{course_title}}, {{completion_date}}, {{verification_code}}, {{instructor_name}}, {{grade}}, {{issuer_name}}, {{issuer_title}}.".
4. background_image (file). Interface: file-image.
5. accent_color (string). Interface: select-color. Display: color.
6. is_default (boolean, default false). Interface: boolean. Note: "Exactly one template is the active default. A flow enforces this; saving a row with is_default=true sets all others to false.". Display: boolean.
7. issuer_name (string). Interface: input. Note: "Name of the issuing body (e.g. 'Acme Learning Academy').".
8. issuer_title (string). Interface: input. Note: "Title of the signatory (e.g. 'Director of Education').".
9. signature_image (M2O directus_files, nullable). Interface: file-image. Note: "Optional signature image.".
10. Standard timestamps.

Do NOT wire courses.certificate_template; the courses collection no longer has that field. Templates are global and the issue-certificate flow uses the is_default row.

COLLECTION: certificates
- Icon: verified
- display_template: {{certificate_number}} ({{user.first_name}} {{user.last_name}})
- sort_field: -issued_at

Fields:
1. id (uuid pk hidden)
2. user (M2O directus_users, required). Display template: {{first_name}} {{last_name}}.
3. course (M2O courses, required). Display template: {{title}}.
4. enrollment (M2O enrollments, required).
5. template (M2O certificate_templates). Display template: {{name}}.
6. issued_at (datetime, default $NOW).
7. certificate_number (string, unique). Interface: input readonly. Note: "Auto-generated by flow in format CERT-{YYYY}-{0001}.".
8. verification_code (string, unique). Interface: input readonly. Note: "Short random token for public verification URL.".
9. final_grade (decimal, precision 5, scale 2).
10. pdf_file (file, nullable). Interface: file. Note: "Generated on first view.".
11. Standard timestamps.

Unique constraint on (user, course).

COLLECTION: badges
- Icon: emoji_events
- display_template: {{name}}

Fields:
1. id (uuid pk hidden)
2. name (string, required). Interface: input.
3. description (text). Interface: input-multiline.
4. icon (file). Interface: file-image. Display: image.
5. color (string). Interface: select-color.
6. criteria_type (string). Interface: select-dropdown. Choices: course_completion, courses_count, quiz_perfect_score, streak, manual. Default: manual. Display: labels.
7. criteria_value (json). Interface: input-code with language json. Note: "Shape depends on criteria_type. Examples: {course_id: 'uuid'} for course_completion, {count: 5} for courses_count, {days: 7} for streak.".
8. Standard timestamps.

COLLECTION: user_badges
- Icon: military_tech
- display_template: {{badge.name}} ({{user.first_name}} {{user.last_name}})
- sort_field: -awarded_at

Fields:
1. id (uuid pk hidden)
2. user (M2O directus_users, required). Display template: {{first_name}} {{last_name}}.
3. badge (M2O badges, required). Display template: {{name}}.
4. awarded_at (datetime, default $NOW).
5. awarded_context (string). Note: "Human-readable context like 'for completing Advanced React'.".
6. Standard timestamps.

Unique constraint on (user, badge).

Also add:
- On directus_users: O2M `certificates` and `badges` reversing the respective FKs (via MCP if possible, else Studio).
- On courses: O2M `certificates` reversing certificates.course.
```

**Verify:** Create one certificate_template with is_default = true and a simple HTML template ("<h1>{{learner_name}}</h1><p>{{course_title}}</p>"). Create a second template with is_default = true and confirm the flow (set up in L12) flips the first template's is_default back to false so only one default exists. Create one badge with criteria_type = course_completion. Manually issue a test certificate and award one badge.

---

## Prompt L9: Reviews and announcements

```
Create the final two collections for v1.

COLLECTION: reviews
- Icon: star
- display_template: {{rating}}★ by {{user.first_name}} on {{course.title}}
- sort_field: -date_created

Fields:
1. id (uuid pk hidden)
2. course (M2O courses, required). Display template: {{title}}.
3. user (M2O directus_users, required). Display template: {{first_name}} {{last_name}}.
4. enrollment (M2O enrollments, nullable).
5. rating (integer, min 1, max 5, required). Interface: input (or rating interface if available). Display: rating with max=5, color=amber.
6. title (string). Interface: input.
7. body (text). Interface: input-multiline.
8. is_approved (boolean, default true). Interface: boolean.
9. helpful_count (integer, default 0).
10. instructor_reply (text, nullable). Interface: input-multiline.
11. instructor_reply_at (datetime, nullable).
12. Standard timestamps.

Unique constraint on (user, course).

COLLECTION: announcements
- Icon: campaign
- display_template: {{title}}
- sort_field: -published_at

Fields:
1. id (uuid pk hidden)
2. course (M2O courses, nullable). Note: "Nullable = site-wide announcement."
3. title (string, required). Interface: input.
4. body (text, required). Interface: input-rich-text-md.
5. is_pinned (boolean, default false).
6. published_at (datetime, default $NOW).
7. author (M2O directus_users, required). Display template: {{first_name}} {{last_name}}.
8. Standard timestamps.

Also add O2M `reviews` on courses and O2M `announcements` on courses.
```

**Verify:** Create a review for your test course. Confirm the rating field renders as stars, not a number input. Create one site-wide announcement (course = null) and one course-specific announcement.

---

# PART 2: Roles, Permissions, Flows, Seed

## Prompt L10: Create LMS roles

```
Create four new Directus roles for the LMS. Do not modify any existing roles (Admin, Public, or the CRM roles: Sales Manager, Sales Rep, Marketing, Read-only).

ROLE: LMS Admin
- Description: Full access to LMS collections. Manages users, categories, site-wide settings.
- App access: true
- Admin access: false

ROLE: Instructor
- Description: Manages own courses and grades submissions. Access limited to own courses via instructor = $CURRENT_USER.
- App access: true
- Admin access: false

ROLE: Learner
- Description: Enrolls in published courses, tracks own progress, submits own work.
- App access: true
- Admin access: false

ROLE: Guest Browser
- Description: Anonymous browsing of published courses. Assigned to the Public role is handled as permissions on Public, not as a separate role. Create this role for authenticated users who have not yet upgraded to Learner (optional; skip if redundant with Public).

Do not assign permissions yet. That comes in the next prompt.
```

**Verify:** Three or four new roles appear in the role list. Existing CRM roles untouched.

---

## Prompt L11: Configure LMS permissions

```
Configure permissions for LMS Admin, Instructor, Learner, and the Public role. Do not change permissions for CRM roles or the Admin superuser role.

LMS collections in scope: categories, course_tags, courses_tags (junction), courses_prerequisites, courses_co_instructors, courses, modules, lessons, lessons_resources, enrollments, lesson_progress, quizzes, questions, question_options, quiz_attempts, quiz_responses, quiz_responses_options, assignments, submissions, submissions_files, certificate_templates, certificates, badges, user_badges, reviews, announcements.

=== LMS Admin ===
Full CRUD on every LMS collection. Read/update on directus_users (no delete). No access to CRM collections.

=== Instructor ===

courses:
- read: all items (can see all courses for reference) OR restrict to items where instructor = $CURRENT_USER OR $CURRENT_USER is in co_instructors. Default to the restricted version. Fields: all.
- create: allowed. Preset instructor = $CURRENT_USER.
- update: items where instructor = $CURRENT_USER. Fields: all.
- delete: items where instructor = $CURRENT_USER AND status = Draft (cannot delete Published).

modules, lessons:
- CRUD on items where the parent course.instructor = $CURRENT_USER.

quizzes, questions, question_options:
- CRUD on items where the parent course (through course or question→quiz→course chain) has instructor = $CURRENT_USER.

assignments:
- CRUD on items where course.instructor = $CURRENT_USER.

enrollments, lesson_progress, quiz_attempts, quiz_responses, submissions:
- read: items where the parent course.instructor = $CURRENT_USER. (Instructors see their students' activity.)
- create: denied (these are created by learners).
- update: submissions where course.instructor = $CURRENT_USER (for grading). quiz_responses where the parent attempt's quiz belongs to the instructor's course (for grading essays). Specifically, an instructor can update: submissions.grade, submissions.grader_feedback, submissions.status, submissions.graded_by, submissions.graded_at; quiz_responses.is_correct, quiz_responses.points_earned, quiz_responses.graded_by, quiz_responses.grader_feedback. Other fields on these collections are denied for update.
- delete: denied.

reviews:
- read: items where course.instructor = $CURRENT_USER.
- update: items where course.instructor = $CURRENT_USER. Fields: only instructor_reply and instructor_reply_at.
- create/delete: denied.

announcements:
- read: items where course is null OR course.instructor = $CURRENT_USER.
- create: allowed. Preset author = $CURRENT_USER. Can only set course to courses they instruct.
- update: items where author = $CURRENT_USER.
- delete: items where author = $CURRENT_USER.

certificate_templates, badges:
- read: all items.
- create/update/delete: denied.

categories, course_tags:
- read: all items.
- no writes.

directus_users:
- read: all, restricted fields (id, first_name, last_name, email, avatar, bio, headline, social_*, expertise).
- update: only own record.

=== Learner ===

courses:
- read: items where status = Published AND visibility != Private. Fields: all except internal status/notes.

modules, lessons:
- read: items where the parent course is readable by Learner AND either (lesson.is_preview = true) OR the learner has an active enrollment in the parent course. If that OR condition is hard to express in one filter, split into two permission rules on lessons.

categories, course_tags, reviews, announcements, badges, certificate_templates:
- read: all items (reviews limited to is_approved = true).

enrollments:
- read: items where user = $CURRENT_USER.
- create: allowed. Preset user = $CURRENT_USER. Cannot set status to anything other than active on create.
- update: items where user = $CURRENT_USER. Fields: only status (to dropped or active), last_lesson.
- delete: denied (use status = dropped).

lesson_progress:
- read: items where user = $CURRENT_USER.
- create: allowed. Preset user = $CURRENT_USER.
- update: items where user = $CURRENT_USER.
- delete: denied.

quiz_attempts:
- read: items where user = $CURRENT_USER.
- create: allowed. Preset user = $CURRENT_USER. Must have an active enrollment if the quiz's parent course requires enrollment.
- update: items where user = $CURRENT_USER AND status = in_progress. Fields: submitted_at, time_spent_seconds, and allow the flow-based grading steps.
- delete: denied.

quiz_responses:
- read: items where attempt.user = $CURRENT_USER.
- create: allowed when the attempt belongs to the current user.
- update: items where attempt.user = $CURRENT_USER AND attempt.status = in_progress.
- delete: denied.

submissions:
- read: items where user = $CURRENT_USER.
- create: allowed. Preset user = $CURRENT_USER.
- update: items where user = $CURRENT_USER AND status IN (draft, returned_for_revision). Fields: text_response, url_response, files, status (draft → submitted only).
- delete: items where user = $CURRENT_USER AND status = draft.

certificates, user_badges:
- read: items where user = $CURRENT_USER OR public-facing verification by verification_code (see Public role).

reviews:
- create: allowed. Preset user = $CURRENT_USER. A filter hook Flow (see L12 "Review gating") additionally rejects creation if the reviewer's enrollment in that course has progress_pct < 50.
- update: items where user = $CURRENT_USER. Fields: rating, title, body.
- delete: items where user = $CURRENT_USER.

directus_users:
- read: own record in full; other users limited to the instructor-safe field set.
- update: only own record.

=== Public role (unauthenticated visitors) ===

courses:
- read: items where status = Published AND visibility = Public. Fields: id, title, slug, subtitle, description, learning_objectives, category, tags, cover_image, trailer_video_url, difficulty, language, duration_minutes, price, currency, is_free, instructor (basic fields only), co_instructors (basic), average_rating, rating_count, enrollment_count, published_at. DO NOT expose: enrollment_limit, enrollment_deadline, internal admin fields.

modules:
- read: items where parent course is public.

lessons:
- read: items where parent course is public AND is_preview = true AND parent course.price = 0. Only free courses can surface preview lessons to the public; this matches the Free preview validation flow (L12). Fields exposed: title, lesson_type, sort_order, duration_minutes, is_preview, and the video playback fields (video_source, video_youtube_id, video_vimeo_id, video_file, video_url, video_duration_seconds, video_thumbnail, video_captions, video_chapters, video_transcript) so the preview player can actually play.

categories, course_tags, badges:
- read: all.

reviews:
- read: items where is_approved = true AND course is public.

announcements:
- read: items where course is null (site-wide only).

certificates:
- read: minimal fields (certificate_number, user first/last name, course title, issued_at, final_grade, verification_code) so the /verify/:code page can work. Do NOT expose enrollment, template internals, or pdf_file.

directus_users:
- read: restricted to first_name, last_name, avatar, bio, headline, social_*, expertise, total_students, total_courses, average_rating.

After configuring, verify by impersonating each role. Confirm the CRM Sales Rep role still works on CRM collections and cannot see LMS collections.
```

**Verify:** Log in as a Learner: confirm you can see Published courses and enroll, cannot see Draft courses, cannot see another learner's submissions. Log in as an Instructor: confirm you can edit your own courses only. Log in with a CRM Sales Rep account: confirm nothing about CRM broke and they cannot see LMS collections by default.

---

## Prompt L12: Flows

```
Create the following Directus Flows. Reject the save with a clear error message when a filter hook flow rejects; the frontend will surface it.

FLOW 1: "Course publish validation"
- Trigger: Filter hook (blocking), items.update on courses, only when status transitions to Published
- Steps:
  1. Read Data: fetch the course, fields: modules.lessons, cover_image.
  2. Condition: reject if zero modules, any module has zero lessons, or cover_image is null. Error: "Course must have at least one module with at least one lesson and a cover image before publishing.".
  3. If passing, set published_at = $NOW if currently null.

FLOW 2: "Free preview validation"
- Trigger: Filter hook, items.create and items.update on lessons
- Steps:
  1. Condition: if the payload sets is_preview = true, read the parent course's price. If price > 0, reject with error "Preview lessons are only allowed on free courses.".

FLOW 3: "Normalize video source on lesson save"
- Trigger: Filter hook, items.create and items.update on lessons
- Steps:
  1. If lesson_type != video, pass through.
  2. If video_source = youtube: parse video_youtube_id. Accept either a full URL (watch?v=, youtu.be/, embed/, shorts/) or a bare ID. Extract the 11-char ID. If no ID can be extracted, reject with "Invalid YouTube URL or ID.".
  3. If video_source = vimeo: parse video_vimeo_id. Accept Vimeo URLs (vimeo.com/:id) or bare numeric IDs. Extract the numeric ID. Reject on failure.
  4. If video_source = external_url: validate video_url is a URL. Strip common tracking query params (utm_*, fbclid, gclid).
  5. If video_source = directus_file: video_file must be non-null; reject otherwise.
  6. If video_source = youtube or vimeo and video_duration_seconds is 0 or null: call the respective oEmbed endpoint (https://www.youtube.com/oembed?url=..., https://vimeo.com/api/oembed.json?url=...) and fill video_duration_seconds from the response. On oEmbed failure, leave as 0 (instructor can edit).
  7. Write the normalized payload back.

FLOW 4: "Default enrollment fields"
- Trigger: Filter hook, items.create on enrollments
- Steps:
  1. Transform Payload: set enrolled_at = $NOW if null. status = active if null. progress_pct = 0 if null.

FLOW 5: "Recompute enrollment progress on lesson_progress change"
- Trigger: Event hook, items.create and items.update on lesson_progress
- Steps:
  1. Read Data: fetch the lesson_progress record's enrollment, plus all lesson_progress rows for that enrollment, plus the parent course's total required lessons count.
  2. Run Script:
     - required_completed = count of lesson_progress rows for this enrollment where status = completed AND lesson.required = true
     - total_required = count of lessons where lesson.module.course = enrollment.course AND lesson.required = true
     - progress_pct = total_required > 0 ? (required_completed / total_required) * 100 : 0
     - started_at = enrollment.started_at ?? $NOW (set on first progress event)
     - if progress_pct >= 100 and enrollment.status != completed: status = completed, completed_at = $NOW.
     - last_watched_at = $NOW
  3. Update Data: update enrollment with computed fields. Update lesson_progress.last_watched_at = $NOW.

FLOW 6: "Default certificate template uniqueness"
- Trigger: Filter hook, items.create and items.update on certificate_templates
- Steps:
  1. If payload.is_default = true, update every other certificate_templates row (where id != current id) to is_default = false.
  2. This keeps exactly one default template. If no default exists and the user attempts to unset the last one, reject with "At least one certificate template must be marked as default.".

FLOW 7: "Issue certificate on enrollment completion"
- Trigger: Event hook, items.update on enrollments, only when status transitions to completed
- Steps:
  1. Condition: enrollment.certificate_issued is false.
  2. Read Data: fetch the certificate_templates row where is_default = true. If none, log a warning and stop.
  3. Run Script: generate certificate_number as "CERT-{YYYY}-{sequential zero-padded 5 digits}". Generate verification_code as a URL-safe 12-char alphanumeric token.
  4. Create Item: create a certificates record with user, course, enrollment, template = default template id, certificate_number, verification_code, final_grade.
  5. Update Data: set enrollment.certificate_issued = true.

FLOW 8: "Auto-grade quiz on submit"
- Trigger: Event hook, items.update on quiz_attempts, only when status transitions to submitted
- Steps:
  1. Read Data: fetch all quiz_responses for this attempt with their questions and question_options.
  2. Run Script:
     - For each response where question_type is in (single_choice, multiple_choice, true_false):
       - correct_option_ids = ids of question.options where is_correct = true
       - selected_option_ids = response.selected_options ids
       - is_correct = selected_option_ids matches correct_option_ids exactly (as a set)
       - points_earned = is_correct ? question.points : 0
     - For essay and short_answer: leave is_correct = null and points_earned = 0 (instructor grades).
     - points_earned_total = sum of response.points_earned
     - points_possible_total = sum of question.points for all questions in the quiz
     - score = (points_earned_total / points_possible_total) * 100
     - has_ungraded = any response with is_correct = null
     - passed = score >= quiz.passing_score only if no ungraded responses (else null).
     - new_status = has_ungraded ? "submitted" : "graded"
  3. Update Data: write each response's is_correct and points_earned. Update attempt with score, points_earned, points_possible, passed, status, submitted_at = $NOW.

FLOW 9: "Mark lesson complete on quiz pass"
- Trigger: Event hook, items.update on quiz_attempts, only when passed transitions to true
- Steps:
  1. Find any lesson where lesson.quiz = this quiz AND completion_criteria = quiz_passed.
  2. For each matching lesson: upsert lesson_progress for (user, lesson). Set status = completed, completed_at = $NOW.

FLOW 10: "Mark lesson complete on submission accepted"
- Trigger: Event hook, items.update on submissions, only when status transitions to graded AND grade >= assignment.passing_score
- Steps: analogous to Flow 9 for assignments with completion_criteria = submission_accepted.

FLOW 11: "Compute submission is_late and attempt_number"
- Trigger: Filter hook, items.create on submissions
- Steps:
  1. Transform Payload: if assignment.due_date exists and $NOW > due_date, set is_late = true.
  2. Count existing submissions for (user, assignment); set attempt_number = count + 1.

FLOW 12: "Review gating"
- Trigger: Filter hook, items.create on reviews
- Steps:
  1. Read Data: find the enrollment for (user = payload.user, course = payload.course).
  2. Condition: reject if no enrollment exists, or enrollment.progress_pct < 50. Error: "You must be at least 50 percent through the course to leave a review.".

FLOW 13: "Recompute course stats on review change"
- Trigger: Event hook, items.create, items.update, items.delete on reviews
- Steps:
  1. Read Data: all approved reviews for the affected course.
  2. Run Script: compute average_rating and rating_count.
  3. Update Data: update courses with the computed values.

FLOW 14: "Evaluate badges"
- Trigger: Event hook on enrollments.update (when completed_at is set) AND on quiz_attempts.update (when passed transitions to true) AND Schedule, cron: 0 4 * * * (04:00 UTC daily)
- Steps:
  1. For each active badge, read its criteria_type and criteria_value, evaluate the criteria per user affected by the trigger (or per user sitewide on the scheduled run), and upsert into user_badges (respecting the (user, badge) unique constraint so re-runs do not duplicate).
  2. Criteria types to handle:
     - course_completion: {course_id}. Award if the user has enrollment.status = completed for that course.
     - courses_count: {count}. Award if count(enrollments where user AND status = completed) >= count.
     - quiz_perfect_score: {quiz_id} or {count}. Award if the user has a quiz_attempt with score = 100 for the quiz (or N perfect scores total).
     - streak: {days}. Award if the user has lesson_progress.last_watched_at entries covering N consecutive days.
     - manual: skip in this flow; awarded by admin action.

FLOW 15: "Welcome on enrollment"
- Trigger: Event hook, items.create on enrollments
- Steps:
  1. Create a directus_notifications row for the enrolled user with a subject like "Welcome to {{course.title}}" and a link to /learn/{{course.slug}}.

FLOW 16: "Announcement fan-out"
- Trigger: Event hook, items.create on announcements where is_pinned = true
- Steps:
  1. If course is set: read all active enrollments for that course. For each, create a directus_notifications row for the enrolled user.
  2. If course is null (site-wide) and is_pinned = true: fan out to all Learners site-wide. Batch of 100.

FLOW 17: "Nightly: denormalize instructor stats and course counters"
- Trigger: Schedule, cron: 0 3 * * * (03:00 UTC daily)
- Steps:
  1. For each course: recompute enrollment_count and completion_count.
  2. For each user with role Instructor: total_courses, total_students, average_rating (from reviews on their courses). Update.

FLOW 18: "Cleanup orphaned lesson_progress"
- Trigger: Schedule, cron: 0 5 * * 0 (05:00 UTC on Sundays)
- Steps:
  1. Find lesson_progress rows whose lesson_id no longer exists. Delete.

FLOW 19: "Normalize email on user create/update"
- Trigger: Filter hook, items.create and items.update on directus_users
- Steps:
  1. Transform Payload: if payload.email is present, lowercase and trim.
- NOTE: skip if an identical directus_users-level flow already exists from the CRM side. The CRM's email normalization is on the contacts collection, not directus_users, so this is additive.

After creating, smoke-test by: publishing a course without lessons (should reject), marking a lesson is_preview on a paid course (should reject), saving a YouTube URL on a video lesson and confirming it gets normalized to the 11-char ID, enrolling a learner, completing lessons and watching progress_pct update, issuing a certificate on completion, submitting a quiz with choice and essay questions (choice auto-graded, essay held), grading the essay, flipping a certificate template's is_default and confirming the old default unflips, trying to post a review at 10 percent progress (should reject).
```

**Verify:** Go through the full learner flow with the test user: enroll, complete some lessons, take a quiz with all question types, submit an assignment. Confirm the flows fire at each step. Confirm the CRM flows still work (check a deal stage change on the CRM side).

---

## Prompt L13: Seed data

```
Generate a Node.js + TypeScript seed script for the LMS. This is a separate script from the CRM seed script; place it at packages/lms-seed/index.ts in its own package. Do not touch CRM data.

Dedupe strategy:
- categories: by slug
- course_tags: by name
- courses: by slug
- modules: by (course_id, title)
- lessons: by (module_id, title)
- quizzes: by (course_id, title)
- assignments: by (course_id, title)
- users: by email
- badges: by name
- certificate_templates: by name

Generate:
- 10 categories: Web Development, Data Science, Design, Business, Marketing, Photography, Music, Health & Fitness, Personal Development, Language. Add 3 sub-categories each (at least).
- 30 course_tags covering common topics (react, python, sql, figma, leadership, sales, etc.).
- 20 users:
  - 2 LMS Admins
  - 6 Instructors: realistic names, bios, headlines, expertise tied to categories, social links
  - 12 Learners
  - Emails end in @example.com
  - Log generated passwords once at end of run (do not persist them in code).
- 3 certificate templates with different styles (minimal, classic, modern). Mark exactly ONE as is_default = true.
- 10 badges across criteria types.
- 40 courses across categories and instructors:
  - 70% Published, 20% Draft, 10% Archived
  - 30% free, 70% paid with prices $29 to $199
  - Random cover_image placeholders (use picsum.photos URLs or similar)
  - Realistic titles, subtitles, learning_objectives (3-5 per course)
  - 4 to 8 modules per course, 3 to 6 lessons per module
  - Lesson type distribution: 50% video, 25% text, 10% pdf, 10% quiz, 5% assignment
  - For video lessons: set video_source = youtube, populate video_youtube_id with real placeholder IDs (use a rotating set of 5-10 Creative Commons or example video IDs like "dQw4w9WgXcQ", "jNQXAC9IVRw", "9bZkp7q19f0"). Set video_duration_seconds to realistic values (180 to 1500). Leave video_captions empty. Populate video_transcript with a short markdown paragraph for 20 percent of video lessons. Populate video_chapters JSON for 10 percent of video lessons with 3-5 chapter entries.
  - On free courses (30 percent), mark approximately 2 lessons per course as is_preview = true. On paid courses, is_preview must be false (the Free preview validation flow will reject otherwise).
- 15 quizzes attached to courses with 5 to 15 questions each. Include all question types. For choice questions, generate options with 1-2 correct.
- 10 assignments with realistic prompts (submit a project, write a paper, etc.).
- 200 enrollments across learners and published courses:
  - ~30% at 0% progress (just enrolled)
  - ~40% in progress (between 10 and 90 percent)
  - ~20% completed (certificate issued via the flow)
  - ~10% dropped
- Corresponding lesson_progress records so progress_pct math holds. For video lessons on in-progress enrollments, set watched_seconds proportional to progress (not just last_position_seconds).
- 50 quiz attempts with realistic scores.
- 30 assignment submissions, 60% graded.
- ~20 certificates will be auto-issued by the Issue certificate flow when enrollments flip to completed. Do not insert certificates directly in seed; let the flow generate them so verification_codes and certificate_numbers follow the production path. If the flow is disabled during seed, fall back to creating them with is_default template.
- ~40 user_badges awarded.
- 100 reviews on published courses, ratings skewed 3.5-5.0 with some 1-2 star for realism. Only create reviews for enrollments whose progress_pct >= 50 (to satisfy the Review gating flow). If the flow is disabled during seed, the seed can insert freely; otherwise pre-filter.
- 15 announcements (5 site-wide, 10 course-specific).

Script requirements (same as CRM seed):
- Reads DIRECTUS_URL and DIRECTUS_ADMIN_TOKEN.
- Batches of 50.
- Logs progress.
- Skips-on-error with summary at end.
- Exits non-zero if >5% of records fail in any collection.
- Uses @faker-js/faker.
- Does not modify or recreate CRM data.

Output the full contents of packages/lms-seed/index.ts, package.json, tsconfig.json, and README in a single response.
```

**Verify:** Run the seed. Open Studio and spot-check: 40 courses exist, most are Published. Open one course, confirm it has modules and lessons. Open one enrollment that should be completed, confirm it has a certificate attached. Spot-check that CRM data is intact.

---

After all of Part 2 verifications pass, the LMS backend is done. Report any MCP gaps (conditional visibility, permission filter syntax, unique constraints) and we will close them by hand in Studio. Then move on to the frontend prompts.
