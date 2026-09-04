# DNA Professional Investigation Agency - Agent Instructions

## Welcome, AI Agent!
This document provides crucial context about the **DNA Professional Investigation Agency - Payment Management** system. It is a full-stack vanilla JS + HTML + CSS web application backed by Supabase.

**Read this file before making any architectural or structural changes.**

## Tech Stack
*   **Frontend**: Pure HTML (`index.html`), Vanilla JS (`app.js`), and custom CSS (`dna-command-center.css`). 
    *   *No React, No Vue, No build steps required for frontend files.*
    *   *Styling*: Custom CSS variables, premium dashboard layer (glassmorphism/3D tiles on Dashboard, flat UI for tables).
*   **Backend / DB**: Supabase (PostgreSQL).
    *   Supabase JS Client is loaded via CDN in `index.html`.
    *   Real-time subscriptions are used for live updates.
*   **PDF Generation**: `html2pdf.js` is used extensively for generating slips and reports.
    *   *Important PDF Quirk*: To prevent logo disappearance, the logo needs time to render. Modern CSS functions (oklch, oklab) can crash html2canvas, so they are sanitized before PDF generation.
*   **Server**: A lightweight Express Node server (`server.js`) runs in development/production but mainly serves the static files.

## Database Schema (Supabase)
The app heavily relies on these Supabase tables:

1.  **`cases`**: The core table.
    *   Fields: `id`, `created_at`, `doc_code`, `date`, `case_type`, `claim_no`, `insured_name`, `hospital_name`, `company`, `inv1`, `inv2`, `inv1_fee`, `inv2_fee`, `inv1_ta`, `inv2_ta`, `inv1_status`, `inv2_status`, `inv1_hardcopy`, `inv2_hardcopy`, `exception_type`, `outcome`, `investigation_status`.
2.  **`investigators`**: Represents staff.
    *   Fields: `id`, `name`, `phone`, `payment_type` (Per Case / Salary), `payment_type_changed_at`, `removed`.
3.  **`agency_settings`**: Global settings.
    *   Fields: `id` (always 1), `agency_name`, `agency_address`, `logo` (Base64 URL), `field_permissions`.
4.  **`investigator_expenses`**: Vouchers and bonuses.
    *   Fields: `id`, `investigator_name`, `date`, `title`, `amount`, `category`, `status`, `month_year` (e.g., '2026-07').
5.  **`activity_log`** & **`investigator_audit_log`**: Track system history.
6.  **`case_ownership_transfers`**: Tracking assignment changes.

## File Structure Map
*   **`index.html`**: The entire UI layout. It uses a tabbed SPA approach (`#view-dashboard`, `#view-cases`, etc.) navigated via JavaScript (`showView`).
*   **`app.js`**: Massive monolithic JS file handling state, Supabase CRUD, DOM manipulation, PDF template generation, and business logic.
*   **`dna-command-center.css`**: Core premium CSS. Handles dark mode and mobile responsiveness. Sidebar width is carefully tuned here.
*   **`server.js`**: Serves static files.

## Important Business Logic Guidelines
1.  **"DO NOT CHANGE" Rule**: If the user says "DO NOT CHANGE" or "Undo", immediately revert to the exact previous logic without questioning. They rely heavily on precise visual outputs and workflows.
2.  **Versioning cache**: Whenever editing `app.js` or `dna-command-center.css`, you MUST bump the `?v=` version string in `index.html` (e.g., `<script src="app.js?v=20"></script>`) to bust the browser cache, otherwise the user won't see your changes.
3.  **Bulk Payment System**: Allows marking multiple cases as "Paid" in one go. Be careful with DOM structures here (e.g. `Company` vs `Doc Code` columns in the table).
4.  **Logo in PDFs**: Because `html2pdf.js` uses `html2canvas`, images (like the logo) sometimes fail to render if not loaded. Do not apply hidden DOM rendering unless explicitly requested, as the user previously asked to revert this due to speed concerns.
5.  **Salaried vs Per-Case Investigators**: Cases calculate fees differently depending on the `payment_type` of the investigator assigned and the `payment_type_changed_at` date.
6.  **Sidebar Layout**: The sidebar was recently narrowed to 165px width to give data tables more room. Do not widen it back.

## UI/UX Rules
*   Do NOT add unsolicited animations or features.
*   Keep data tables dense and readable. Use `mono` fonts for Doc Codes and Claim Numbers.
*   Respect the Dark Mode token system (`var(--card)`, `var(--navy)`, etc.).

## How to execute tasks
*   Use `sed` or `cat << 'EOF' > patch.js` to modify `app.js` safely.
*   Always test small patches before modifying large chunks of HTML.
