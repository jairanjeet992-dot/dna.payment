# DNA Professional Investigation Agency - Payment Management System

A mission-critical, full-stack payment, SLA turnaround tracking, and case management system built specifically for the **DNA Professional Investigation Agency**.

---

## Overview
DNA Payment Management is a high-performance Single Page Application (SPA) designed to administer insurance claim investigations, field investigator payouts, agency expenses, statutory TDS tax ledgers, turnaround time (TAT) compliance, and client reporting.

It runs in the browser using Vanilla JavaScript (`app.js`) paired with a modern Node.js/Express backend (`server.js`) and connects in real-time to a Supabase PostgreSQL database.

---

## Tech Stack
* **Frontend**: HTML5, Vanilla JavaScript (`app.js`), Custom Design System CSS (`dna-command-center.css`).
* **Backend & Database**: Supabase (PostgreSQL with RLS, Realtime Subscriptions, Database Functions).
* **Server**: Node.js / Express (`server.js`) providing automated hourly backups, REST APIs, and Gemini AI voice/text processing.
* **Reporting & Invoicing**: `html2pdf.js` for on-the-fly PDF payment slips, monthly agency reports, and investigator billing statements.
* **Spreadsheet Engine**: `SheetJS (xlsx)` for bidirectional Excel export and bulk spreadsheet ingestion.

---

## Core Operational Modules

### 1. SLA & TAT Turnaround Engine
* **Automated Due Date Calculation**: Every case automatically computes an SLA window (default: 24 hours, configurable per case: 12h, 24h, 48h, 72h, 120h).
* **Real-Time Dynamic SLA Bar**: Live visual progress bar on case cards and tables:
  * 🟢 **Normal**: < 25% SLA elapsed
  * 🟡 **Approaching**: 25% – 75% SLA elapsed
  * 🟠 **Urgent**: > 75% SLA elapsed
  * 🔴 **Overdue / SLA Breached**: 100%+ SLA expired with a high-visibility pulsing indicator.
* **Turnaround Time (TAT) Calculation**: Computes exact investigation duration between assignment date and case closure (`completed_at`).
* **Case Closed Date Tracking**: Explicitly stamps completion timestamps upon investigation closure.

### 2. Exception Lifecycle Management
* **Strict Distinction Between Exceptions**:
  * **Withdrawn (`Withdrawn`)**: Cases cancelled or recalled prior to field work. The system automatically prompts to zero out Investigator Fees and Travel Allowances (`Fee1=0`, `Fee2=0`, `TA1=0`, `TA2=0`), preventing accidental financial leakage.
  * **Rejected (`Rejected`)**: Cases investigated and repudiated/rejected based on investigator findings. Field fees and travel allowances **remain fully payable** to the field staff.
* **Audit Trail**: Every marked exception records the reason, timestamp (`exception_at`), and user (`exception_by`).
* **Unified Search**: Exception types and reasons are searchable right from the global case search bar.

### 3. Smart Merge & Universal Bulk Import
* **Universal Format Support**: Ingest `.xlsx`, `.xls`, `.csv`, or direct clipboard copy-paste from Excel/Google Sheets.
* **Fuzzy Header Matching**: Automatically identifies claim numbers, insured names, hospitals, locations, policy numbers, dates, and companies across diverse insurer templates.
* **Atomic Deduplication & Merging**: Detects existing claim numbers and updates fields without creating duplicate document codes.

### 4. Investigator 360 & Payout Ledger
* **Hybrid Payment Models**: Supports both **Per Case** (fee + TA per assignment) and **Salary** models with historical transition tracking (`payment_type_changed_at`).
* **Bulk Payment Processing**: Rapid settlement tool to clear pending investigator fees across multiple cases with one click.
* **Statutory TDS & Tax Settlement**: Computes monthly gross fees, travel allowances, approved expense vouchers, statutory tax deductions (e.g., Section 194J / 194C), and net disbursable amounts.

### 5. Client Payment Recovery & Smart TDS Reconciliation
* **Dedicated TDS Tracking**: Supports client statutory tax deduction via `tds_deducted` (e.g. Section 194J/194C TDS withheld by insurance companies or TPAs).
* **Robust Accounting Balance Formula**:
  * **Outstanding Balance**: `Math.max(0, Billed_Amount - (Bank_Received + TDS_Deducted))`
  * **Agency Profit**: `(Bank_Received + TDS_Deducted) - Total_Payable` (matches database trigger `calculate_case_financials`).
  * *Example Scenario*: On an invoice of ₹3,540 settled with ₹3,240 received in bank and ₹300 TDS withheld, the outstanding balance clears to **₹0 Due** (100% Settled), and agency profit reflects the full gross invoice margin.
* **Quick Receive (Single & Bulk Remittance Advice)**:
  * Single Claim Lookup automatically calculates invoice shortfall and provides a **1-click Auto-Fill TDS button** to instantly reconcile the claim to ₹0 due.
  * Bulk Quick Receive allows pasting remittance advice tables from email or Excel (`Claim | Received | TDS`) with automatic TDS calculation for underpaid invoices.
* **Company Recovery Dashboard**:
  * Category segmentation (`Billable Overdue`, `Partially Paid`, `Paid in Full`, `Withdrawn`, `Rejected`).
  * Instant remittance recording with custom bank UTR, payment date, and TDS allocation.

### 6. Multi-Tier Backup & Disaster Recovery Framework
The system provides three layers of automated and on-demand backup to protect agency records:
1. **Client-Side JSON Backup & Restore**:
   * Export complete snapshots (`cases`, `settings`, `investigators`, `investigator_expenses`) via `exportBackup()`, including `tds_deducted` and financial fields.
   * Resilient chunked restore (`restoreBackup()`) that inserts rows in safe batches of 100 to prevent payload size limits and correctly restores `tds_deducted` and recalculated profits.
2. **Server-Side Automated Hourly Snapshots**:
   * `server.js` maintains scheduled daily and catch-up snapshots in `/backups/`.
   * Automatically backs up all columns of `cases`, `investigators`, `agency_settings`, `investigator_expenses`, `investigator_payouts`, and `activity_log`.
   * Retains the latest 14 snapshots with automatic rotation pruning.
3. **Google Drive Cloud Sync**:
   * Direct OAuth integration uploading structured system JSON backups to the agency's configured Google Drive folder.
4. **Google Sheets / Excel CSV Export**:
   * Export complete table data including `TDS Deducted`, `Received`, `Total Payable`, and `Profit` directly for external accounting.

---

## Database Schema Reference (Supabase PostgreSQL)

### Primary Tables
* **`cases`**: Master investigation ledger.
  * Fields: `id`, `doc_code`, `date`, `company`, `case_type`, `claim_no`, `policy_no`, `insured_name`, `hospital`, `location`, `invoice_no`, `invoice_amount`, `received`, `tds_deducted`, `profit`, `inv1`, `inv2`, `fee1`, `fee2`, `ta1`, `ta2`, `total_payable`, `inv1_status`, `inv2_status`, `hardcopy1_status`, `hardcopy2_status`, `company_hardcopy_status`, `company_hardcopy_awb`, `outcome`, `fraud_reason`, `sla_hours`, `due_date`, `completed_at`, `risk_level`, `exception_type`, `exception_reason`, `exception_at`, `exception_by`, `drive_folder_id`, `drive_url`, `custom_data`.
* **`investigators`**: Staff roster, contact numbers, and compensation model (`Per Case` or `Salary`).
* **`investigator_expenses`**: Expense vouchers, bonuses, and advance payments.
* **`investigator_payouts`**: Monthly settlement and statutory TDS tax ledger.
* **`agency_settings`**: Singleton agency configuration (`id: 1`) holding agency name, address, logo (Base64), and RBAC permissions.
* **`activity_log`** & **`investigator_audit_log`**: System-wide immutable audit trail.
* **`case_ownership_transfers`**: History of case reassignments between field investigators.

### Migration Scripts (`/db_scripts/`)
1. `master_setup.sql`: Complete initial Supabase database schema.
2. `05_ownership_transfer.sql`: Case ownership transfer audit tracking.
3. `10_exception_cases.sql`: Exception lifecycle columns.
4. `11_investigator_expenses.sql`: Voucher and expense ledger.
5. `12_smart_merge_and_missing_case_columns.sql`: Smart merge and enrichment fields.
6. `13_investigator_payouts_and_tds_ledger.sql`: Payouts and TDS ledger schema.
7. `14_sla_tat_exceptions_and_closure_columns.sql`: Safe patch for SLA hours, due date, completed at, and exception tracking with performance indexes.
8. `15_add_tds_deducted_column.sql`: Safe patch adding `tds_deducted` column, performance index, and updating `calculate_case_financials()` trigger function.

---

## Developer Guidelines & Cache Busting

> [!IMPORTANT]
> **Browser Cache Busting**:
> Because this is a static/CDN-served application without an automated bundling hash, you **MUST** increment the version query parameter in `index.html` whenever editing `app.js` or `dna-command-center.css`:
> ```html
> <script src="app.js?v=34"></script>
> <link rel="stylesheet" href="dna-command-center.css?v=28">
> ```

### Running Locally
```bash
# Install dependencies
npm install

# Start development server on port 3000
npm start
```
Open `http://localhost:3000` in your browser.
