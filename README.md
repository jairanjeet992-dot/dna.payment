# DNA Payment Management System

A comprehensive operations, financial, and personnel management dashboard tailored for the **DNA Professional Investigation Agency**. This system tracks investigation cases, manages investigator workloads and payouts, handles client billing, and monitors SLA compliance in real-time.

## Current Application State (Full-Stack Architecture)

The application uses a **Full-Stack Architecture** deployed via Node.js:
1. **Node.js/Express Backend**: Serves the application, provides secure API endpoints for Gemini AI integration, manages WebSocket connections for Live Audio, and implements anti-crash/rate-limiting protections.
2. **Supabase (Primary DB)**: Handles core relational data (Cases, Investigators, Users, RLS, Storage) via PostgreSQL.
3. **Firebase (Secondary DB)**: Manages modular integrations like Google Drive API settings and cloud synchronization.
4. **Vanilla JS + CSS Frontend**: High-performance glassmorphism UI interacting dynamically with the backend and Supabase.

---

## 🗄️ Database Table Structure (Supabase PostgreSQL)

The core application runs on Supabase with the following primary tables:
*   **`cases`**: The main ledger. Stores `doc_code`, `company`, `claim_no`, assigned investigators (`inv1`, `inv2`), fees, payments (`total_payable`, `received`), and statuses.
*   **`investigators`**: Master list of investigators. Stores `name`, `phone`, `payment_type` (Per Case / Salary), `salary_amount`, and availability.
*   **`user_roles`**: Links Supabase Authentication IDs (`auth.users`) to application roles (`admin`, `senior`, `junior`, `accounts`, `company`).
*   **`agency_settings`**: Global agency configuration (Name, Address, Logo).
*   **`case_ownership_transfers`**: Audit log of case reassignments between investigators.
*   **`investigator_documents`**: Stores metadata for files uploaded to Supabase Storage.
*   **`investigator_audit_log`**: Tracks administrative changes made to investigator profiles.

---

## 🚀 Backend Connection & Setup Guide

### 1. Supabase Setup (Core Data)
1.  **Create a Supabase Project**: Go to [Supabase](https://supabase.com/) and create a new project.
2.  **Run SQL Migrations**: Open the **SQL Editor** in Supabase and execute the `master_setup.sql` file.
    *   *Note: This master file creates all the tables, configures Row Level Security (RLS), and sets up the necessary triggers and functions in one go.*
    *   *If you need to manually add the ownership transfer table later, you can run `05_ownership_transfer.sql` separately.*
3.  **Connect Frontend**:
    *   Copy `config.example.js` and rename it to `config.js`.
    *   Paste your Supabase **Project URL** and **Anon Key** into `config.js`.

### 2. Firebase Setup (Drive/Settings Integration)
1.  **Configure Credentials**: Open `firebase-applet-config.json` and update it with your Firebase project credentials.
2.  **Initialization**: The app automatically loads Firebase via `firebase-init.js` for modular settings and Drive sync.

### 3. Server Configuration (Environment Variables)
To enable AI features, you must provide a Gemini API key to the backend:
1. Create a `.env` file in the root directory.
2. Add your key: `GEMINI_API_KEY=your_api_key_here`

---

## 🛡️ Security & Anti-Crash Protections

The Node.js server (`server.js`) includes robust production-grade protections:
*   **Payload Bomb Protection**: Strict 2MB limit on incoming JSON payloads to prevent OOM (Out Of Memory) crashes.
*   **API Rate Limiting**: In-memory IP rate limiter restricts API calls to 30 requests per minute to prevent bot spam and API quota exhaustion.
*   **WebSocket Connection Limiting**: Hard limit of 50 active voice connections to preserve server resources.
*   **Global Crash Handlers**: `uncaughtException` and `unhandledRejection` shields ensure the server continues running smoothly if unexpected errors occur.
*   **XSS Protection**: Comprehensive client-side HTML entity escaping (`escAttr`) blocks DOM-based cross-site scripting attacks.

---

## 💻 Folder & File Structure

```text
dna-payment/
├── server.js                      # Express backend, Rate Limiting, Gemini API, WS Server
├── index.html                     # Main application UI and entry point
├── config.js                      # Supabase credentials (DO NOT COMMIT to GitHub)
├── app.js                         # Core application logic, Supabase CRUD, UI rendering
├── role-permissions.js            # Handles Admin/Junior/Accounts access logic
├── firebase-init.js               # Firebase initialization for Drive settings
├── command-center.css             # Main styling, layout, and responsive grids
├── dna-command-center.css         # Premium glassmorphism themes and colors
├── dna-bugfixes.js                # Scorecard and SLA logic extensions
├── master_setup.sql               # Single combined SQL file for Supabase database setup
├── 05_ownership_transfer.sql      # Migration script for investigator reassignment logs
└── frontend/
    └── investigator-360/          # Modular workspace for Investigator Profiles
        ├── investigator-360.css
        └── investigator-360.js
```

### Key UI Components
*   **Role-Based UI**: UI elements (like the Scorecard, Bulk Delete, and Add Investigator buttons) are dynamically hidden/shown based on the user's role defined in the `user_roles` table (handled by `role-permissions.js`).
*   **Investigator 360°**: A modular profile viewer that aggregates an investigator's cases, stats, documents, and audit logs. It includes a custom **PDF Preview & Print** feature.
*   **Scorecard**: An automated performance tracker that grades investigators on completion speed, hardcopy submission, and payment collection.
*   **Intelligence & Fraud Heatmap**: A business intelligence dashboard that calculates fraud risk scores per hospital and generates live smart warnings to alert investigators during dispatch.

## 🚀 Live Deployment Workflow (Public Launch)

Follow these steps to take the website live and share it with your agency staff or the public:

**1. Upload to GitHub:**
* Create a new repository on your GitHub account.
* Upload all project files to the repository.
* *Security Note*: Make sure your `.env` file (containing `GEMINI_API_KEY`) and `config.js` (if it contains sensitive API keys) are added to your `.gitignore` file so they don't leak publicly.

**2. Connect Supabase (Core Database):**
* Create your Supabase project.
* Run `master_setup.sql` in the Supabase SQL Editor to build all your tables.
* Put your Supabase URL and Anon Key into `config.js` or your server's environment variables.

**3. Connect Firebase (Secondary Database for Drive & Settings):**
* Add your Firebase config to `firebase-applet-config.json`.
* *(Note: Firebase is strictly used as a secondary database/integration layer in this project, primarily for Google Drive sync and modular settings).*

**4. Host the Application & Share the URL (Cloudflare Live):**
* You will deploy this project to **Cloudflare** (e.g., Cloudflare Pages / Workers).
* Connect your Cloudflare account to your GitHub repository to deploy the code.
* *(Technical Note: Because this app has a Node.js backend (`server.js`) for AI features, if you are using Cloudflare Pages, you will need to map the Express routes to Cloudflare Functions or run the backend separately. Alternatively, you can host the frontend on Cloudflare and the backend on a Node-friendly service).*
* Once deployed, Cloudflare will generate a secure, fast live URL (e.g., `https://your-project.pages.dev`).
* **Share this Cloudflare Web URL** with your public users and staff so they can access the application.

## License
Proprietary — DNA Professional Investigation Agency.
Built with Node.js, Supabase, Firebase, Vanilla JavaScript, and modern web standards.
