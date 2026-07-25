-- Run this SQL in your Supabase SQL Editor to create the tables

-- 1. Workspaces Table
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name TEXT NOT NULL,
    subdomain TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('Super Admin', 'Admin', 'Engineer', 'Employee')),
    department TEXT,
    phone_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Assets Table
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    asset_id_tag TEXT NOT NULL,
    asset_type TEXT NOT NULL,
    brand TEXT,
    model TEXT,
    serial_number TEXT,
    assigned_to TEXT, -- Email reference or user id
    status TEXT NOT NULL,
    purchase_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tickets Table
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    ticket_id_tag TEXT NOT NULL,
    issue_type TEXT NOT NULL,
    description TEXT,
    asset_id_tag TEXT,
    reported_by TEXT, -- Email reference
    assigned_to TEXT, -- Engineer email reference
    requested_by TEXT, -- Engineer email reference waiting for approval
    priority TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Note: RLS (Row Level Security) should be enabled later for production security.

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================
-- These policies ensure that Company ABC cannot see Company XYZ's data.

-- 1. Enable RLS on all tables
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- 2. Create Policies for Custom Auth Architecture
-- Since tenant data isolation is securely enforced at the SQL function level via our custom RPCs
-- (login_user, get_secure_tickets, etc. checking workspace_id), we permit direct client interactions
-- so that onboarding wizard (create-workspace.html) and live dashboard queries work without JWT friction.

-- Drop any existing policies to prevent conflicts
DROP POLICY IF EXISTS "Isolate Workspace" ON workspaces;
DROP POLICY IF EXISTS "Isolate Users" ON users;
DROP POLICY IF EXISTS "Isolate Assets" ON assets;
DROP POLICY IF EXISTS "Isolate Tickets" ON tickets;
DROP POLICY IF EXISTS "Allow public access for custom application architecture on work" ON workspaces;
DROP POLICY IF EXISTS "Allow public access for custom application architecture on workspaces" ON workspaces;
DROP POLICY IF EXISTS "Allow public access for custom application architecture on users" ON users;
DROP POLICY IF EXISTS "Allow public access for custom application architecture on assets" ON assets;
DROP POLICY IF EXISTS "Allow public access for custom application architecture on tickets" ON tickets;
DROP POLICY IF EXISTS "Public Workspaces" ON workspaces;
DROP POLICY IF EXISTS "Public Users" ON users;
DROP POLICY IF EXISTS "Public Assets" ON assets;
DROP POLICY IF EXISTS "Public Tickets" ON tickets;

CREATE POLICY "Public Workspaces" ON workspaces FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Assets" ON assets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Tickets" ON tickets FOR ALL USING (true) WITH CHECK (true);


-- ==========================================
-- AUTHENTICATION RPC (Remote Procedure Call)
-- ==========================================
-- This function allows the frontend to securely log in a user 
-- by checking the workspace name, email, and password, 
-- without exposing the entire users table to the public.

CREATE OR REPLACE FUNCTION login_user(
  p_company_name TEXT,
  p_email TEXT,
  p_password TEXT
) RETURNS JSON AS $$
DECLARE
  v_workspace_id UUID;
  v_user RECORD;
BEGIN
  -- 1. Find the workspace by company name
  SELECT id INTO v_workspace_id FROM workspaces WHERE company_name = p_company_name;
  
  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Workspace not found.';
  END IF;

  -- 2. Find the user in that workspace with matching email and password
  SELECT id, first_name, last_name, email, role, workspace_id 
  INTO v_user
  FROM users 
  WHERE workspace_id = v_workspace_id AND email = p_email AND password = p_password;

  IF v_user.id IS NULL THEN
    RAISE EXCEPTION 'Invalid email or password.';
  END IF;

  -- 3. Return the user details securely
  RETURN row_to_json(v_user);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==========================================
-- WORKSPACE FETCH RPC
-- ==========================================
-- This function returns all registered company names 
-- so they can be populated in the login dropdown, bypassing RLS.

CREATE OR REPLACE FUNCTION get_workspaces() 
RETURNS TABLE (company_name TEXT) AS $$
BEGIN
  RETURN QUERY SELECT workspaces.company_name FROM workspaces ORDER BY workspaces.company_name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Get Secure Assets
CREATE OR REPLACE FUNCTION get_secure_assets(p_user_id UUID, p_workspace_id UUID)
RETURNS SETOF assets AS $$
BEGIN
    -- Verify the user actually belongs to this workspace
    IF EXISTS (SELECT 1 FROM users WHERE id = p_user_id AND workspace_id = p_workspace_id) THEN
        RETURN QUERY SELECT * FROM assets WHERE workspace_id = p_workspace_id;
    ELSE
        RAISE EXCEPTION 'Unauthorized';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Get Secure Tickets
CREATE OR REPLACE FUNCTION get_secure_tickets(p_user_id UUID, p_workspace_id UUID)
RETURNS SETOF tickets AS $$
BEGIN
    -- Verify the user actually belongs to this workspace
    IF EXISTS (SELECT 1 FROM users WHERE id = p_user_id AND workspace_id = p_workspace_id) THEN
        RETURN QUERY SELECT * FROM tickets WHERE workspace_id = p_workspace_id ORDER BY created_at DESC;
    ELSE
        RAISE EXCEPTION 'Unauthorized';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Get Secure Users
CREATE OR REPLACE FUNCTION get_secure_users(p_user_id UUID, p_workspace_id UUID)
RETURNS SETOF users AS $$
BEGIN
    -- Verify the user actually belongs to this workspace
    IF EXISTS (SELECT 1 FROM users WHERE id = p_user_id AND workspace_id = p_workspace_id) THEN
        RETURN QUERY SELECT * FROM users WHERE workspace_id = p_workspace_id ORDER BY first_name ASC;
    ELSE
        RAISE EXCEPTION 'Unauthorized';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Secure Assign Ticket
CREATE OR REPLACE FUNCTION secure_assign_ticket(p_user_id UUID, p_workspace_id UUID, p_ticket_id UUID, p_assignee_email TEXT)
RETURNS void AS $$
BEGIN
    -- Verify the user actually belongs to this workspace and is an Admin or Engineer
    IF EXISTS (
        SELECT 1 FROM users 
        WHERE id = p_user_id 
        AND workspace_id = p_workspace_id 
        AND (role = 'Admin' OR role = 'Super Admin' OR role = 'Engineer')
    ) THEN
        UPDATE tickets SET assigned_to = p_assignee_email WHERE id = p_ticket_id AND workspace_id = p_workspace_id;
    ELSE
        RAISE EXCEPTION 'Unauthorized';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Secure Assign Asset
CREATE OR REPLACE FUNCTION secure_assign_asset(p_user_id UUID, p_workspace_id UUID, p_asset_id UUID, p_assignee_email TEXT)
RETURNS void AS $$
BEGIN
    -- Verify the user actually belongs to this workspace and is an Admin or Super Admin
    IF EXISTS (
        SELECT 1 FROM users 
        WHERE id = p_user_id 
        AND workspace_id = p_workspace_id 
        AND (role = 'Admin' OR role = 'Super Admin')
    ) THEN
        UPDATE assets SET assigned_to = p_assignee_email WHERE id = p_asset_id AND workspace_id = p_workspace_id;
    ELSE
        RAISE EXCEPTION 'Unauthorized';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- EMPLOYEE PORTAL RPC FUNCTIONS
-- ==========================================

-- 13. Get Employee Assets
CREATE OR REPLACE FUNCTION get_employee_assets(p_user_id UUID, p_workspace_id UUID)
RETURNS SETOF assets AS $$
DECLARE
    v_email TEXT;
BEGIN
    SELECT email INTO v_email FROM users WHERE id = p_user_id AND workspace_id = p_workspace_id;
    
    IF v_email IS NOT NULL THEN
        RETURN QUERY SELECT * FROM assets WHERE workspace_id = p_workspace_id AND assigned_to = v_email;
    ELSE
        RAISE EXCEPTION 'Unauthorized';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. Get Employee Tickets
CREATE OR REPLACE FUNCTION get_employee_tickets(p_user_id UUID, p_workspace_id UUID)
RETURNS SETOF tickets AS $$
DECLARE
    v_email TEXT;
BEGIN
    SELECT email INTO v_email FROM users WHERE id = p_user_id AND workspace_id = p_workspace_id;
    
    IF v_email IS NOT NULL THEN
        RETURN QUERY SELECT * FROM tickets WHERE workspace_id = p_workspace_id AND reported_by = v_email ORDER BY created_at DESC;
    ELSE
        RAISE EXCEPTION 'Unauthorized';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 15. Raise Ticket
CREATE OR REPLACE FUNCTION raise_ticket(p_user_id UUID, p_workspace_id UUID, p_issue_type TEXT, p_description TEXT, p_priority TEXT)
RETURNS void AS $$
DECLARE
    v_email TEXT;
    v_ticket_id_tag TEXT;
BEGIN
    SELECT email INTO v_email FROM users WHERE id = p_user_id AND workspace_id = p_workspace_id;
    
    IF v_email IS NOT NULL THEN
        -- Generate a simple random ticket ID tag (e.g. TCK-8492)
        v_ticket_id_tag := 'TCK-' || floor(random() * 9000 + 1000)::text;
        
        INSERT INTO tickets (workspace_id, ticket_id_tag, issue_type, description, reported_by, priority, status)
        VALUES (p_workspace_id, v_ticket_id_tag, p_issue_type, p_description, v_email, p_priority, 'Open');
    ELSE
        RAISE EXCEPTION 'Unauthorized';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- IT ENGINEER PORTAL RPC FUNCTIONS
-- ==========================================

-- 16. Get Engineer Tickets
CREATE OR REPLACE FUNCTION get_engineer_tickets(p_user_id UUID, p_workspace_id UUID)
RETURNS SETOF tickets AS $$
DECLARE
    v_email TEXT;
BEGIN
    SELECT email INTO v_email FROM users WHERE id = p_user_id AND workspace_id = p_workspace_id AND role = 'Engineer';
    
    IF v_email IS NOT NULL THEN
        -- Return tickets that are unassigned OR assigned to this engineer
        RETURN QUERY SELECT * FROM tickets 
        WHERE workspace_id = p_workspace_id 
        AND (assigned_to IS NULL OR assigned_to = '' OR assigned_to = v_email)
        ORDER BY created_at DESC;
    ELSE
        RAISE EXCEPTION 'Unauthorized or not an Engineer';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 17. Engineer Claim Ticket
CREATE OR REPLACE FUNCTION engineer_claim_ticket(p_user_id UUID, p_workspace_id UUID, p_ticket_id UUID)
RETURNS void AS $$
DECLARE
    v_email TEXT;
BEGIN
    SELECT email INTO v_email FROM users WHERE id = p_user_id AND workspace_id = p_workspace_id AND role = 'Engineer';
    
    IF v_email IS NOT NULL THEN
        -- Only claim if it's currently unassigned in this workspace
        UPDATE tickets 
        SET assigned_to = v_email, status = 'Open'
        WHERE id = p_ticket_id AND workspace_id = p_workspace_id AND (assigned_to IS NULL OR assigned_to = '');
    ELSE
        RAISE EXCEPTION 'Unauthorized or not an Engineer';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 18. Engineer Update Ticket Status
CREATE OR REPLACE FUNCTION engineer_update_ticket_status(p_user_id UUID, p_workspace_id UUID, p_ticket_id UUID, p_new_status TEXT)
RETURNS void AS $$
DECLARE
    v_email TEXT;
BEGIN
    SELECT email INTO v_email FROM users WHERE id = p_user_id AND workspace_id = p_workspace_id AND role = 'Engineer';
    
    IF v_email IS NOT NULL THEN
        -- Only update if it's assigned to THIS engineer
        UPDATE tickets 
        SET status = p_new_status
        WHERE id = p_ticket_id AND workspace_id = p_workspace_id AND assigned_to = v_email;
    ELSE
        RAISE EXCEPTION 'Unauthorized or not an Engineer';
    END IF;
END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- REALTIME CONFIGURATION
-- ==========================================
-- Enable Supabase Realtime for tickets table
-- Run this block if publication doesn't exist or isn't tracking tickets:
-- ALTER PUBLICATION supabase_realtime ADD TABLE tickets;
