# DNA Professional Investigation Agency - Payment Management

A comprehensive, full-stack payment and case management system built for the DNA Professional Investigation Agency.

## Overview
This application is a Single Page Application (SPA) designed to manage investigation cases, investigator payouts, agency expenses, and client reporting. It operates entirely in the browser using Vanilla JavaScript and communicates directly with a Supabase PostgreSQL backend.

## Tech Stack
*   **Frontend**: HTML5, Vanilla JavaScript (`app.js`), Custom CSS.
*   **Backend & Database**: Supabase (PostgreSQL, Auth, Realtime).
*   **PDF Engine**: `html2pdf.js` for on-the-fly invoice, report, and slip generation.
*   **Server**: Node.js / Express (`server.js`) for static asset delivery in production.

## Key Features
1.  **Dashboard (Command Center)**: High-level KPI tracking (Profit, Revenue, SLA Engine, Live Operations).
2.  **Case Management**: Create, edit, and track individual investigation cases. Includes bulk actions, quick assignments, and Doc Code auto-formatting.
3.  **Investigator 360**: Manage staff, track per-case vs. salaried payment models, and view performance scorecards.
4.  **Bulk Payments**: Rapidly settle investigator fees/TA across multiple unpaid cases simultaneously.
5.  **Monthly & Yearly Ledgers**: Granular financial breakdowns with Excel/CSV export and PDF payment slip generation.
6.  **Document Repository**: Track related hardcopies and digital files.
7.  **Form Match & Intelligence (BETA)**: Hospital-level risk scoring and intelligent case duplicate detection.
8.  **Settings**: Full customizability over Agency Logo, Name, Address, and Field-Level RBAC (Role-Based Access Control).

## Architecture Details for Developers & AI Agents

### 1. Database Schema (Supabase)
The system relies on several relational tables stored in Supabase:
*   `cases`: Master table for all assignments (`doc_code`, `claim_no`, `insured_name`, fee, TA, status).
*   `investigators`: Staff directory and payment structures (`payment_type`).
*   `investigator_expenses`: Voucher/bonus ledger.
*   `agency_settings`: Singleton table for branding and config (`id: 1`).
*   `activity_log` & `investigator_audit_log`: Audit trails.

### 2. Frontend Structure
*   `index.html`: The monolithic view containing all templates, modals, and tabs.
*   `app.js`: The central logic controller. Contains all Supabase queries, DOM rendering loops, state management, and `html2pdf` configurations.
*   `dna-command-center.css`: Custom CSS variable system supporting light/dark themes and a responsive fixed sidebar (165px width).

### 3. Caching & Versioning
Because this is a vanilla JS application running over a CDN/Static Server, **cache busting is critical**.
When modifying `app.js` or `dna-command-center.css`, the `?v=` query parameter in `index.html` (e.g., `src="app.js?v=19"`) MUST be incremented to ensure browsers download the latest logic.

### 4. PDF Generation Note
The system uses `html2pdf.js`. Due to HTML canvas limitations, Base64 images (like the custom Agency Logo) require nanoseconds to decode. Advanced workarounds (like pre-rendering invisible DOM nodes) were tested but removed to prioritize absolute generation speed.

## Deployment
Simply run `npm start` or deploy the root directory to any standard Node.js hosting (e.g., Google Cloud Run, Vercel, Railway). The `server.js` file handles all routing and statically serves the root folder.
