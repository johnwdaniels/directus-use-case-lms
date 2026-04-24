#!/usr/bin/env tsx
/**
 * LMS Seed Script — packages/lms-seed/index.ts
 *
 * Env vars:
 *   DIRECTUS_URL          (default: http://localhost:8055)
 *   DIRECTUS_ADMIN_TOKEN  (required)
 *
 * Idempotent: deduplicates by slug / name / email / composite key.
 * Run: npx tsx index.ts
 */

import { faker } from "@faker-js/faker";
import * as crypto from "crypto";

faker.seed(1337); // reproducible runs

// ─── Config ──────────────────────────────────────────────────────────────────
const BASE = (process.env.DIRECTUS_URL ?? "http://localhost:8055").replace(/\/$/, "");
const TOKEN = process.env.DIRECTUS_ADMIN_TOKEN ?? "";
const DRY = process.env.DRY_RUN === "true";

if (!TOKEN) { console.error("❌  DIRECTUS_ADMIN_TOKEN required"); process.exit(1); }
if (DRY) console.log("🔍  DRY RUN — no writes");

// ─── Stats ────────────────────────────────────────────────────────────────────
type StatEntry = { created: number; skipped: number; errors: number };
const STATS: Record<string, StatEntry> = {};
const st = (c: string): StatEntry => (STATS[c] ??= { created: 0, skipped: 0, errors: 0 });
const inc = (c: string, k: keyof StatEntry) => st(c)[k]++;

// ─── HTTP ─────────────────────────────────────────────────────────────────────
const HDR: Record<string, string> = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

async function http<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  if (DRY && method !== "GET") { console.log(`  DRY ${method} ${path}`); return {} as T; }
  const res = await fetch(`${BASE}${path}`, {
    method, headers: HDR,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${method} ${path} [${res.status}]: ${text.slice(0, 300)}`);
  }
  const raw = await res.json() as any;
  return (raw.data ?? raw) as T;
}

const GET  = <T>(p: string) => http<T>("GET", p);
const POST = <T>(p: string, b: unknown) => http<T>("POST", p, b);
const PATCH = <T>(p: string, b: unknown) => http<T>("PATCH", p, b);

// ─── Lookup helpers ───────────────────────────────────────────────────────────
async function findBy(coll: string, field: string, value: string): Promise<any | null> {
  const r = await GET<any[]>(`/items/${coll}?filter[${field}][_eq]=${encodeURIComponent(value)}&limit=1&fields=*`);
  return Array.isArray(r) ? (r[0] ?? null) : null;
}

async function findByComposite(coll: string, kv: Record<string, string>): Promise<any | null> {
  const qs = Object.entries(kv).map(([k, v]) => `filter[${k}][_eq]=${encodeURIComponent(v)}`).join("&");
  const r  = await GET<any[]>(`/items/${coll}?${qs}&limit=1&fields=*`);
  return Array.isArray(r) ? (r[0] ?? null) : null;
}

async function findUser(email: string): Promise<any | null> {
  const r = await GET<any[]>(`/users?filter[email][_eq]=${encodeURIComponent(email)}&limit=1&fields=*`);
  return Array.isArray(r) ? (r[0] ?? null) : null;
}

// ─── Batch create ─────────────────────────────────────────────────────────────
async function batchCreate(coll: string, items: unknown[], size = 50): Promise<any[]> {
  const all: any[] = [];
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size);
    try {
      const res = await POST<any[]>(`/items/${coll}`, batch);
      const arr = Array.isArray(res) ? res : [res];
      all.push(...arr);
      arr.forEach(() => inc(coll, "created"));
    } catch (e) {
      console.error(`  ⚠  [${coll}] batch@${i}: ${(e as Error).message.slice(0, 200)}`);
      batch.forEach(() => inc(coll, "errors"));
    }
  }
  return all;
}

// ─── Upsert helpers ───────────────────────────────────────────────────────────
async function upsert(coll: string, field: string, value: string, data: unknown): Promise<any | null> {
  try {
    const ex = await findBy(coll, field, value);
    if (ex) { inc(coll, "skipped"); return ex; }
    const res = await POST<any>(`/items/${coll}`, data);
    const item = Array.isArray(res) ? res[0] : res;
    inc(coll, "created");
    return item;
  } catch (e) {
    console.error(`  ⚠  [${coll}] upsert(${field}=${value}): ${(e as Error).message.slice(0, 150)}`);
    inc(coll, "errors");
    return null;
  }
}

async function upsertUser(data: Record<string, unknown>): Promise<any | null> {
  const coll = "directus_users";
  try {
    const ex = await findUser(data.email as string);
    if (ex) { inc(coll, "skipped"); return ex; }
    const res = await POST<any>("/users", data);
    const item = Array.isArray(res) ? res[0] : res;
    inc(coll, "created");
    return item;
  } catch (e) {
    console.error(`  ⚠  [users] ${data.email}: ${(e as Error).message.slice(0, 150)}`);
    inc(coll, "errors");
    return null;
  }
}

// ─── Flow control ─────────────────────────────────────────────────────────────
async function setFlowStatus(name: string, status: "active" | "inactive") {
  try {
    const r = await GET<any[]>(`/flows?filter[name][_eq]=${encodeURIComponent(name)}&fields=id&limit=1`);
    if (Array.isArray(r) && r[0]) {
      await PATCH(`/flows/${r[0].id}`, { status });
      console.log(`  ⚙  Flow "${name}" → ${status}`);
    }
  } catch { /* ignore */ }
}

// ─── Slugify ──────────────────────────────────────────────────────────────────
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const pick  = <T>(arr: T[]) => faker.helpers.arrayElement(arr);
const pickN = <T>(arr: T[], n: number) => faker.helpers.arrayElements(arr, n);
const rand  = (min: number, max: number) => faker.number.int({ min, max });

// ═══════════════════════════════════════════════════════════════════════════════
// STATIC DATA
// ═══════════════════════════════════════════════════════════════════════════════

const CATEGORY_TREE = [
  { name: "Web Development", slug: "web-development", subs: [
    "HTML & CSS Fundamentals", "JavaScript Essentials", "Backend Development",
  ]},
  { name: "Data Science", slug: "data-science", subs: [
    "Machine Learning", "Data Analysis & Visualization", "Statistical Methods",
  ]},
  { name: "Design", slug: "design", subs: [
    "UI/UX Design", "Graphic Design", "Motion Graphics & Animation",
  ]},
  { name: "Business", slug: "business", subs: [
    "Entrepreneurship", "Leadership & Management", "Finance & Accounting",
  ]},
  { name: "Marketing", slug: "marketing", subs: [
    "Digital Marketing", "SEO & Search Marketing", "Content Marketing",
  ]},
  { name: "Photography", slug: "photography", subs: [
    "Portrait Photography", "Landscape & Nature", "Photo Editing & Retouching",
  ]},
  { name: "Music", slug: "music", subs: [
    "Music Theory", "Guitar & String Instruments", "Music Production",
  ]},
  { name: "Health & Fitness", slug: "health-fitness", subs: [
    "Yoga & Meditation", "Nutrition & Diet", "Strength Training & HIIT",
  ]},
  { name: "Personal Development", slug: "personal-development", subs: [
    "Productivity & Time Management", "Mindfulness & Wellness", "Public Speaking",
  ]},
  { name: "Language", slug: "language", subs: [
    "Spanish for Beginners", "French Language", "Japanese & Asian Languages",
  ]},
] as const;

const TAGS = [
  "react","vue","angular","nextjs","typescript","javascript","nodejs","python",
  "sql","postgresql","mongodb","graphql","docker","kubernetes","git","figma",
  "photoshop","machine-learning","tensorflow","data-analysis","excel","leadership",
  "sales","seo","content-marketing","email-marketing","agile","photography",
  "music-production","yoga",
] as const;

const YT_IDS = [
  "dQw4w9WgXcQ","jNQXAC9IVRw","9bZkp7q19f0","M7lc1UVf-VE","oHg5SJYRHA0",
  "xvFZjo5PgG0","kJQP7kiw5Fk","JGwWNGJdvx8","hT_nvWreIhg","YQHsXMglC9A",
];

const COURSE_DATA: Array<{
  catSlug: string; title: string; subtitle: string;
  tags: string[]; instructorEmail: string;
}> = [
  // Web Development
  { catSlug:"web-development", title:"Complete React Developer Bootcamp", subtitle:"Build modern apps with React 18, Hooks, and Redux",
    tags:["react","typescript","javascript"], instructorEmail:"sarah.chen@example.com" },
  { catSlug:"web-development", title:"Node.js & Express: Build RESTful APIs", subtitle:"Server-side JavaScript from zero to production",
    tags:["nodejs","javascript","postgresql"], instructorEmail:"sarah.chen@example.com" },
  { catSlug:"web-development", title:"TypeScript Masterclass", subtitle:"Type-safe JavaScript for enterprise-scale apps",
    tags:["typescript","javascript","react"], instructorEmail:"sarah.chen@example.com" },
  { catSlug:"web-development", title:"Next.js from Zero to Full Stack", subtitle:"The complete React meta-framework course",
    tags:["nextjs","react","typescript"], instructorEmail:"sarah.chen@example.com" },
  { catSlug:"web-development", title:"CSS Animation & Modern Layouts", subtitle:"Beautiful UIs with pure CSS Grid and Flexbox",
    tags:["javascript","figma"], instructorEmail:"sarah.chen@example.com" },
  // Data Science
  { catSlug:"data-science", title:"Python for Data Science Bootcamp", subtitle:"NumPy, Pandas, Matplotlib from scratch",
    tags:["python","data-analysis","machine-learning"], instructorEmail:"marcus.thompson@example.com" },
  { catSlug:"data-science", title:"Machine Learning A-Z", subtitle:"Hands-on ML with Scikit-Learn and TensorFlow",
    tags:["machine-learning","python","tensorflow"], instructorEmail:"marcus.thompson@example.com" },
  { catSlug:"data-science", title:"SQL for Data Analysts", subtitle:"Write complex queries and optimize performance",
    tags:["sql","postgresql","data-analysis"], instructorEmail:"marcus.thompson@example.com" },
  { catSlug:"data-science", title:"Deep Learning & Neural Networks", subtitle:"From perceptrons to transformers",
    tags:["tensorflow","machine-learning","python"], instructorEmail:"marcus.thompson@example.com" },
  { catSlug:"data-science", title:"Statistics for Data Science", subtitle:"Probability, inference, and experimentation",
    tags:["data-analysis","excel","python"], instructorEmail:"marcus.thompson@example.com" },
  // Design
  { catSlug:"design", title:"Figma UI Design Masterclass", subtitle:"Design systems, components, and prototyping",
    tags:["figma","react"], instructorEmail:"emma.rodriguez@example.com" },
  { catSlug:"design", title:"Adobe Photoshop Complete Course", subtitle:"Retouching, compositing, and digital art",
    tags:["photoshop","photography"], instructorEmail:"emma.rodriguez@example.com" },
  { catSlug:"design", title:"UX Research Methods", subtitle:"User interviews, usability testing, synthesis",
    tags:["figma"], instructorEmail:"emma.rodriguez@example.com" },
  { catSlug:"design", title:"Motion Graphics with After Effects", subtitle:"Animate interfaces and create compelling videos",
    tags:["music-production"], instructorEmail:"emma.rodriguez@example.com" },
  { catSlug:"design", title:"Brand Identity Design", subtitle:"Logo, typography, colour systems, and guidelines",
    tags:["figma","photoshop"], instructorEmail:"emma.rodriguez@example.com" },
  // Business
  { catSlug:"business", title:"Leadership Fundamentals", subtitle:"Manage teams, drive results, and inspire people",
    tags:["leadership","agile"], instructorEmail:"james.wilson@example.com" },
  { catSlug:"business", title:"Financial Modeling & Analysis", subtitle:"Build DCF models, forecast revenues, and value companies",
    tags:["excel","sql"], instructorEmail:"james.wilson@example.com" },
  { catSlug:"business", title:"Project Management Professional", subtitle:"PMBOK, Agile, and hybrid frameworks",
    tags:["agile","leadership"], instructorEmail:"james.wilson@example.com" },
  { catSlug:"business", title:"Startup Founder's Playbook", subtitle:"Ideation, validation, fundraising, and growth",
    tags:["leadership","sales"], instructorEmail:"james.wilson@example.com" },
  { catSlug:"business", title:"Business Strategy Essentials", subtitle:"Competitive advantage and strategic planning",
    tags:["leadership","excel"], instructorEmail:"james.wilson@example.com" },
  // Marketing
  { catSlug:"marketing", title:"SEO Masterclass", subtitle:"Rank #1 on Google with proven techniques",
    tags:["seo","content-marketing"], instructorEmail:"olivia.park@example.com" },
  { catSlug:"marketing", title:"Google Ads & PPC Advertising", subtitle:"Drive paid traffic that converts",
    tags:["seo","email-marketing"], instructorEmail:"olivia.park@example.com" },
  { catSlug:"marketing", title:"Content Marketing Strategy", subtitle:"Build audiences and drive organic growth",
    tags:["content-marketing","email-marketing"], instructorEmail:"olivia.park@example.com" },
  { catSlug:"marketing", title:"Email Marketing Complete Guide", subtitle:"Campaigns, automation, and deliverability",
    tags:["email-marketing","content-marketing"], instructorEmail:"olivia.park@example.com" },
  { catSlug:"marketing", title:"Social Media Marketing", subtitle:"Instagram, LinkedIn, TikTok growth strategies",
    tags:["content-marketing","seo"], instructorEmail:"olivia.park@example.com" },
  // Photography
  { catSlug:"photography", title:"Portrait Photography Masterclass", subtitle:"Lighting, posing, and post-processing",
    tags:["photography","photoshop"], instructorEmail:"alex.kim@example.com" },
  { catSlug:"photography", title:"Landscape Photography Complete Guide", subtitle:"Golden hour, composition, and RAW editing",
    tags:["photography"], instructorEmail:"alex.kim@example.com" },
  { catSlug:"photography", title:"Lightroom Classic Complete", subtitle:"Organise, develop, and export like a pro",
    tags:["photography","photoshop"], instructorEmail:"alex.kim@example.com" },
  // Music
  { catSlug:"music", title:"Guitar for Beginners", subtitle:"From first chord to your first song in 30 days",
    tags:["music-production"], instructorEmail:"alex.kim@example.com" },
  { catSlug:"music", title:"Music Production with Ableton Live", subtitle:"Beats, synthesis, mixing, and mastering",
    tags:["music-production"], instructorEmail:"alex.kim@example.com" },
  // Health & Fitness
  { catSlug:"health-fitness", title:"Yoga for Beginners", subtitle:"Flexibility, strength, and mindfulness",
    tags:["yoga"], instructorEmail:"james.wilson@example.com" },
  { catSlug:"health-fitness", title:"Strength Training & HIIT", subtitle:"Build muscle, burn fat, and transform your body",
    tags:["yoga"], instructorEmail:"james.wilson@example.com" },
  { catSlug:"health-fitness", title:"Plant-Based Nutrition", subtitle:"Thrive on a whole-food plant-based diet",
    tags:["yoga"], instructorEmail:"james.wilson@example.com" },
  // Personal Development
  { catSlug:"personal-development", title:"Productivity Masterclass", subtitle:"GTD, time-blocking, and deep work strategies",
    tags:["leadership","agile"], instructorEmail:"olivia.park@example.com" },
  { catSlug:"personal-development", title:"Public Speaking Confidence", subtitle:"Command any room with clarity and presence",
    tags:["leadership"], instructorEmail:"olivia.park@example.com" },
  { catSlug:"personal-development", title:"Personal Finance Fundamentals", subtitle:"Budgeting, investing, and financial independence",
    tags:["excel"], instructorEmail:"james.wilson@example.com" },
  // Language
  { catSlug:"language", title:"Spanish for Beginners", subtitle:"A1–B1 with immersive conversation practice",
    tags:[], instructorEmail:"olivia.park@example.com" },
  { catSlug:"language", title:"Business French", subtitle:"Professional communication in French",
    tags:[], instructorEmail:"olivia.park@example.com" },
  { catSlug:"language", title:"Japanese: From Zero", subtitle:"Hiragana, Katakana, and everyday phrases",
    tags:[], instructorEmail:"olivia.park@example.com" },
  { catSlug:"language", title:"Mandarin Chinese Basics", subtitle:"Tones, pinyin, and survival vocabulary",
    tags:[], instructorEmail:"emma.rodriguez@example.com" },
];

const MODULE_TEMPLATES = [
  "Introduction & Getting Started", "Core Concepts", "Hands-on Practice",
  "Intermediate Techniques", "Real-World Projects", "Advanced Topics",
  "Best Practices & Patterns", "Testing & Debugging", "Deployment & Beyond",
  "Final Project & Wrap-Up",
];

const LESSON_TITLE_PREFIXES: Record<string, string[]> = {
  video: ["Introduction to", "Understanding", "Deep Dive:", "Hands-on:", "Tutorial:", "Overview of", "Working with"],
  text:  ["Guide:", "Notes on", "Reference:", "Cheatsheet:", "Reading:"],
  pdf:   ["PDF Resource:", "Downloadable:", "Workbook:", "Slides:"],
  quiz:  ["Knowledge Check:", "Quiz:", "Assessment:", "Test:"],
  assignment: ["Project:", "Assignment:", "Challenge:", "Build:"],
};

const TOPIC_WORDS = [
  "Core Concepts", "Fundamentals", "Best Practices", "Real-World Use Cases",
  "Common Patterns", "Advanced Techniques", "Performance Tips", "Setup & Config",
  "Error Handling", "Data Structures", "State Management", "Authentication",
  "API Integration", "Testing Strategies", "Refactoring & Clean Code",
];

const OBJECTIVES = [
  "Understand the fundamentals and apply them to real projects",
  "Build professional-grade features from scratch",
  "Debug and solve common problems efficiently",
  "Implement best practices and industry standards",
  "Optimise for performance and scalability",
  "Ship production-ready code with confidence",
  "Collaborate effectively using modern workflows",
  "Test thoroughly and handle edge cases",
];

const QUIZ_QUESTIONS: Record<string, Array<{ prompt: string; options: string[]; correctIdx: number[] }>> = {
  single: [
    { prompt: "Which lifecycle method runs after the component mounts?",
      options: ["componentDidMount", "componentWillMount", "render", "componentDidUpdate"], correctIdx: [0] },
    { prompt: "What does REST stand for?",
      options: ["Remote Execution State Transfer", "Representational State Transfer",
                "Resource Entity State Transfer", "Responsive Entity Service Technology"], correctIdx: [1] },
    { prompt: "Which HTTP method is idempotent and used to update a full resource?",
      options: ["POST", "GET", "PUT", "PATCH"], correctIdx: [2] },
    { prompt: "What is the time complexity of binary search?",
      options: ["O(n)", "O(n²)", "O(log n)", "O(1)"], correctIdx: [2] },
    { prompt: "In SQL, which clause filters groups?",
      options: ["WHERE", "GROUP BY", "HAVING", "ORDER BY"], correctIdx: [2] },
  ],
  multiple: [
    { prompt: "Which of the following are valid HTTP status codes for client errors?",
      options: ["200", "400", "404", "500", "422"], correctIdx: [1, 2, 4] },
    { prompt: "Select all JavaScript array methods that return a new array:",
      options: ["map", "filter", "forEach", "reduce", "find"], correctIdx: [0, 1] },
    { prompt: "Which principles are part of SOLID?",
      options: ["Single Responsibility", "Open/Closed", "Liskov Substitution", "Fast Execution", "Dependency Inversion"],
      correctIdx: [0, 1, 2, 4] },
  ],
  truefalse: [
    { prompt: "Python is statically typed by default.", options: ["True", "False"], correctIdx: [1] },
    { prompt: "The HTTP GET method can have a request body.", options: ["True", "False"], correctIdx: [0] },
    { prompt: "SQL GROUP BY executes before WHERE.", options: ["True", "False"], correctIdx: [1] },
    { prompt: "A foreign key must reference a primary key.", options: ["True", "False"], correctIdx: [0] },
  ],
};

const ASSIGNMENT_PROMPTS = [
  { title: "Build a Portfolio Website", description: "Create a responsive multi-page portfolio showcasing your skills. Must include an About, Projects, and Contact page. Deploy to Vercel or Netlify." },
  { title: "REST API Design Challenge", description: "Design and implement a RESTful API for a resource of your choice. Include authentication, CRUD endpoints, and comprehensive error handling." },
  { title: "Data Analysis Report", description: "Analyse the provided dataset using Python/pandas. Create visualisations and write a report of at least 500 words covering your findings and recommendations." },
  { title: "UI Redesign Project", description: "Pick an existing app or website and redesign 3 key screens in Figma. Include a style guide, component library, and interactive prototype." },
  { title: "Marketing Campaign Proposal", description: "Develop a complete digital marketing campaign for a fictional product. Include target audience analysis, channel strategy, content calendar, and KPI plan." },
  { title: "Photography Portfolio Edit", description: "Submit 10 edited photos demonstrating the techniques covered. Include before/after comparisons and a brief description of your editing choices." },
  { title: "Capstone Research Paper", description: "Write a 1,500-word research paper on a topic covered in this course. Cite at least 5 peer-reviewed sources and include a bibliography." },
  { title: "Case Study Analysis", description: "Analyse the provided business case study. Identify key problems, propose solutions with supporting data, and present a 10-slide deck." },
  { title: "Personal Budget Spreadsheet", description: "Build a comprehensive budget spreadsheet with income tracking, expense categories, savings goals, and a net-worth projection chart." },
  { title: "Music Production Challenge", description: "Produce an original 2-minute track demonstrating the techniques from the course. Export a mixdown and share the project file." },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SEED FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Placeholder cover images ───────────────────────────────────────────────────
async function seedCoverImages(): Promise<string[]> {
  const seeds = ["tech","data","design","business","marketing","photo","music","fitness","growth","language"];
  const ids: string[] = [];
  console.log("\n📷  Importing cover images…");
  for (const s of seeds) {
    try {
      const url = `https://picsum.photos/seed/${s}/1200/630`;
      const res = await fetch(`${BASE}/files/import`, {
        method: "POST", headers: HDR,
        body: JSON.stringify({ url, data: { title: `${s} cover` } }),
      });
      if (res.ok) {
        const j = await res.json() as any;
        if (j.data?.id) { ids.push(j.data.id); process.stdout.write("."); }
      }
    } catch { /* skip */ }
  }
  console.log(`\n  Imported ${ids.length} cover images`);
  return ids;
}

// ── Categories ─────────────────────────────────────────────────────────────────
async function seedCategories(): Promise<Map<string, string>> {
  console.log("\n📂  Seeding categories…");
  const map = new Map<string, string>(); // slug → id

  for (const cat of CATEGORY_TREE) {
    const item = await upsert("categories", "slug", cat.slug, {
      name: cat.name, slug: cat.slug,
    });
    if (item) {
      map.set(cat.slug, item.id);
      for (const subName of cat.subs) {
        const subSlug = slug(subName);
        const sub = await upsert("categories", "slug", subSlug, {
          name: subName, slug: subSlug, parent: item.id,
        });
        if (sub) map.set(subSlug, sub.id);
      }
    }
  }
  console.log(`  ${st("categories").created} created, ${st("categories").skipped} skipped`);
  return map;
}

// ── Tags ───────────────────────────────────────────────────────────────────────
async function seedTags(): Promise<Map<string, string>> {
  console.log("\n🏷   Seeding course_tags…");
  const map = new Map<string, string>(); // name → id
  for (const name of TAGS) {
    const item = await upsert("course_tags", "name", name, { name, slug: name });
    if (item) map.set(name, item.id);
  }
  console.log(`  ${st("course_tags").created} created, ${st("course_tags").skipped} skipped`);
  return map;
}

// ── Users ──────────────────────────────────────────────────────────────────────
interface SeedUser {
  email: string; password?: string; first_name: string; last_name: string; role: string;
  headline?: string; bio?: string;
  social_twitter?: string; social_linkedin?: string; social_website?: string;
  total_courses?: number; total_students?: number; average_rating?: number;
}

async function seedUsers(roles: Map<string, string>): Promise<{ map: Map<string, string>; passwords: string[] }> {
  console.log("\n👥  Seeding users…");
  const map = new Map<string, string>(); // email → id
  const passwordLog: string[] = [];

  const lmsAdminRoleId  = roles.get("LMS Admin")  ?? "";
  const instructorRoleId = roles.get("Instructor") ?? "";
  const learnerRoleId    = roles.get("Learner")    ?? "";

  const INSTRUCTORS: SeedUser[] = [
    {
      email: "sarah.chen@example.com", first_name: "Sarah", last_name: "Chen",
      role: instructorRoleId,
      headline: "Senior React Developer · 5,200+ students taught",
      bio: "Sarah is a full-stack engineer with 10 years in Silicon Valley startups. She specialises in React, TypeScript, and Node.js and has a passion for making complex concepts approachable.",
      social_twitter: "https://twitter.com/sarahchendev", social_linkedin: "https://linkedin.com/in/sarahchendev",
      social_website: "https://sarahchen.dev", total_courses: 5, total_students: 5200, average_rating: 4.8,
    },
    {
      email: "marcus.thompson@example.com", first_name: "Marcus", last_name: "Thompson",
      role: instructorRoleId,
      headline: "Data Scientist & ML Engineer · ex-Google",
      bio: "Marcus spent eight years at Google AI and now teaches data science full-time. He holds a PhD in Statistics from MIT and loves turning raw data into actionable insights.",
      social_twitter: "https://twitter.com/marcusdata", social_linkedin: "https://linkedin.com/in/marcusthompson",
      social_website: "https://marcusthompson.ai", total_courses: 5, total_students: 4100, average_rating: 4.7,
    },
    {
      email: "emma.rodriguez@example.com", first_name: "Emma", last_name: "Rodriguez",
      role: instructorRoleId,
      headline: "Product Designer at Figma Alumni · Design System Expert",
      bio: "Emma built design systems at Figma and Airbnb. She now teaches UI/UX design with a focus on practical, portfolio-worthy projects that get students hired.",
      social_twitter: "https://twitter.com/emmadesigns", social_linkedin: "https://linkedin.com/in/emmarodriguez",
      social_website: "https://emmarodriguez.design", total_courses: 5, total_students: 3800, average_rating: 4.9,
    },
    {
      email: "james.wilson@example.com", first_name: "James", last_name: "Wilson",
      role: instructorRoleId,
      headline: "Serial Entrepreneur & Business Strategist",
      bio: "James has founded three companies, led teams of 200+, and now advises Fortune 500 firms on leadership and strategy. His no-nonsense MBA-style courses are loved by aspiring executives.",
      social_linkedin: "https://linkedin.com/in/jameswilsonbiz",
      social_website: "https://jameswilson.biz", total_courses: 7, total_students: 6900, average_rating: 4.6,
    },
    {
      email: "olivia.park@example.com", first_name: "Olivia", last_name: "Park",
      role: instructorRoleId,
      headline: "Growth Marketer · 10M+ organic visits generated",
      bio: "Olivia has driven growth at three SaaS unicorns and built SEO strategies that generate millions of organic sessions each month. She teaches marketing with data-driven rigour.",
      social_twitter: "https://twitter.com/oliviamarketing", social_linkedin: "https://linkedin.com/in/oliviapark",
      total_courses: 6, total_students: 5500, average_rating: 4.7,
    },
    {
      email: "alex.kim@example.com", first_name: "Alex", last_name: "Kim",
      role: instructorRoleId,
      headline: "Award-Winning Photographer & Music Producer",
      bio: "Alex has shot campaigns for Nike, Samsung, and National Geographic. When not behind the lens, Alex produces electronic music and teaches both crafts with the same creative philosophy.",
      social_twitter: "https://twitter.com/alexkimphoto",
      social_website: "https://alexkim.photo", total_courses: 4, total_students: 2400, average_rating: 4.8,
    },
  ];

  const ADMINS: SeedUser[] = [
    { email: "admin.lms@example.com",  first_name: "Diana", last_name: "Foster",  role: lmsAdminRoleId },
    { email: "admin2.lms@example.com", first_name: "Robert", last_name: "Haines", role: lmsAdminRoleId },
  ];

  const allUsers = [...ADMINS, ...INSTRUCTORS];
  for (const u of allUsers) {
    const pw = crypto.randomBytes(10).toString("base64url");
    passwordLog.push(`${u.email}  pw=${pw}`);
    const item = await upsertUser({ ...u, password: pw });
    if (item) map.set(u.email, item.id);
  }

  // 12 Learners
  const LEARNER_NAMES = [
    ["Priya","Sharma"],["Tom","Baker"],["Ana","Souza"],["Kenji","Tanaka"],
    ["Claire","Dubois"],["Mohammed","Hassan"],["Sofia","Martinez"],["David","Lee"],
    ["Ingrid","Larsson"],["Jamal","Williams"],["Mei","Wang"],["Lucas","Oliveira"],
  ];
  for (const [fn, ln] of LEARNER_NAMES) {
    const email = `${fn.toLowerCase()}.${ln.toLowerCase()}@example.com`;
    const pw = crypto.randomBytes(10).toString("base64url");
    passwordLog.push(`${email}  pw=${pw}`);
    const item = await upsertUser({ email, first_name: fn, last_name: ln, password: pw, role: learnerRoleId });
    if (item) map.set(email, item.id);
  }

  console.log(`  ${st("directus_users").created} created, ${st("directus_users").skipped} skipped`);
  return { map, passwords: passwordLog };
}

// ── Certificate templates ──────────────────────────────────────────────────────
async function seedCertTemplates(): Promise<string[]> {
  console.log("\n🏅  Seeding certificate templates…");
  const TEMPLATES = [
    {
      name: "Minimal Certificate",
      html_template: `<div style="font-family:Inter,sans-serif;padding:60px;text-align:center;border:2px solid #e5e7eb">
<h1 style="font-size:28px;color:#1f2937">Certificate of Completion</h1>
<p style="font-size:18px;color:#6b7280">This certifies that</p>
<h2 style="font-size:36px;color:#111827">{{learner_name}}</h2>
<p style="color:#6b7280">has successfully completed</p>
<h3 style="font-size:22px;color:#1f2937">{{course_title}}</h3>
<p>Issued {{completion_date}} · Verification: {{verification_code}}</p>
<p style="color:#9ca3af;font-size:12px">{{issuer_name}} · {{issuer_title}}</p>
</div>`,
      accent_color: "#6366f1", is_default: false,
      issuer_name: "Acme Learning Academy", issuer_title: "Director of Education",
    },
    {
      name: "Classic Certificate",
      html_template: `<div style="font-family:Georgia,serif;padding:80px;border:8px double #b45309;background:#fffbeb">
<h1 style="color:#92400e;font-size:32px;text-align:center;text-transform:uppercase;letter-spacing:4px">Certificate of Achievement</h1>
<hr style="border-color:#d97706;margin:20px 0"/>
<p style="text-align:center;font-size:16px">Proudly presented to</p>
<h2 style="text-align:center;font-size:40px;color:#78350f">{{learner_name}}</h2>
<p style="text-align:center">For outstanding completion of</p>
<h3 style="text-align:center;font-size:24px;color:#92400e">{{course_title}}</h3>
<p style="text-align:center;font-size:13px;color:#b45309">Awarded on {{completion_date}} | Final Grade: {{grade}}% | Code: {{verification_code}}</p>
</div>`,
      accent_color: "#d97706", is_default: false,
      issuer_name: "Acme Learning Academy", issuer_title: "Chief Learning Officer",
    },
    {
      name: "Modern Certificate",
      html_template: `<div style="font-family:system-ui,sans-serif;background:linear-gradient(135deg,#0f172a,#1e3a5f);color:#fff;padding:70px;border-radius:12px">
<div style="background:rgba(255,255,255,0.05);padding:50px;border-radius:8px;border:1px solid rgba(255,255,255,0.1)">
<h1 style="font-size:14px;letter-spacing:6px;text-transform:uppercase;color:#94a3b8">Certificate of Completion</h1>
<h2 style="font-size:44px;font-weight:800;margin:16px 0">{{learner_name}}</h2>
<p style="color:#94a3b8;font-size:16px">Successfully completed</p>
<h3 style="font-size:26px;color:#38bdf8">{{course_title}}</h3>
<p style="color:#64748b;font-size:13px">{{completion_date}} · Instructor: {{instructor_name}} · Code: {{verification_code}}</p>
</div>
</div>`,
      accent_color: "#38bdf8", is_default: true,
      issuer_name: "Acme Learning Academy", issuer_title: "Platform Director",
    },
  ];

  const ids: string[] = [];
  for (const tpl of TEMPLATES) {
    const item = await upsert("certificate_templates", "name", tpl.name, tpl);
    if (item) ids.push(item.id);
  }
  console.log(`  ${st("certificate_templates").created} created, ${st("certificate_templates").skipped} skipped`);
  return ids;
}

// ── Badges ─────────────────────────────────────────────────────────────────────
async function seedBadges(catIds: Map<string, string>): Promise<Map<string, string>> {
  console.log("\n🏆  Seeding badges…");
  const map = new Map<string, string>(); // name → id
  const BADGE_DATA = [
    { name: "First Enrollment",      color: "#10b981", criteria_type: "courses_count", criteria_value: { count: 1 }  },
    { name: "Course Completer",      color: "#6366f1", criteria_type: "course_completion", criteria_value: { course_id: null } },
    { name: "Knowledge Collector",   color: "#f59e0b", criteria_type: "courses_count", criteria_value: { count: 5 }  },
    { name: "Power Learner",         color: "#ef4444", criteria_type: "courses_count", criteria_value: { count: 10 } },
    { name: "Perfect Score",         color: "#8b5cf6", criteria_type: "quiz_perfect_score", criteria_value: { count: 1 } },
    { name: "Quiz Master",           color: "#ec4899", criteria_type: "quiz_perfect_score", criteria_value: { count: 5 } },
    { name: "7-Day Streak",          color: "#14b8a6", criteria_type: "streak", criteria_value: { days: 7 }   },
    { name: "30-Day Streak",         color: "#f97316", criteria_type: "streak", criteria_value: { days: 30 }  },
    { name: "Early Adopter",         color: "#6d28d9", criteria_type: "manual", criteria_value: {}  },
    { name: "Community Contributor", color: "#0ea5e9", criteria_type: "manual", criteria_value: {}  },
  ];
  for (const b of BADGE_DATA) {
    const item = await upsert("badges", "name", b.name, {
      ...b,
      criteria_value: JSON.stringify(b.criteria_value),
      description: faker.lorem.sentence(),
    });
    if (item) map.set(b.name, item.id);
  }
  console.log(`  ${st("badges").created} created, ${st("badges").skipped} skipped`);
  return map;
}

// ── Roles lookup ───────────────────────────────────────────────────────────────
async function lookupRoles(): Promise<Map<string, string>> {
  const roles = await GET<any[]>("/roles?fields=id,name&limit=50");
  const map = new Map<string, string>();
  if (Array.isArray(roles)) roles.forEach(r => map.set(r.name, r.id));
  return map;
}

// ── Courses + Modules + Lessons ────────────────────────────────────────────────
interface PlannedLesson {
  module_key: string; title: string; lesson_type: string; sort_order: number;
  is_preview: boolean; required: boolean; completion_criteria: string;
  video_source?: string; video_youtube_id?: string; video_duration_seconds?: number;
  video_transcript?: string; video_chapters?: string;
  text_body?: string; quiz_key?: string; assignment_key?: string;
  duration_minutes: number;
}

interface PlannedModule {
  course_key: string; title: string; sort_order: number;
  lessons: PlannedLesson[];
}

interface PlannedCourse {
  key: string; title: string; subtitle: string; catSlug: string;
  instructorEmail: string; tags: string[];
  status: "Published" | "Draft" | "Archived";
  is_free: boolean; price: number; currency: string;
  difficulty: string; language: string; duration_minutes: number;
  learning_objectives: string[];
  modules: PlannedModule[];
  hasQuiz: boolean; hasAssignment: boolean;
}

function planLesson(
  modKey: string, idx: number, isFree: boolean,
  forceType?: string, quizKey?: string, assignKey?: string,
): PlannedLesson {
  const types = ["video","video","video","video","video","text","text","text","pdf","pdf"];
  const raw_type = forceType ?? pick(types);
  const type = raw_type as PlannedLesson["lesson_type"];
  const titlePrefix = pick(LESSON_TITLE_PREFIXES[type] ?? LESSON_TITLE_PREFIXES.video);
  const topic = pick(TOPIC_WORDS);
  const title = `${titlePrefix} ${topic}`;
  const dur = rand(3, 25);

  const lesson: PlannedLesson = {
    module_key: modKey, title, lesson_type: type, sort_order: idx,
    is_preview: false, required: true,
    completion_criteria: type === "quiz" ? "quiz_passed" : type === "assignment" ? "submission_accepted" : "view",
    duration_minutes: dur,
  };

  if (type === "video") {
    lesson.video_source = "youtube";
    lesson.video_youtube_id = pick(YT_IDS);
    lesson.video_duration_seconds = rand(180, 1500);
    if (Math.random() < 0.2) lesson.video_transcript = faker.lorem.paragraphs(2, "\n\n");
    if (Math.random() < 0.1) {
      const numCh = rand(3, 5);
      const chDur = lesson.video_duration_seconds;
      lesson.video_chapters = JSON.stringify(
        Array.from({ length: numCh }, (_, i) => ({
          start: Math.floor((i / numCh) * chDur),
          title: pick(["Introduction", "Core Concepts", "Examples", "Practice", "Summary"]),
        }))
      );
    }
  } else if (type === "text") {
    lesson.text_body = `## ${topic}\n\n${faker.lorem.paragraphs(3, "\n\n")}`;
  } else if (type === "quiz" && quizKey) {
    lesson.quiz_key = quizKey;
  } else if (type === "assignment" && assignKey) {
    lesson.assignment_key = assignKey;
  } else {
    // no quiz/assignment available — downgrade
    lesson.lesson_type = "text";
    lesson.text_body = `## ${topic}\n\n${faker.lorem.paragraphs(3, "\n\n")}`;
  }
  return lesson;
}

function planCourse(
  data: typeof COURSE_DATA[0], idx: number,
  quizKey: string | undefined, assignKey: string | undefined,
): PlannedCourse {
  const statusRoll = Math.random();
  const status = statusRoll < 0.70 ? "Published" : statusRoll < 0.90 ? "Draft" : "Archived";
  const is_free = Math.random() < 0.30;
  const price = is_free ? 0 : pick([29,39,49,59,79,99,129,149,179,199]);
  const numMods = rand(4, 8);

  const modules: PlannedModule[] = [];
  let totalDur = 0;

  for (let mi = 0; mi < numMods; mi++) {
    const modTitle = MODULE_TEMPLATES[mi % MODULE_TEMPLATES.length]!;
    const modKey = `m_${idx}_${mi}`;
    const numLessons = rand(3, 6);
    const lessons: PlannedLesson[] = [];

    for (let li = 0; li < numLessons; li++) {
      let type: string | undefined;
      if (mi === 0 && li === 0 && quizKey) type = "quiz";
      else if (mi === 1 && li === 0 && assignKey) type = "assignment";

      const lesson = planLesson(modKey, li, is_free, type, quizKey, assignKey);

      // Preview: only on free courses, max 2 per course
      const previewCount = modules.flatMap(m => m.lessons).filter(l => l.is_preview).length;
      if (is_free && previewCount < 2 && li === 0 && status === "Published") lesson.is_preview = true;

      lessons.push(lesson);
      totalDur += lesson.duration_minutes;
    }
    modules.push({ course_key: `c_${idx}`, title: modTitle, sort_order: mi, lessons });
  }

  return {
    key: `c_${idx}`,
    title: data.title,
    subtitle: data.subtitle,
    catSlug: data.catSlug,
    instructorEmail: data.instructorEmail,
    tags: data.tags,
    status, is_free, price, currency: "USD",
    difficulty: pick(["Beginner","Intermediate","Advanced","All Levels"]),
    language: "English",
    duration_minutes: totalDur,
    learning_objectives: pickN(OBJECTIVES, rand(3, 5)),
    modules,
    hasQuiz: !!quizKey, hasAssignment: !!assignKey,
  };
}

async function seedCourseContent(
  catMap: Map<string, string>,
  tagMap: Map<string, string>,
  userMap: Map<string, string>,
  coverIds: string[],
): Promise<{
  courseMap: Map<string, string>;
  moduleMap: Map<string, string>;
  lessonIds: string[];
  lessonsByModule: Map<string, string[]>;
  coursePlan: PlannedCourse[];
  quizByCourse: Map<string, string>;
  assignByCourse: Map<string, string>;
}> {
  console.log("\n📚  Seeding courses (pre-fetch & idempotent)…");

  const quizByCourse  = new Map<string, string>(); // course_key → quiz_id
  const assignByCourse = new Map<string, string>(); // course_key → assignment_id

  // ── Pre-fetch existing data ─────────────────────────────────────────────
  console.log("  Pre-fetching existing courses, modules, quizzes…");
  const [existCourseRes, existModRes, existQuizRes] = await Promise.all([
    GET<any[]>("/items/courses?fields=id,slug&limit=200"),
    GET<any[]>("/items/modules?fields=id,title,course&limit=2000"),
    GET<any[]>("/items/quizzes?fields=id,title,course&limit=200"),
  ]);

  const existSlugMap  = new Map((existCourseRes  ?? []).map((c: any) => [c.slug,  c.id]));
  const existModMap   = new Map((existModRes     ?? []).map((m: any) => [`${m.course}:${m.title}`, m.id]));
  const existQuizMap  = new Map((existQuizRes    ?? []).filter((q: any) => q.course).map((q: any) => [`${q.course}:${q.title}`, q.id]));
  const orphanQuizzes = (existQuizRes ?? []).filter((q: any) => !q.course);

  console.log(`  Found: ${existSlugMap.size} courses, ${existModMap.size} modules, ${existQuizMap.size} linked quizzes, ${orphanQuizzes.length} orphan quizzes`);

  // ── Generate plan (structural, no DB IDs yet) ───────────────────────────
  const plan: PlannedCourse[] = COURSE_DATA.map((data, idx) =>
    planCourse(data, idx, undefined, undefined)
  );

  // ── Courses: upsert by slug ─────────────────────────────────────────────
  const courseMap = new Map<string, string>(); // plan_key → id

  const missingCourseIdxs = plan.map((c, i) => ({ c, i })).filter(({ c }) => !existSlugMap.has(slug(c.title)));
  if (missingCourseIdxs.length) {
    console.log(`  Creating ${missingCourseIdxs.length} missing courses…`);
    const courseRows = missingCourseIdxs.map(({ c }) => ({
      title: c.title, slug: slug(c.title), subtitle: c.subtitle,
      description: faker.lorem.paragraphs(3, "\n\n"),
      learning_objectives: JSON.stringify(c.learning_objectives),
      category: catMap.get(c.catSlug),
      cover_image: coverIds.length ? pick(coverIds) : null,
      difficulty: c.difficulty, language: c.language,
      duration_minutes: c.duration_minutes, price: c.price, currency: c.currency,
      is_free: c.is_free, status: c.status, visibility: "Public",
      instructor: userMap.get(c.instructorEmail),
      self_paced: true, passing_score: 70, default_completion_threshold: 80,
      enrollment_count: 0, completion_count: 0, average_rating: 0, rating_count: 0,
      ...(c.status === "Published" ? { published_at: faker.date.past({ years: 1 }).toISOString() } : {}),
    }));
    const created = await batchCreate("courses", courseRows);
    created.forEach((item, i) => {
      const idx = missingCourseIdxs[i];
      if (item?.id && idx) existSlugMap.set(slug(idx.c.title), item.id);
    });
  } else {
    console.log(`  All 40 courses already exist — skipping`);
    plan.forEach(c => inc("courses", "skipped"));
  }

  plan.forEach((c, idx) => {
    const id = existSlugMap.get(slug(c.title));
    if (id) courseMap.set(`c_${idx}`, id);
  });
  console.log(`  courseMap: ${courseMap.size} entries`);

  // ── Tags: attach to courses (idempotent PATCH) ──────────────────────────
  for (const [pi, c] of plan.entries()) {
    const cId = courseMap.get(c.key);
    if (!cId || !c.tags.length) continue;
    const tagJunction = c.tags.map(t => tagMap.get(t)).filter(Boolean).map(tid => ({ course_tags_id: tid }));
    if (tagJunction.length) await PATCH(`/items/courses/${cId}`, { tags: tagJunction }).catch(() => {});
  }

  // ── Quizzes: upsert by (course, title) ─────────────────────────────────
  console.log("  Upserting quizzes…");
  for (let i = 0; i < 15; i++) {
    const cId   = courseMap.get(`c_${i}`);
    if (!cId) continue;
    const title = `${COURSE_DATA[i]!.title} — Final Quiz`;
    const existKey = `${cId}:${title}`;

    if (existQuizMap.has(existKey)) {
      quizByCourse.set(`c_${i}`, existQuizMap.get(existKey)!);
      inc("quizzes", "skipped");
    } else {
      // Reuse an orphan if its title matches, otherwise create fresh
      const orphan = orphanQuizzes.find(q => q.title === title);
      if (orphan) {
        await PATCH(`/items/quizzes/${orphan.id}`, { course: cId }).catch(() => {});
        quizByCourse.set(`c_${i}`, orphan.id);
        inc("quizzes", "skipped");
      } else {
        try {
          const created = await POST<any>("/items/quizzes", {
            course: cId, title,
            description: faker.lorem.sentence(),
            time_limit_minutes: rand(15, 45), max_attempts: rand(2, 5),
            passing_score: 70, shuffle_questions: true, shuffle_options: true,
            show_correct_answers: "after_passing", show_results_immediately: true,
          });
          const item = Array.isArray(created) ? created[0] : created;
          if (item?.id) { quizByCourse.set(`c_${i}`, item.id); inc("quizzes", "created"); }
        } catch (e) {
          console.error(`  ⚠  quiz c_${i}: ${(e as Error).message.slice(0, 120)}`);
          inc("quizzes", "errors");
        }
      }
    }
  }
  console.log(`  quizzes: ${st("quizzes").created} created, ${st("quizzes").skipped} skipped`);

  // ── Assignments: upsert by (course, title) ──────────────────────────────
  console.log("  Upserting assignments…");
  for (let i = 0; i < 10; i++) {
    const cId   = courseMap.get(`c_${i}`);
    if (!cId) continue;
    const prompt = ASSIGNMENT_PROMPTS[i]!;
    const existing = await findByComposite("assignments", { course: cId, title: prompt.title });
    if (existing) {
      assignByCourse.set(`c_${i}`, existing.id);
      inc("assignments", "skipped");
    } else {
      try {
        const created = await POST<any>("/items/assignments", {
          course: cId, title: prompt.title, description: prompt.description,
          instructions: faker.lorem.paragraphs(2),
          max_points: 100, passing_score: 70, allow_late_submissions: true,
          late_penalty_pct: 10,
          submission_types: JSON.stringify(["text_entry","file_upload","url"]),
          rubric: faker.lorem.paragraph(),
        });
        const item = Array.isArray(created) ? created[0] : created;
        if (item?.id) { assignByCourse.set(`c_${i}`, item.id); inc("assignments", "created"); }
      } catch (e) {
        console.error(`  ⚠  assignment c_${i}: ${(e as Error).message.slice(0, 120)}`);
        inc("assignments", "errors");
      }
    }
  }
  console.log(`  assignments: ${st("assignments").created} created, ${st("assignments").skipped} skipped`);

  // ── Modules: upsert by (course, title) ─────────────────────────────────
  console.log("  Checking modules…");
  const missingModules: Array<{ modKey: string; row: any }> = [];
  for (const c of plan) {
    const cId = courseMap.get(c.key);
    if (!cId) continue;
    for (const m of c.modules) {
      const existKey = `${cId}:${m.title}`;
      if (!existModMap.has(existKey)) {
        missingModules.push({
          modKey: `${c.key}_${m.sort_order}`,
          row: { course: cId, title: m.title, sort_order: m.sort_order, description: faker.lorem.sentence() },
        });
      }
    }
  }
  if (missingModules.length) {
    console.log(`  Creating ${missingModules.length} missing modules…`);
    const createdMods = await batchCreate("modules", missingModules.map(m => m.row));
    createdMods.forEach((item, i) => {
      const mm = missingModules[i];
      if (item?.id && mm) existModMap.set(`${mm.row.course}:${mm.row.title}`, item.id);
    });
  } else {
    console.log("  All modules already exist — skipping");
  }

  // Build moduleMap: plan_key → module_id
  const moduleMap = new Map<string, string>();
  for (const c of plan) {
    const cId = courseMap.get(c.key);
    if (!cId) continue;
    for (const m of c.modules) {
      const modId = existModMap.get(`${cId}:${m.title}`);
      if (modId) moduleMap.set(`${c.key}_${m.sort_order}`, modId);
    }
  }
  console.log(`  moduleMap: ${moduleMap.size} entries`);

  // ── Lessons: create if none exist yet ──────────────────────────────────
  const lessonCountRes = await GET<any>("/items/lessons?fields=id&limit=1&meta=total_count");
  const existingLessonCount: number = lessonCountRes?.meta?.total_count ?? 0;

  if (existingLessonCount > 0) {
    console.log(`  Lessons already exist (${existingLessonCount}) — fetching for progress mapping…`);
    const existLessons = await GET<any[]>("/items/lessons?fields=id,module&limit=5000");
    const lessonsByModule = new Map<string, string[]>();
    for (const l of (existLessons ?? [])) {
      const arr = lessonsByModule.get(l.module) ?? [];
      arr.push(l.id);
      lessonsByModule.set(l.module, arr);
    }
    const lessonIds = (existLessons ?? []).map((l: any) => l.id);
    return { courseMap, moduleMap, lessonIds, lessonsByModule, coursePlan: plan, quizByCourse, assignByCourse };
  }

  // Build lesson rows using plan + IDs
  const allLessons: any[] = [];
  for (const c of plan) {
    for (const m of c.modules) {
      const modId = moduleMap.get(`${c.key}_${m.sort_order}`);
      if (!modId) continue;
      for (const l of m.lessons) {
        const qId = l.quiz_key ?? (m.lessons.some(x => x.lesson_type === "quiz") ? quizByCourse.get(c.key) : undefined);
        const aId = l.assignment_key ?? (m.lessons.some(x => x.lesson_type === "assignment") ? assignByCourse.get(c.key) : undefined);
        const row: any = {
          module: modId, title: l.title, lesson_type: l.lesson_type,
          sort_order: l.sort_order, is_preview: l.is_preview, required: l.required,
          completion_criteria: l.completion_criteria, duration_minutes: l.duration_minutes,
        };
        if (l.lesson_type === "video") {
          row.video_source = "youtube";
          row.video_youtube_id = l.video_youtube_id;
          row.video_duration_seconds = l.video_duration_seconds;
          if (l.video_transcript) row.video_transcript = l.video_transcript;
          if (l.video_chapters)   row.video_chapters   = JSON.parse(l.video_chapters);
        } else if (l.lesson_type === "text") {
          row.text_body = l.text_body;
        } else if (l.lesson_type === "quiz" && qId) {
          row.quiz = qId;
        } else if (l.lesson_type === "assignment" && aId) {
          row.assignment = aId;
        }
        allLessons.push(row);
      }
    }
  }

  console.log(`  Creating ${allLessons.length} lessons…`);
  const createdLessons = await batchCreate("lessons", allLessons, 50);
  const lessonIds = createdLessons.map(l => l?.id).filter(Boolean);

  const lessonsByModule = new Map<string, string[]>();
  for (const [mi, row] of allLessons.entries()) {
    const lid = createdLessons[mi]?.id;
    if (!lid) continue;
    const arr = lessonsByModule.get(row.module) ?? [];
    arr.push(lid);
    lessonsByModule.set(row.module, arr);
  }

  return { courseMap, moduleMap, lessonIds, lessonsByModule, coursePlan: plan, quizByCourse, assignByCourse };
}

// ── Quiz questions + options ───────────────────────────────────────────────────
async function seedQuizQuestions(quizIds: string[]): Promise<void> {
  console.log("\n❓  Seeding quiz questions + options…");
  const Q_TYPES = ["single_choice","multiple_choice","true_false","short_answer","essay"] as const;
  const questions: any[] = [];
  const optionsByQ: Array<{ questionIdx: number; opts: any[] }> = [];

  for (const [qi, qid] of quizIds.entries()) {
    const numQ = rand(5, 15);
    for (let i = 0; i < numQ; i++) {
      const qType = pick([...Q_TYPES, ...Q_TYPES.slice(0, 3)]); // weight toward choice types
      const qData = pick([...QUIZ_QUESTIONS.single, ...QUIZ_QUESTIONS.multiple, ...QUIZ_QUESTIONS.truefalse]);
      const useTemplate = qType !== "essay" && qType !== "short_answer";
      questions.push({
        quiz: qid, question_type: qType, sort_order: i, points: pick([1, 2, 3, 5]),
        prompt: useTemplate ? qData.prompt : faker.lorem.sentence() + "?",
        explanation: faker.lorem.sentence(),
        required: true,
      });
      if (useTemplate) {
        optionsByQ.push({ questionIdx: questions.length - 1, opts: qData.options.map((o, oi) => ({
          label: o, is_correct: qData.correctIdx.includes(oi), sort_order: oi,
          feedback: qData.correctIdx.includes(oi) ? "Correct!" : "Not quite.",
        }))});
      }
    }
  }

  const createdQs = await batchCreate("questions", questions);

  // Create options
  const allOpts: any[] = [];
  for (const { questionIdx, opts } of optionsByQ) {
    const qId = createdQs[questionIdx]?.id;
    if (!qId) continue;
    opts.forEach(o => allOpts.push({ ...o, question: qId }));
  }
  if (allOpts.length) await batchCreate("question_options", allOpts);
}

// ── Enrollments ────────────────────────────────────────────────────────────────
async function seedEnrollments(
  userMap: Map<string, string>,
  courseMap: Map<string, string>,
  coursePlan: PlannedCourse[],
): Promise<{ enrollMap: Map<string, string>; completedEnrolls: string[] }> {
  console.log("\n📋  Seeding enrollments…");

  const learnerEmails = [
    "priya.sharma@example.com","tom.baker@example.com","ana.souza@example.com",
    "kenji.tanaka@example.com","claire.dubois@example.com","mohammed.hassan@example.com",
    "sofia.martinez@example.com","david.lee@example.com","ingrid.larsson@example.com",
    "jamal.williams@example.com","mei.wang@example.com","lucas.oliveira@example.com",
  ];

  const publishedCourses = coursePlan
    .filter(c => c.status === "Published")
    .map(c => ({ key: c.key, id: courseMap.get(c.key) }))
    .filter(c => c.id) as Array<{ key: string; id: string }>;

  const enrollRows: any[] = [];
  const enrollMap = new Map<string, string>();
  const planned: Array<{ userId: string; courseId: string; status: string; progressPct: number }> = [];
  const used = new Set<string>();

  // Target 200 enrollments spread across 12 learners and published courses
  const target = 200;
  let attempts = 0;
  while (planned.length < target && attempts < 5000) {
    attempts++;
    const email  = pick(learnerEmails);
    const course = pick(publishedCourses);
    const userId = userMap.get(email);
    if (!userId || !course.id) continue;
    const key = `${userId}:${course.id}`;
    if (used.has(key)) continue;
    used.add(key);

    const roll = Math.random();
    const status = roll < 0.30 ? "active"     // 30% not started
                 : roll < 0.70 ? "active"      // 40% in progress
                 : roll < 0.90 ? "completed"   // 20% completed
                 : "dropped";                  // 10% dropped

    const progressPct = status === "completed" ? 100
                       : status === "dropped"   ? rand(5, 40)
                       : roll < 0.30            ? 0
                       : rand(10, 90);

    planned.push({ userId, courseId: course.id, status, progressPct });
    enrollRows.push({
      user:         userId,
      course:       course.id,
      status:       status === "completed" ? "active" : status, // create as active, patch to completed later
      progress_pct: progressPct,
      enrolled_at:  faker.date.past({ years: 1 }).toISOString(),
      started_at:   progressPct > 0 ? faker.date.past({ years: 1 }).toISOString() : null,
      completed_at: null,
      certificate_issued: false,
      final_grade:  status === "completed" ? rand(75, 100) : null,
    });
  }

  const created = await batchCreate("enrollments", enrollRows);
  const completedEnrolls: string[] = [];

  for (const [i, item] of created.entries()) {
    if (!item?.id) continue;
    const p = planned[i];
    if (!p) continue;
    enrollMap.set(`${p.userId}:${p.courseId}`, item.id);
    if (p.status === "completed") completedEnrolls.push(item.id);
  }

  console.log(`  ${st("enrollments").created} enrollments, ${completedEnrolls.length} to complete`);
  return { enrollMap, completedEnrolls };
}

// ── Lesson progress ────────────────────────────────────────────────────────────
async function seedLessonProgress(
  enrollMap: Map<string, string>,
  lessonsByModule: Map<string, string[]>,
  moduleMap: Map<string, string>,
  coursePlan: PlannedCourse[],
  courseMap: Map<string, string>,
): Promise<void> {
  console.log("\n📈  Seeding lesson_progress…");
  const rows: any[] = [];

  // Build course→[lessonId] map
  const courseLessons = new Map<string, string[]>();
  for (const c of coursePlan) {
    const lessons: string[] = [];
    for (const m of c.modules) {
      const modKey = `${c.key}_${m.sort_order}`;
      const modId  = moduleMap.get(modKey);
      if (!modId) continue;
      const lids = lessonsByModule.get(modId) ?? [];
      lessons.push(...lids);
    }
    const cId = courseMap.get(c.key);
    if (cId) courseLessons.set(cId, lessons);
  }

  for (const [enrollKey, enrollId] of enrollMap) {
    const [userId, courseId] = enrollKey.split(":");
    if (!userId || !courseId) continue;
    const lessons = courseLessons.get(courseId) ?? [];
    if (!lessons.length) continue;

    // Determine how many lessons to mark complete
    const now = new Date();
    const statusRoll = Math.random();
    let doneCount = statusRoll < 0.30 ? 0
                  : statusRoll < 0.70 ? rand(1, Math.max(1, Math.floor(lessons.length * 0.9)))
                  : lessons.length;     // completed

    for (let i = 0; i < lessons.length; i++) {
      const lid = lessons[i]!;
      const isComplete = i < doneCount;
      const completedAt = isComplete ? faker.date.past({ years: 1 }).toISOString() : null;
      rows.push({
        user: userId, lesson: lid, enrollment: enrollId,
        status: isComplete ? "completed" : i === doneCount ? "in_progress" : "not_started",
        completed_at: completedAt,
        last_position_seconds: isComplete ? 0 : rand(10, 500),
        watched_seconds: isComplete ? rand(500, 1500) : rand(0, 300),
        last_watched_at: isComplete ? completedAt : rand(0, 1) ? faker.date.recent({ days: 14 }).toISOString() : null,
        time_spent_seconds: isComplete ? rand(300, 1800) : rand(0, 600),
      });
    }
  }

  await batchCreate("lesson_progress", rows, 50);
  console.log(`  ${st("lesson_progress").created} lesson_progress records`);
}

// ── Complete enrollments → certificates ────────────────────────────────────────
async function completeEnrollments(
  completedIds: string[],
  userMap: Map<string, string>,
  defaultTemplateId: string | null,
): Promise<void> {
  console.log(`\n🎓  Completing ${completedIds.length} enrollments (flow issues certs)…`);
  let issued = 0;
  for (const id of completedIds) {
    try {
      await PATCH(`/items/enrollments/${id}`, {
        status: "completed",
        completed_at: faker.date.past({ years: 1 }).toISOString(),
        progress_pct: 100,
      });
      issued++;
      // Allow the flow a moment (batched)
      if (issued % 10 === 0) await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      console.error(`  ⚠  complete enrollment ${id}: ${(e as Error).message.slice(0, 100)}`);
    }
  }
  console.log(`  Completed ${issued} enrollments`);
}

// ── Quiz attempts ──────────────────────────────────────────────────────────────
async function seedQuizAttempts(
  enrollMap: Map<string, string>,
  quizByCourse: Map<string, string>,
  coursePlan: PlannedCourse[],
  courseMap: Map<string, string>,
  userMap: Map<string, string>,
): Promise<void> {
  console.log("\n📝  Seeding quiz_attempts…");
  const rows: any[] = [];
  const courseQuizPairs: Array<{ cKey: string; quizId: string }> = [];
  for (const [cKey, qId] of quizByCourse) courseQuizPairs.push({ cKey, quizId: qId });

  const learnerIds = [...userMap.values()].slice(2 + 6); // skip admins + instructors

  for (let i = 0; i < 50; i++) {
    const pair = pick(courseQuizPairs);
    const cId  = courseMap.get(pair.cKey);
    const userId = pick(learnerIds);
    if (!cId || !userId) continue;
    const enrollId = enrollMap.get(`${userId}:${cId}`) ?? null;
    const score  = rand(50, 100);
    const now = faker.date.past({ years: 1 }).toISOString();
    rows.push({
      user: userId, quiz: pair.quizId, enrollment: enrollId,
      attempt_number: 1, started_at: now, submitted_at: now,
      score, points_earned: score, points_possible: 100,
      passed: score >= 70, time_spent_seconds: rand(300, 1800),
      status: "graded",
    });
  }
  await batchCreate("quiz_attempts", rows);
  console.log(`  ${st("quiz_attempts").created} quiz attempts`);
}

// ── Submissions ────────────────────────────────────────────────────────────────
async function seedSubmissions(
  enrollMap: Map<string, string>,
  assignByCourse: Map<string, string>,
  courseMap: Map<string, string>,
  userMap: Map<string, string>,
): Promise<void> {
  console.log("\n📤  Seeding submissions…");
  const rows: any[] = [];
  const learnerIds = [...userMap.values()].slice(2 + 6);
  const pairs = [...assignByCourse.entries()].map(([ck, aid]) => ({ cKey: ck, assignId: aid }));
  if (!pairs.length) { console.log("  No assignments to submit against"); return; }

  for (let i = 0; i < 30; i++) {
    const pair   = pick(pairs);
    const cId    = courseMap.get(pair.cKey);
    const userId = pick(learnerIds);
    if (!cId || !userId) continue;
    const enrollId = enrollMap.get(`${userId}:${cId}`) ?? null;
    const isGraded = Math.random() < 0.60;
    const grade    = isGraded ? rand(60, 100) : null;
    const gradedAt = isGraded ? faker.date.past({ years: 1 }).toISOString() : null;
    rows.push({
      assignment: pair.assignId, user: userId, enrollment: enrollId,
      status: isGraded ? "graded" : "submitted",
      submitted_at: faker.date.past({ years: 1 }).toISOString(),
      text_response: faker.lorem.paragraphs(3),
      grade, grader_feedback: isGraded ? faker.lorem.paragraph() : null,
      graded_at: gradedAt, is_late: Math.random() < 0.10, attempt_number: 1,
    });
  }
  await batchCreate("submissions", rows);
  console.log(`  ${st("submissions").created} submissions`);
}

// ── User badges ────────────────────────────────────────────────────────────────
async function seedUserBadges(
  userMap: Map<string, string>,
  badgeMap: Map<string, string>,
): Promise<void> {
  console.log("\n🎖   Seeding user_badges…");
  const learnerIds = [...userMap.values()].slice(2 + 6);
  const badgeIds   = [...badgeMap.values()];
  const rows: any[] = [];
  const used = new Set<string>();

  for (let i = 0; i < 40; i++) {
    const uid = pick(learnerIds);
    const bid = pick(badgeIds);
    if (used.has(`${uid}:${bid}`)) continue;
    used.add(`${uid}:${bid}`);
    rows.push({
      user: uid, badge: bid,
      awarded_at: faker.date.past({ years: 1 }).toISOString(),
      awarded_context: faker.helpers.arrayElement([
        "for completing a course", "for 7-day streak", "for first enrollment",
        "for perfect quiz score", "manually awarded by admin",
      ]),
    });
  }
  await batchCreate("user_badges", rows);
  console.log(`  ${st("user_badges").created} user badges`);
}

// ── Reviews ────────────────────────────────────────────────────────────────────
async function seedReviews(
  enrollMap: Map<string, string>,
  courseMap: Map<string, string>,
  coursePlan: PlannedCourse[],
  userMap: Map<string, string>,
): Promise<void> {
  console.log("\n⭐  Seeding reviews…");
  const rows: any[] = [];
  const published = coursePlan.filter(c => c.status === "Published");
  const learnerEmails = [...userMap.keys()].filter(e => e.endsWith("@example.com") && !e.startsWith("admin") && !["sarah","marcus","emma","james","olivia","alex"].some(n => e.startsWith(n)));
  const used = new Set<string>();

  for (let i = 0; i < 100; i++) {
    const c = pick(published);
    const cId = courseMap.get(c.key);
    const email = pick(learnerEmails);
    const uid   = userMap.get(email);
    if (!cId || !uid) continue;
    const key = `${uid}:${cId}`;
    if (used.has(key)) continue;

    // Only review if enrollment progress >= 50
    const enrollId = enrollMap.get(key);
    if (!enrollId) continue; // not enrolled

    used.add(key);

    // Skew ratings 3.5–5.0 with some low
    const ratingRoll = Math.random();
    const rating = ratingRoll < 0.05 ? 1
                 : ratingRoll < 0.10 ? 2
                 : ratingRoll < 0.20 ? 3
                 : ratingRoll < 0.55 ? 4
                 : 5;

    rows.push({
      course: cId, user: uid, enrollment: enrollId, rating,
      title: faker.helpers.arrayElement([
        "Excellent course!", "Very practical", "Highly recommend", "Great instructor",
        "Could be better", "Changed my career", "Worth every penny", "Solid foundations",
        "Needs more examples", "Best course on the topic",
      ]),
      body: faker.lorem.paragraphs(rand(1, 3), "\n\n"),
      is_approved: Math.random() < 0.92,
      helpful_count: rand(0, 50),
    });
  }
  await batchCreate("reviews", rows);
  console.log(`  ${st("reviews").created} reviews`);
}

// ── Announcements ──────────────────────────────────────────────────────────────
async function seedAnnouncements(
  userMap: Map<string, string>,
  courseMap: Map<string, string>,
  coursePlan: PlannedCourse[],
): Promise<void> {
  console.log("\n📢  Seeding announcements…");
  const instructorEmails = ["sarah.chen","marcus.thompson","emma.rodriguez","james.wilson","olivia.park","alex.kim"].map(e => `${e}@example.com`);
  const published = coursePlan.filter(c => c.status === "Published");
  const rows: any[] = [];

  // 5 site-wide
  for (let i = 0; i < 5; i++) {
    const author = userMap.get(pick(instructorEmails)) ?? [...userMap.values()][0];
    rows.push({
      course: null, author,
      title: pick(["Platform Maintenance Scheduled", "New Courses Added This Month",
                   "Holiday Learning Challenge", "System Update Complete", "New Feature: Offline Mode"]),
      body: faker.lorem.paragraphs(2, "\n\n"),
      is_pinned: Math.random() < 0.4,
      published_at: faker.date.past({ years: 1 }).toISOString(),
    });
  }
  // 10 course-specific
  for (let i = 0; i < 10; i++) {
    const c = pick(published);
    const cId = courseMap.get(c.key);
    const instructorId = userMap.get(c.instructorEmail);
    if (!cId || !instructorId) continue;
    rows.push({
      course: cId, author: instructorId,
      title: pick(["New lesson added", "Live Q&A session this Friday",
                   "Updated curriculum for 2025", "Bonus resource added",
                   "Important update to Module 3", "Community challenge: share your project"]),
      body: faker.lorem.paragraphs(2, "\n\n"),
      is_pinned: Math.random() < 0.3,
      published_at: faker.date.past({ years: 1 }).toISOString(),
    });
  }
  await batchCreate("announcements", rows);
  console.log(`  ${st("announcements").created} announcements`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log("🌱  LMS Seed Script starting…");
  console.log(`    URL:   ${BASE}`);
  console.log(`    Token: ${TOKEN.slice(0, 8)}…`);
  console.log(`    Faker seed: 1337 (reproducible)\n`);

  // ── Disable flows that would interfere or slow seeding ────────────────────
  const FLOWS_TO_SUSPEND = [
    "[LMS] Normalize Video Source",               // external oEmbed HTTP calls per lesson
    "[LMS] Recompute Enrollment Progress",        // fires per lesson_progress create (slow)
    "[LMS] Review Gating",                        // may block reviews with low progress
    "[LMS] Default Enrollment Fields",            // we set defaults directly
    "[LMS] Normalize User Email",                 // filter hook; fails on /users endpoint
    "[LMS] Welcome on Enrollment",                // would create 200 notifications (slow)
    "[LMS] Submission: Compute is_late + attempt_number", // filter hook may block inserts
    "[LMS] Certificate Template: Enforce Single Default", // filter hook; blocks template creates
    "[LMS] Free Preview Validation",              // filter hook; fires on every lesson create
    "[LMS] Prevent Duplicate Enrollments",        // filter hook; may interfere (if exists)
  ];
  console.log("⚙   Suspending flows during seed…");
  for (const name of FLOWS_TO_SUSPEND) await setFlowStatus(name, "inactive");

  // ── Reference data ────────────────────────────────────────────────────────
  const roles   = await lookupRoles();
  const catMap  = await seedCategories();
  const tagMap  = await seedTags();

  const { map: userMap, passwords } = await seedUsers(roles);

  const certIds    = await seedCertTemplates();
  const badgeMap   = await seedBadges(catMap);
  const coverIds   = await seedCoverImages();

  // ── Course content ────────────────────────────────────────────────────────
  const {
    courseMap, moduleMap, lessonIds, lessonsByModule,
    coursePlan, quizByCourse, assignByCourse,
  } = await seedCourseContent(catMap, tagMap, userMap, coverIds);

  await seedQuizQuestions([...quizByCourse.values()]);

  // ── Activity ──────────────────────────────────────────────────────────────
  const { enrollMap, completedEnrolls } = await seedEnrollments(userMap, courseMap, coursePlan);
  await seedLessonProgress(enrollMap, lessonsByModule, moduleMap, coursePlan, courseMap);

  // Ensure Modern Certificate is the active default (flow was suspended during create)
  const defaultTmpl = certIds[certIds.length - 1] ?? null; // "Modern Certificate" = last
  if (defaultTmpl) {
    console.log("\n🏅  Setting Modern Certificate as is_default…");
    await PATCH(`/items/certificate_templates/${defaultTmpl}`, { is_default: true }).catch(() => {});
    // Clear is_default on the others
    for (const id of certIds.slice(0, -1)) {
      await PATCH(`/items/certificate_templates/${id}`, { is_default: false }).catch(() => {});
    }
  }

  // Restore Issue Certificate flow before completing enrollments so it auto-issues certs
  console.log("\n⚙   Re-enabling Issue Certificate flow…");
  await setFlowStatus("[LMS] Issue Certificate on Completion", "active");

  await completeEnrollments(completedEnrolls, userMap, defaultTmpl);

  await seedQuizAttempts(enrollMap, quizByCourse, coursePlan, courseMap, userMap);
  await seedSubmissions(enrollMap, assignByCourse, courseMap, userMap);
  await seedUserBadges(userMap, badgeMap);
  await seedReviews(enrollMap, courseMap, coursePlan, userMap);
  await seedAnnouncements(userMap, courseMap, coursePlan);

  // ── Re-enable all flows ───────────────────────────────────────────────────
  console.log("\n⚙   Re-enabling all flows…");
  for (const name of FLOWS_TO_SUSPEND) await setFlowStatus(name, "active");

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(60));
  console.log("✅  SEED COMPLETE\n");
  console.log("Collection Stats:");
  console.table(
    Object.fromEntries(
      Object.entries(STATS).map(([k, v]) => [k, v])
    )
  );

  // Failure threshold: >5% errors in any collection
  const failed = Object.entries(STATS).filter(([, v]) => {
    const total = v.created + v.errors;
    return total > 0 && v.errors / total > 0.05;
  });
  if (failed.length) {
    console.error("\n⛔  Collections exceeded 5% error threshold:");
    failed.forEach(([k, v]) => console.error(`  ${k}: ${v.errors} errors / ${v.created + v.errors} total`));
    process.exit(1);
  }

  console.log("\n🔑  Generated Passwords (log this securely):");
  console.log("─".repeat(55));
  passwords.forEach(p => console.log("  " + p));
  console.log("─".repeat(55));
  console.log("\n🏁  Done.\n");
}

main().catch(err => {
  console.error("\n💥  Fatal error:", err);
  process.exit(1);
});
