---

# SBI Planning — Complete Project Handoff Document

## 1\. Overview

**SBI Planning** is a weekly technician scheduling application for a French construction/maintenance company (SBI). It manages technician assignments to job sites (chantiers/commandes), tracks SAV (after-sales service) tickets, and synchronizes data bidirectionally with Google Sheets and one-way to Google Calendar.

**Live URL**: `https://sbi-planning.lovable.app` **Lovable project**: `60b64f0a-c562-4961-977c-c120bcf9c7cd`

---

## 2\. Tech Stack

### Frontend

- **React 18** \+ **TypeScript** \+ **Vite 5** (SWC plugin)  
- **Tailwind CSS 3** with semantic HSL design tokens (Material Design 3 inspired)  
- **shadcn/ui** (Radix UI primitives) — full component library  
- **TanStack React Query v5** — all server state management  
- **react-router-dom v6** — routing (lazy-loaded pages)  
- **date-fns v4** with `fr` locale — all date manipulation  
- **sonner** — toast notifications  
- **lucide-react** — icons  
- **jspdf \+ jspdf-autotable** — PDF generation for schedule export  
- **html2canvas** — screenshot capture for email  
- **zod** — schema validation (edge functions)  
- **recharts** — charts (admin dashboard)

### Backend (Lovable Cloud / Supabase)

- **Supabase Auth** — email/password authentication with email verification  
- **Supabase PostgreSQL** — 10 tables (see schema below)  
- **Supabase Edge Functions (Deno)** — 13 functions  
- **Google Service Account** — for Sheets API \+ Calendar API (secret: `GOOGLE_SERVICE_ACCOUNT_KEY`)  
- **Resend** — transactional email (secret: `RESEND_API_KEY`)

---

## 3\. Database Schema (10 tables)

| Table | Purpose |
| :---- | :---- |
| `week_config` | Stores current displayed week (week\_number, year, is\_current) |
| `technicians` | Teams/technicians with name, position (ordering), is\_temp, is\_archived, color, members |
| `assignments` | Core scheduling data: technician\_id → date/period slots, linked to commande\_id or chantier\_id |
| `commandes` | Job orders synced from Google Sheets (client, chantier, montant\_ht, achats, facture, is\_invoiced) |
| `invoices` | Legacy chantier reference table (name, color, margin) |
| `notes` | Free-text notes per technician/date/period, with multi-day span, SAV flag, invoiced/confirmed status |
| `sav` | After-sales service tickets synced from Google Sheets (numero, nom\_client, adresse, probleme, est\_resolu) |
| `user_roles` | RBAC: user\_id \+ role (admin/user) \+ suspension fields |
| `audit_logs` | Admin action audit trail |
| `app_settings` | Key-value settings (e.g. `max_assignments_per_period` defaults to 3\) |
| `sync_status` | Tracks Google sync operations (type, status, timestamps, error details) |

### Key relationships:

- `assignments.technician_id` → `technicians.id`  
- `assignments.second_technician_id` → `technicians.id` (optional 2nd tech)  
- `assignments.commande_id` → `commandes.id`  
- `assignments.chantier_id` → `invoices.id`  
- `notes.technician_id` → `technicians.id`  
- `notes.chantier_id` → `invoices.id`  
- `assignments.assignment_group_id` — groups multi-day assignments for batch operations

---

## 4\. Core Application Logic

### 4.1 Weekly Planning Grid (Index.tsx — \~2000 lines, needs refactoring)

- Displays a **Monday–Friday grid** with rows per technician, columns per day, split into **Matin** (morning) and **Après-midi** (afternoon) periods  
- Each cell shows assignments (colored by status) and notes  
- **Drag & drop** assignments between cells (`useDragAndDropAssignment.ts` — \~1000 lines, also needs refactoring)  
- **Drag & drop** notes between cells (`useDragAndDropNote.ts`)  
- **Multi-day assignments**: when an assignment spans multiple days, editing/deleting one prompts to update all related (via `assignment_group_id`)  
- **Duplicate assignment**: copies to same technician, next available slot  
- **Context menus** on assignments and notes for edit/delete/duplicate  
- **Undo** support for drag operations  
- **Max assignments per period**: configurable via `app_settings`, defaults to 3

### 4.2 Assignment Status & Colors

Three states with distinct colors (defined as CSS tokens):

- **Unconfirmed** (grey): `--assignment-unconfirmed: 220 14% 70%`  
- **Confirmed** (blue): `--assignment-confirmed: 215 85% 85%`  
- **Invoiced** (red): `--assignment-invoiced: 0 85% 80%`  
- **Absent** (pink): `--absent-pink: 330 85% 85%`

### 4.3 Week Navigation

- ISO week system (weekStartsOn: 1 \= Monday)  
- `getWeekDates()` calculates dates from ISO week number \+ year using Jan 4th anchor  
- Week config stored server-side so all users see same week  
- `WeekSelector` component \+ `WeekNavigationDialog` for jumping to specific weeks

### 4.4 Technician Management

- CRUD with position-based ordering  
- Archive/unarchive (soft delete via `is_archived`)  
- Temporary technicians (`is_temp` flag)  
- Reorderable via position updates

---

## 5\. Edge Functions (13 total)

### 5.1 Google Sheets Sync (`sync-google-sheets`)

- **Direction**: Google Sheets → Database (one-way import)  
- **Source**: Spreadsheet `1hTdAy4pmhJQC6L7SJtRz_S2eQF_Lff4_7coUwouvDGI`  
- **Worksheets synced**: "Commandes" and "SAV"  
- **Auth**: Requires admin role, JWT verification  
- **Upsert**: Uses `external_id` \+ `onConflict` for idempotent sync  
- **Date parsing**: Handles DD/MM/YYYY → YYYY-MM-DD conversion

### 5.2 Google Sheets Writeback (`update-google-sheets-invoice-status`, `update-google-sheets-sav-status`)

- **Direction**: Database → Google Sheets (writeback on status change)  
- When user marks commande as invoiced or SAV as resolved, writes back to the Sheet

### 5.3 Webhook Sync (`webhook-sync-google-sheets`)

- Same as sync-google-sheets but triggered via webhook with API key auth (`WEBHOOK_API_KEY`)

### 5.4 Google Calendar Sync (`sync-google-calendar`) — **751 lines**

- **Direction**: Database → Google Calendar (one-way, full clear-then-recreate)  
- **Calendar ID**: `c_00cb5c8c72116a6489337976fa1797262007bc7e35b124a0136e75a0005dc77c@group.calendar.google.com`  
- **Scope**: Current week to 5 weeks ahead only (prevents timeout)  
- **Process**:  
  1. Delete ALL existing events tagged `source=lovable-planning` (paginated, batches of 20, 300ms delay)  
  2. Fetch assignments \+ notes from DB for date range  
  3. **Group assignments** by commande\_id \+ date \+ period to consolidate multiple technicians into one event  
  4. Create events in batches of 10 with 500ms delay  
- **Event timing**: Matin \= 08:00-12:00, Après-midi \= 14:00-17:00, timezone `Europe/Paris`  
- **Color coding**: Graphite=absent, Red=invoiced, Green=confirmed, Yellow=unconfirmed, Blue=notes, Pink=SAV  
- **French holidays**: Hardcoded set for 2024-2026 (skipped during sync)  
- **clearOnly mode**: Wipes calendar without recreating events  
- **Debounced auto-sync**: 30-second debounce after any assignment/note mutation (`useGoogleCalendarSync.ts`)

### 5.5 Email (`send-schedule-email`)

- Sends weekly schedule as PDF attachment via Resend  
- Input validated with Zod schema  
- PDF data sent as base64

### 5.6 User Management (`create-user`, `grant-admin-role`, `revoke-admin-role`, `suspend-user`, `unsuspend-user`, `list-users`)

- All admin-only, use service role key  
- Suspension: sets `is_suspended` on `user_roles`, real-time listener auto-signs out suspended users

### 5.7 Error Notifications (`send-sync-error-notification`)

- Sends email notification when sync fails

---

## 6\. Authentication & Authorization

- **Email/password auth** with email verification required (no auto-confirm)  
- **Roles**: `admin` | `user` (stored in `user_roles` table, NOT on profile)  
- **RLS**: All tables have Row Level Security enabled  
- **`has_role()` / `is_admin()`**: SECURITY DEFINER functions to check roles without RLS recursion  
- **Suspension**: Real-time Postgres channel on `user_roles` table detects suspension changes and auto-signs out  
- **Session management**: `useSessionManager` hook handles token refresh and expiry warnings (`SessionExpiryWarning` component)  
- **Admin dashboard**: `/admin` route — user management, sync triggers, app settings, DB export

---

## 7\. Naming Conventions & Gotchas

### Naming

- **Database columns**: snake\_case (`start_date`, `technician_id`, `is_confirmed`)  
- **TypeScript interfaces**: camelCase (`startDate`, `technicianId`) in `types/planning.ts`, but **hooks use DB column names directly** (snake\_case) since they pass raw Supabase responses  
- **Edge functions**: kebab-case directories (`sync-google-calendar`, `send-schedule-email`)  
- **Components**: PascalCase files and exports  
- **CSS tokens**: kebab-case with semantic prefixes (`--assignment-confirmed`, `--note-confirmed`)

### Gotchas Solved

1. **ISO Week calculation**: Uses `startOfWeek(jan4, { weekStartsOn: 1 })` as anchor — the Jan 4th method for ISO weeks. This is in `getWeekDates()`.  
2. **Google Calendar duplicate events**: Previous bug caused hundreds of duplicates. Fixed with mandatory pagination (`nextPageToken`) during deletion and `source=lovable-planning` extended property tagging.  
3. **Edge function timeouts**: Calendar sync was timing out processing entire DB. Fixed by limiting sync to current week \+ 5 weeks ahead, and using parallel batches (10 creates, 20 deletes).  
4. **CORS on Edge Functions**: Supabase client sends extra headers (`x-supabase-client-platform`, etc.) that must be whitelisted in `Access-Control-Allow-Headers`.  
5. **Auth state deadlock**: `onAuthStateChange` callback must defer Supabase calls with `setTimeout(fn, 0)` to prevent deadlock.  
6. **RLS recursion**: Role checks use `SECURITY DEFINER` functions to bypass RLS on `user_roles` table.  
7. **Multi-day assignment edits**: Uses `assignment_group_id` UUID to link related assignments; hooks `useUpdateRelatedAssignments` and `useDeleteRelatedAssignments` handle batch operations.  
8. **SAV visibility logic**: Resolved SAV tickets only show on the week they were resolved (`resolved_week_start >= weekStart`), not on all subsequent weeks.  
9. **Technician email convention**: Calendar sync converts technician names to email format: `"Jean Pierre"` → `jean.pierre@sbi25.eu` (included in event description, not as attendees due to no Domain-Wide Delegation).  
10. **Supabase 1000-row limit**: Default query limit; relevant when debugging missing data.  
11. **Never edit auto-generated files**: `client.ts`, `types.ts`, `.env`, `config.toml` are managed by Lovable Cloud.

---

## 8\. File Structure Highlights

| File | Lines | Notes |
| :---- | :---- | :---- |
| `src/pages/Index.tsx` | \~2000 | Main planning grid — **needs refactoring** |
| `src/hooks/useDragAndDropAssignment.ts` | \~1000 | Complex D\&D logic — **needs refactoring** |
| `src/hooks/usePlanning.ts` | 339 | All CRUD hooks for core entities |
| `supabase/functions/sync-google-calendar/index.ts` | 751 | Full calendar sync logic |
| `supabase/functions/sync-google-sheets/index.ts` | 404 | Sheets import (Commandes \+ SAV) |
| `src/hooks/useAuth.ts` | 107 | Auth state \+ real-time suspension detection |
| `src/hooks/useGoogleCalendarSync.ts` | 60 | 30s debounced sync trigger |

---

## 9\. Secrets Required

| Secret | Purpose |
| :---- | :---- |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Google Sheets \+ Calendar API access |
| `RESEND_API_KEY` | Email sending |
| `WEBHOOK_API_KEY` | Webhook authentication for external sync triggers |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge function admin operations |

---

## 10\. Outstanding Issues

- **Google Calendar sync** was returning Edge Function errors at last test — likely timeout or rate limit issues with large event counts. The clear-then-recreate approach works but is fragile with many events.  
- `Index.tsx` (2000 lines) and `useDragAndDropAssignment.ts` (1000 lines) are overdue for decomposition.  
- French holidays are hardcoded for 2024-2026 only — needs extension or dynamic calculation.

Refactor main planning page Fix Calendar sync errors  
