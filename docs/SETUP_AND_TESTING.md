# Naafay Dar-ul-Ifta Management System — Setup & Testing Guide

## 1. Architecture Overview
This unified application integrates all three modules of **Naafay Dar-ul-Ifta & Takhassus fil Fiqh** on one shared database, authentication system, user profiles, and role permissions:
- **Part 1 — Academic Management System**: Student profiles (`ST-0001`), mandatory 3-session attendance, Daily Mutala, Teacher Lessons, Examinations, Research Archive, and Reports.
- **Part 2 — Dar-ul-Ifta Management System**: Internal question registration (`FAT-2026-0001`), multi-researcher assignment, classical book reference library, Urdu/Arabic RTL draft editor with autosave & version snapshots, Senior Mufti review, and Nazim Dar-ul-Ifta (**Mufti Waris Naseeb**) final approval (`NA-FATWA-2026-0001`) + optional Public Portal publication.
- **Part 3 — Public Online Fatwa Portal**: Unauthenticated public homepage (`/`), online question submission (`/ask`), two-factor question tracking (`/track`), searchable published Fatawa library (`/fatwas`, `/category/:code`), individual SEO Fatwa pages (`/fatwa/:identifier`), dynamic `/robots.txt`, and dynamic `/sitemap.xml`.

- **Primary Language**: Urdu (`dir="rtl"`, `Jameel Noori Nastaleeq` / `Noto Nastaliq Urdu`)
- **Arabic Support**: Classical Fiqhi quotations (`dir="rtl"`, `Amiri`)
- **Secondary Language**: English (`dir="ltr"`, `Poppins`)
- **Runtime Database**:
  - **Local / AI Studio Preview**: Persistent SQLite database (`naafay_academic.db`) via Express (`server.ts`) implementing all 45 relational tables (31 Academic + 11 Dar-ul-Ifta + 3 Public Portal), foreign keys, unique constraints, rate limiting, and server-side RBAC checks.
  - **Production Supabase Mode**: Connects directly to your shared Supabase PostgreSQL, Auth, and Storage project when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are configured.

## 2. Environment Variables
Copy `.env.example` to `.env`:

```env
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_ANON_KEY="your-supabase-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"
PORT=3000
```

## 3. Supabase Database & RLS Setup
1. Open your Supabase project **SQL Editor**.
2. Execute the migrations in order:
   - `supabase/migrations/001_academic_schema.sql` (Part 1: 31 academic tables, `ST-0001` / `TCH-0001` auto-generators, unique 3-session attendance constraint).
   - `supabase/migrations/002_rls_policies.sql` (Part 1 RLS + private `academic-documents` bucket).
   - `supabase/migrations/003_seed_data.sql` (Part 1 seed data: roles, 3 attendance sessions, academic years, classes, subjects, books).
   - `supabase/migrations/004_darul_ifta_schema.sql` (Part 2: 11 `fatwa_*` tables reusing `profiles` & `roles`, `FAT-YYYY-0001` / `NA-FATWA-YYYY-0001` generators).
   - `supabase/migrations/005_darul_ifta_rls.sql` (Part 2 RLS protecting draft privacy, questioner identity, Senior Mufti & Nazim approval gates, and Public Portal opt-in).
   - `supabase/migrations/006_darul_ifta_seed.sql` (Part 2 seed data: 13 configurable Fiqh categories and sample Fatwa workflow items).
   - `supabase/migrations/007_public_portal_schema.sql` (Part 3: `portal_settings`, `public_tracking_tokens`, `public_submissions`, and `track_public_fatwa_question()` RPC).
   - `supabase/migrations/008_public_portal_rls.sql` (Part 3 RLS: strict locking of tracking tokens/PII, published-only public Fatawa reads, and private `public-question-uploads` bucket).
   - `supabase/migrations/009_public_portal_seed.sql` (Part 3 seed data: Nazim **Mufti Waris Naseeb**, announcements, contact details).

## 4. Running Locally
```bash
npm install
npm run dev
```
The server starts on `http://localhost:3000` (Express API + Vite frontend).
- Default `/` opens the **Public Online Fatwa Portal**.
- Click **Staff Portal** (`/staff`) to enter the internal **Dar-ul-Ifta & Academic Management System**.

## 5. Testing Checklist
1. **Public Portal Without Login (Part 3)**:
   - Visit `/ask`, fill out all required fields + consent checkbox, optionally attach a PDF/JPG/PNG/WEBP file (<= 5 MB), and submit.
   - Verify a `TRK-2026-XXXX` tracking number and 6-character verification code are returned.
   - Open `/staff` -> **Fatwa Questions** (`FAT-2026-XXXX`): confirm the submitted question immediately appears as unassigned (`registered` / `internal_only`).
2. **Two-Factor Question Tracking (`/track`)**:
   - Test with sample tracking number `TRK-2026-0001` and either verification code `NF2026` or mobile `+92-300-5128834`.
   - Verify wrong 2nd factor fails (`404`) and successful lookup displays only one of the 5 safe public stages (`Received`, `Under review`, `Research in progress`, `Answer preparation`, `Completed`) with zero internal research notes, drafts, or PII.
3. **Published Library, Detail View & Publication Toggle**:
   - Browse `/fatwas` and `/category/:code`; open `/fatwa/:identifier` and test **Print / PDF** and **Copy Link**.
   - Confirm questioner name, phone, and email are never exposed publicly.
   - In `/staff`, publish or unpublish a Fatwa and confirm `/api/public/fatwas/:id` and `/sitemap.xml` update immediately (`404` when unpublished).
4. **SEO & Crawling**:
   - Inspect `/robots.txt` (`Allow: /fatwa/`, `Disallow: /track`, `Disallow: /staff`, `Disallow: /api/`) and `/sitemap.xml` (lists active categories and explicitly published Fatawa only).
   - Verify `<title>`, `<meta name="description">`, `<link rel="canonical">`, `noindex` on `/track` & `/staff`, and `QAPage` JSON-LD on `/fatwa/:identifier`.
5. **Internal Dar-ul-Ifta & Academic Workflows (Parts 1 & 2)**:
   - Verify role permissions across Nazim (**Mufti Waris Naseeb**), Senior Mufti, Mufti, Office Staff, and Student/Researcher.
   - Verify Student profiles (`ST-0001`), 3-session attendance duplicate guard & audit log, Mutala vs. Lessons, Exams, Research, and 7 Excel/PDF reports.

