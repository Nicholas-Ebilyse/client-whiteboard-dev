# Project Hand-off Document: Ebilyse Planning Tool (`client-whiteboard-dev`)

## 1. Project Overview
The **Ebilyse Planning Tool** is a centralized coordination platform designed to manage technical teams, project assignments, and resource availability for Ebilyse-Levage-VGP. It serves as the single source of truth for scheduling, bridging the gap between field operations (recorded in Google Sheets) and real-time coordination (visualized in the web app).

### Primary Objectives:
- **Visual Planning**: A drag-and-drop grid interface for assigning teams to projects (`commandes`).
- **Data Synchronization**: Bi-directional integration with Google Sheets and one-way automated synchronization with Google Calendar.
- **Resource Management**: Tracking technician skills, vehicle status, and equipment availability.
- **Absence Tracking**: Centralized management of technician downtime (holidays, sickness, etc.).

---

## 2. Technology Stack

### Frontend:
- **Framework**: [React 18](https://reactjs.org/) with [Vite](https://vitejs.dev/).
- **Language**: [TypeScript](https://www.typescriptlang.org/).
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) + [Shadcn UI](https://ui.shadcn.com/) (Radix UI primitives).
- **State Management & Data Fetching**: [TanStack Query v5](https://tanstack.com/query/latest) (React Query).
- **Routing**: [React Router v6](https://reactrouter.com/).
- **Icons**: [Lucide React](https://lucide.dev/).
- **Utilities**: `date-fns` (Date manipulation), `jspdf`/`html2canvas` (PDF Export).

### Backend / Infrastructure:
- **Platform**: [Supabase](https://supabase.com/).
- **Database**: PostgreSQL with Row-Level Security (RLS) enabled.
- **Server-Side Logic**: Deno-based [Supabase Edge Functions](https://supabase.com/docs/guides/functions).
- **Authentication**: Supabase Auth (Email/Password).
- **File Storage**: Supabase Storage (`commandes_files` bucket).

---

## 3. System Architecture & Core Modules

### 3.1 Data Flow
1. **User Interaction**: Users modify the planning grid (moving assignments, adding notes).
2. **Persistence**: Changes are sent to Supabase via TanStack Query mutations.
3. **Synchronization**: 
   - **Google Sheets**: A manual or scheduled trigger runs the `sync-google-sheets` Edge Function, which performs a "Master Import/Export" to keep the DB and Sheet in sync.
   - **Google Calendar**: The `sync-google-calendar` Edge Function updates a shared Google Calendar to reflect the current state of the planning grid.

### 3.2 Planning Grid Logic (`usePlanning.ts`)
The grid is organized with **Teams on the Y-axis** and **Days (Week View) on the X-axis**. 
- Assignments are rendered within cells.
- Drag-and-drop functionality (`useDragAndDropAssignment`) handles moving tasks between teams or dates, with validation logic (`useDragValidation`) to prevent conflicts.

---

## 4. Database Schema (Key Tables)

| Table | Description | Key Columns |
| :--- | :--- | :--- |
| `commandes` | The core "Project" or "Work Order" | `client`, `chantier`, `attachments` (file array) |
| `assignments` | Mapping of a Project to a Team/Date | `commande_id`, `team_id`, `start_date`, `end_date`, `is_confirmed` |
| `teams` | Groups of technicians | `name`, `technician_ids` |
| `technicians` | Individual employees | `name`, `skills`, `detailed_skills` (JSON matrix) |
| `absences` | Technician downtime | `technician_id`, `motive_id`, `start_date`, `end_date` |
| `notes` | Reminders linked to a specific team day | `team_id`, `start_date`, `text`, `weather_condition` |
| `vehicles`, `equipment` | Shared resources | `name`, `reference`, `status` |
| `absence_motives` | Formalized categories for downtime | `id`, `name` |
| `skill_dictionary` | Definitions of trackable skills | `id`, `category`, `name` |

---

## 5. Specialized Features

### 5.1 Skill Matrix & Dictionary
A dedicated subsystem manages the mapping of **Technician Competencies**:
- **Skill Dictionary**: A central registry of all technical skills (e.g., "Moteur Electrique", "Soudure").
- **Detailed Skills Matrix**: A technician-specific JSON field (`detailed_skills`) that tracks proficiency levels (`Oui`, `Partiel`, `Non`) against the dictionary.
- **Sync Integration**: The skill matrix is fully synchronized with a specific Google Sheets tab ("Matrice Compétences"), allowing HR/Managers to update skills in bulk outside the app.

### 5.2 Realtime Command Center
The application leverages Supabase Realtime for instant coordination:
- **Presentation Mode**: Allows admins to halt countdowns or change views on all connected "Presentation Mode" dashboards simultaneously via Broadcast channels.
- **Status Sync**: Indicators for sync progress and database integrity are updated in realtime.

---

## 5. External Integrations & Edge Functions

### 5.1 Google Calendar Sync (`sync-google-calendar`)
- **Mechanism**: One-way sync from Supabase to Google Calendar.
- **Conflict Handling**: It compares DB records with Calendar events (filtered by `source: lovable-planning`) and performs atomic Create/Update/Delete operations.
- **Grouping**: Assignments for the same project on the same day are grouped into a single calendar event with detailed descriptions (participants, comments, location).

### 5.2 Google Sheets Master Sync (`sync-google-sheets`)
- **Type**: Complex bidirectional synchronization logic.
- **Mapping**: Uses internal UUIDs (stashed in the Sheets' "ID" columns) to maintain entity integrity across renames or moves.
- **Scope**: Syncs nearly all entities (Technicians, SAV, Commandes, Assignments, Absences, Notes, Motives, Vehicles, Equipment).

### 5.3 Other Functions
- `send-schedule-email`: Generates and emails the weekly schedule PDF.
- `sync-orchestrator`: Management function to coordinate multiple sync tasks.
- `manage-user` / `suspend-user`: Admin-level user management utilities.

---

## 6. Recent Strategic Evolutions (Technical Debt Resolved)

1. **Shift to Team-Based Planning**: Transitioned from assigning individual technicians to assigning **Teams**. Individual availability is now managed purely through the `absences` table, simplifying the grid view.
2. **Structured Absence Motives**: Replaced raw text reason fields with a foreign-key-backed `motive_id` system to allow for better reporting and filtering.
3. **Bidirectional File Support**: Integrated Supabase Storage for project attachments. `commandes` now support up to 3 associated files (PDFs, images) for field reference.
4. **Cleaned Domain Model**: Removed legacy flags like `is_sav` and `display_below` from the `notes` table to focus on core coordination data.
5. **PDF Export Refactoring**: Updated the PDF generation engine to mirror the Team-based grid view (X: Days, Y: Teams), ensuring consistency between the UI and printed reports.

---

## 7. Operational Notes for Google Gemini Code Partner

### Key Configuration Points:
- **Environment Variables**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GOOGLE_SERVICE_ACCOUNT_KEY_V2`.
- **Global Settings**: Stored in the `global_settings` table (e.g., `google_calendar_id`, `google_spreadsheet_id`).

### Current Technical Debt / Focus Areas:
- **Sync Latency**: Large sheet syncs can take several seconds; optimizations to batch processing may be needed.
- **Error Visibility**: Sync errors are logged to the `sync_status` table but could be more prominently surfaced in the UI.
- **Real-time Collaboration**: While the app uses Supabase for data, some grid updates may require manual refresh if Broadcast channels aren't fully utilized for all entity changes.

---
*Document Generated: 2026-04-06*
