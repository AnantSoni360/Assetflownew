import csv
import uuid
import os

WORKSPACE_ID = '11111111-1111-1111-1111-111111111111'
PASSWORD = 'Intec2026!'
WORKSPACE_NAME = 'Intec Service Hub'
SUBDOMAIN = 'intec'

def escape_sql(value):
    if value is None:
        return "NULL"
    val = str(value).replace("'", "''")
    return f"'{val}'"

sql_statements = []

sql_statements.append(f"-- ==========================================")
sql_statements.append(f"-- INTEC SERVICE HUB MASTER DATA MIGRATION")
sql_statements.append(f"-- ==========================================\n")

# 1. Workspace
sql_statements.append("-- 1. Insert Workspace")
sql_statements.append(f"INSERT INTO workspaces (id, company_name, subdomain) VALUES ('{WORKSPACE_ID}', '{WORKSPACE_NAME}', '{SUBDOMAIN}') ON CONFLICT DO NOTHING;\n")

# 2. Users
sql_statements.append("-- 2. Insert Users")
users_file = r'd:\Asset flow\intec service hub\users_final.csv'
if os.path.exists(users_file):
    with open(users_file, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            name_parts = row['Name'].strip().split(' ', 1)
            first_name = name_parts[0]
            last_name = name_parts[1] if len(name_parts) > 1 else ''
            
            raw_role = row['Role'].strip()
            if 'Engineer' in raw_role:
                mapped_role = 'Engineer'
            elif raw_role in ['Super Admin', 'Admin', 'Employee']:
                mapped_role = raw_role
            else:
                mapped_role = 'Employee'
            
            sql = f"INSERT INTO users (workspace_id, first_name, last_name, email, password, role, department, phone_number) VALUES (" \
                  f"'{WORKSPACE_ID}', " \
                  f"{escape_sql(first_name)}, " \
                  f"{escape_sql(last_name)}, " \
                  f"{escape_sql(row['Email'].strip())}, " \
                  f"'{PASSWORD}', " \
                  f"{escape_sql(mapped_role)}, " \
                  f"{escape_sql(row['Department'].strip())}, " \
                  f"''" \
                  f");"
            sql_statements.append(sql)
sql_statements.append("\n")

# 3. Assets
sql_statements.append("-- 3. Insert Assets")
assets_file = r'd:\Asset flow\intec service hub\assets_final.csv'
if os.path.exists(assets_file):
    asset_counter = 1000
    with open(assets_file, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            asset_id_tag = f"AST-{asset_counter}"
            asset_counter += 1
            
            sql = f"INSERT INTO assets (workspace_id, asset_id_tag, asset_type, brand, model, serial_number, assigned_to, status) VALUES (" \
                  f"'{WORKSPACE_ID}', " \
                  f"'{asset_id_tag}', " \
                  f"{escape_sql(row['Asset_Type'].strip())}, " \
                  f"'Unknown', " \
                  f"{escape_sql(row['Asset_Name'].strip())}, " \
                  f"{escape_sql(row['Serial_Number'].strip())}, " \
                  f"{escape_sql(row['Assigned_To_Email'].strip())}, " \
                  f"{escape_sql(row['Status'].strip())}" \
                  f");"
            sql_statements.append(sql)
sql_statements.append("\n")

# 4. Tickets
sql_statements.append("-- 4. Insert Tickets")
tickets_file = r'd:\Asset flow\intec service hub\tickets_final.csv'
if os.path.exists(tickets_file):
    ticket_counter = 1000
    with open(tickets_file, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            ticket_id_tag = f"TCK-{ticket_counter}"
            ticket_counter += 1
            
            sql = f"INSERT INTO tickets (workspace_id, ticket_id_tag, issue_type, description, reported_by, assigned_to, priority, status) VALUES (" \
                  f"'{WORKSPACE_ID}', " \
                  f"'{ticket_id_tag}', " \
                  f"{escape_sql(row['Title'].strip())}, " \
                  f"{escape_sql(row['Description'].strip())}, " \
                  f"{escape_sql(row['Requested_By_Email'].strip())}, " \
                  f"{escape_sql(row['Assigned_To_Email'].strip())}, " \
                  f"{escape_sql(row['Priority'].strip())}, " \
                  f"{escape_sql(row['Status'].strip())}" \
                  f");"
            sql_statements.append(sql)

with open(r'd:\Asset flow\seed_intec.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(sql_statements))

print("Successfully generated d:\\Asset flow\\seed_intec.sql")
