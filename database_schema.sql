-- DNA Professional Investigation Agency
-- Supabase PostgreSQL Database Schema Reference
-- This file is for AI/Developer reference. Do not execute directly unless spinning up a new instance.

-- 1. Agency Settings
CREATE TABLE agency_settings (
    id INT PRIMARY KEY DEFAULT 1,
    agency_name VARCHAR(255),
    agency_address TEXT,
    logo TEXT, -- Base64 string
    field_permissions JSONB DEFAULT '{}'::jsonb
);

-- 2. Investigators
CREATE TABLE investigators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    payment_type VARCHAR(50) DEFAULT 'Per Case', -- 'Per Case' or 'Salary'
    payment_type_changed_at TIMESTAMP WITH TIME ZONE,
    removed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Cases (Main Investigation & Financial Ledger)
CREATE TABLE cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Document & Date
    doc_code VARCHAR(100) UNIQUE NOT NULL,
    date DATE NOT NULL,
    
    -- Company & Policy Details
    company VARCHAR(255) NOT NULL,
    case_type VARCHAR(100), -- PA, CASHLESS, REIMBURSEMENT, MB, FVR, SPOT, PROJECT, HOSPICASH, POST FACTO
    claim_no VARCHAR(100),
    policy_no VARCHAR(100),
    insured_name VARCHAR(255),
    hospital VARCHAR(255),
    location VARCHAR(255),
    
    -- Invoicing & Client Receivables
    invoice_no VARCHAR(100),
    invoice_amount NUMERIC(12,2) DEFAULT 0,
    received NUMERIC(12,2) DEFAULT 0,
    tds_deducted NUMERIC(12,2) DEFAULT 0,
    profit NUMERIC(12,2) DEFAULT 0,
    
    -- Investigator 1 Assignment & Financials
    inv1 VARCHAR(255), -- Investigator name
    fee1 NUMERIC(12,2) DEFAULT 0,
    ta1 NUMERIC(12,2) DEFAULT 0,
    inv1_status VARCHAR(50) DEFAULT 'Unpaid', -- 'Unpaid' or 'Paid'
    hardcopy1_status VARCHAR(50) DEFAULT 'Pending', -- 'Pending' or 'Received'
    
    -- Investigator 2 Assignment & Financials
    inv2 VARCHAR(255), -- Investigator name
    fee2 NUMERIC(12,2) DEFAULT 0,
    ta2 NUMERIC(12,2) DEFAULT 0,
    inv2_status VARCHAR(50) DEFAULT 'Unpaid', -- 'Unpaid' or 'Paid'
    hardcopy2_status VARCHAR(50) DEFAULT 'Pending', -- 'Pending' or 'Received'
    
    -- Aggregated Payables
    total_payable NUMERIC(12,2) DEFAULT 0,
    
    -- Hardcopy Tracking & Dispatch
    hardcopy_receive_date DATE,
    company_dispatch_date DATE,
    company_hardcopy_status VARCHAR(50) DEFAULT 'Pending', -- 'Pending' or 'Dispatched'
    company_hardcopy_awb VARCHAR(100),
    
    -- Status, SLA & Outcomes
    outcome VARCHAR(100) DEFAULT 'Pending', -- 'Pending', 'Genuine', 'Fraud', 'Suspicious', 'Withdrawn', 'Repudiated'
    fraud_reason TEXT,
    investigation_status VARCHAR(100),
    remarks TEXT,
    
    -- SLA Engine & Turnaround Time (TAT)
    sla_hours INTEGER DEFAULT 24,
    due_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    risk_level VARCHAR(50), -- 'Low', 'Medium', 'High'
    
    -- Exception Lifecycle Management
    exception_type VARCHAR(100), -- 'Withdrawn', 'Rejected', etc.
    exception_reason TEXT,
    exception_at TIMESTAMP WITH TIME ZONE,
    exception_by VARCHAR(255),
    
    -- Integrations & Extensibility
    drive_folder_id TEXT,
    drive_url TEXT,
    custom_data JSONB DEFAULT '{}'::jsonb
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_cases_doc_code ON cases(doc_code);
CREATE INDEX IF NOT EXISTS idx_cases_claim_no ON cases(claim_no);
CREATE INDEX IF NOT EXISTS idx_cases_company_claim ON cases(company, claim_no);
CREATE INDEX IF NOT EXISTS idx_cases_date ON cases(date);
CREATE INDEX IF NOT EXISTS idx_cases_inv1 ON cases(inv1);
CREATE INDEX IF NOT EXISTS idx_cases_inv2 ON cases(inv2);
CREATE INDEX IF NOT EXISTS idx_cases_outcome ON cases(outcome);
CREATE INDEX IF NOT EXISTS idx_cases_due_date ON cases(due_date);
CREATE INDEX IF NOT EXISTS idx_cases_completed_at ON cases(completed_at);
CREATE INDEX IF NOT EXISTS idx_cases_exception_type ON cases(exception_type);
CREATE INDEX IF NOT EXISTS idx_cases_sla_hours ON cases(sla_hours);

-- 4. Investigator Expenses (Vouchers, Salary Advances, Bonuses)
CREATE TABLE investigator_expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    investigator_name VARCHAR(255), -- References investigators.name
    date DATE,
    title VARCHAR(255),
    amount DECIMAL(10,2),
    category VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Unpaid',
    month_year VARCHAR(20) -- e.g., '2026-07'
);

-- 5. Case Ownership Transfers
CREATE TABLE case_ownership_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    old_investigator VARCHAR(255),
    new_investigator VARCHAR(255),
    transfer_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reason TEXT
);

-- 6. Audit & Activity Logs
CREATE TABLE activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID,
    action TEXT,
    module VARCHAR(100)
);

CREATE TABLE investigator_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    investigator_name VARCHAR(255),
    action VARCHAR(255),
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE investigator_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    investigator_name VARCHAR(255),
    document_name VARCHAR(255),
    document_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Investigator Payout Settlements & TDS Tax Ledger
CREATE TABLE investigator_payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    investigator_name VARCHAR(255) NOT NULL,
    month_code VARCHAR(20) NOT NULL,
    month_label VARCHAR(50),
    payout_date DATE DEFAULT CURRENT_DATE,
    total_cases NUMERIC(10,1) DEFAULT 0,
    gross_fees NUMERIC(10,2) DEFAULT 0,
    gross_ta NUMERIC(10,2) DEFAULT 0,
    expenses_amount NUMERIC(10,2) DEFAULT 0,
    gross_total NUMERIC(10,2) DEFAULT 0,
    taxable_base NUMERIC(10,2) DEFAULT 0,
    tds_rate NUMERIC(5,2) DEFAULT 0,
    tds_section VARCHAR(100) DEFAULT '0%',
    tds_amount NUMERIC(10,2) DEFAULT 0,
    net_disbursable NUMERIC(10,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'Paid',
    payment_mode VARCHAR(50) DEFAULT 'Bank Transfer',
    reference_no VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255),
    CONSTRAINT unique_inv_month_payout UNIQUE (investigator_name, month_code)
);

