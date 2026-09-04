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

-- 3. Cases
CREATE TABLE cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    date DATE,
    doc_code VARCHAR(100) UNIQUE,
    case_type VARCHAR(100),
    claim_no VARCHAR(100),
    insured_name VARCHAR(255),
    hospital_name VARCHAR(255),
    company VARCHAR(255),
    
    -- Assignment 1
    inv1 VARCHAR(255), -- References investigators.name
    inv1_fee DECIMAL(10,2) DEFAULT 0,
    inv1_ta DECIMAL(10,2) DEFAULT 0,
    inv1_status VARCHAR(50) DEFAULT 'Unpaid',
    inv1_hardcopy VARCHAR(50) DEFAULT 'Pending',
    
    -- Assignment 2
    inv2 VARCHAR(255), -- References investigators.name
    inv2_fee DECIMAL(10,2) DEFAULT 0,
    inv2_ta DECIMAL(10,2) DEFAULT 0,
    inv2_status VARCHAR(50) DEFAULT 'Unpaid',
    inv2_hardcopy VARCHAR(50) DEFAULT 'Pending',
    
    -- Status
    outcome VARCHAR(100),
    exception_type VARCHAR(255),
    investigation_status VARCHAR(100),
    company_dispatch_date DATE
);

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
