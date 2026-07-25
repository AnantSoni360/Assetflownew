# 🌿 AssetFlow — Multi-Tenant IT Asset & Helpdesk OS

<p align="center">
  <img src="https://img.shields.io/badge/Architecture-Multi--Tenant%20Cloud-10b981?style=for-the-badge&logo=supabase&logoColor=white" alt="Multi-Tenant Cloud">
  <img src="https://img.shields.io/badge/Database-Supabase%20PostgreSQL-3ecf8e?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase PostgreSQL">
  <img src="https://img.shields.io/badge/Realtime-WebSocket%20Sync-0284c7?style=for-the-badge&logo=socket.io&logoColor=white" alt="Realtime Sync">
  <img src="https://img.shields.io/badge/Auth-EmailJS%20Live%20OTP-f97316?style=for-the-badge&logo=gmail&logoColor=white" alt="EmailJS OTP">
  <img src="https://img.shields.io/badge/Hosting-Vercel%20CDN-black?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel Deployment">
</p>

---

## 🎓 A Note to Students & Aspiring Engineers
Welcome to the official source repository for **AssetFlow**! 🚀

This repository is designed not only as a production-ready enterprise application but also as an **educational engineering masterclass** for computer science students and aspiring web developers. When learning software engineering, many courses teach isolated concepts (like creating a single login form or a static database table), but they often omit how to solve **real-world enterprise complexities**—such as handling multiple companies on one database, sending live email verifications without expensive servers, processing bulk spreadsheets in the browser, and keeping multi-user dashboards updated automatically in real-time.

In this document, we walk you through the exact **industry problems** we set out to tackle, the **architectural designs** we engineered to solve them cleanly, our lightweight **modern technology stack**, and how you can study, fork, and run this system yourself!

---

## 💥 The Real-World Industry Problem
In growing organizations, managing IT equipment and supporting technical issues often degenerates into organizational chaos. Before building **AssetFlow**, we analyzed traditional enterprise workflows and identified three massive friction points:

1. **Siloed Operations (The Spreadsheet & Email Trap):**
   - **The Pain:** Companies typically track expensive physical hardware (laptops, monitors, servers) in outdated, fragile Excel spreadsheets. Meanwhile, when an employee's computer breaks, they report it through disconnected email chains or complex ticketing third-party software.
   - **The Impact:** When an IT Engineer receives a helpdesk ticket saying *"My monitor won't turn on"*, they waste dozens of minutes cross-referencing messy spreadsheets just to discover which monitor model the employee was actually issued, its serial number, and its current warranty status!

2. **Multi-Tenant Onboarding & Data Ingestion Costs:**
   - **The Pain:** When SaaS (Software as a Service) providers onboard a brand-new corporate client (or a new branch office), legacy systems require spinning up separate virtual database machines and executing slow, manual data migrations.
   - **The Impact:** Small and medium enterprises are priced out of high-end asset tools, and setup takes weeks rather than minutes.

3. **Stale Dashboards & Visibility Blind Spots:**
   - **The Pain:** Employees raise helpdesk tickets and hear nothing back for days, constantly pressing F5 (Refresh) in hopes that an IT engineer picked up their ticket. Furthermore, administrators lack a transparent dashboard showing the actual troubleshooting description written by the reporting employee.

---

## ✨ Our Solution: How AssetFlow Solves It
**AssetFlow** turns IT Helpdesk & Hardware management into a clean, intuitive, and secure cloud platform built around **three core principles**:

```
        ┌─────────────────────────────────────────────────────────┐
        │                 🌿 ASSETFLOW CLOUD OS                    │
        └────────────────────────────┬────────────────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         ▼                           ▼                           ▼
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│   👥 EMPLOYEES   │       │  🛠️ IT ENGINEERS  │       │ 👑 SUPER ADMINS  │
│  View personal   │       │ Real-time queue  │       │ Manage workforce │
│ assets & raise   │       │  claim tickets & │       │ & instant setup  │
│  instant tickets │       │ resolve problems │       │   via CSV bulk   │
└──────────────────┘       └──────────────────┘       └──────────────────┘
```

### 1. Unified Workplace OS
By pairing **Physical Assets** and **IT Support Tickets** directly under individual user profiles within the same system, hardware troubleshooting becomes effortless! Whenever an employee submits an incident report, both the assigned **IT Engineer** and **Super Admin** see the exact description of the technical issue immediately, linked directly to the employee's email and workspace!

### 2. Instant 3-Step Workspace Onboarding with CSV Bulk Seed
We replaced multi-week software installations with an intuitive self-service onboarding wizard (`create-workspace.html`):
- **Live Email Verification:** Administrators prove domain ownership via a real-time **4-digit verification email (OTP)** dispatched straight to their corporate inbox.
- **Bulk Data Ingestion:** Administrators drop their filled `.csv` templates (`asset_template.csv`, `user_template.csv`, `ticket_template.csv`) straight into the browser. AssetFlow automatically parses, verifies column headers, and populates the database instantaneously!
- **Strict Credential Checks:** Live visual error explanations ensure that both Super Admin passwords and temporary team default passwords match perfectly before deploying the company.

### 3. Dedicated Role-Based Workspaces (RBAC)
Instead of forcing everyone into one crowded screen, AssetFlow generates specialized portals based on user role:
- 👥 **Employee Portal (`employee-dashboard.html`):** A clean interface where regular employees can inspect their assigned hardware devices, submit support requests with priority ratings (Low, Medium, High, Critical), and track their active ticket progress.
- 🛠️ **IT Engineer Portal (`engineer-dashboard.html`):** An operational hub featuring a real-time unassigned ticket queue. Engineers can view urgent task lists, **Claim** unassigned tickets with a single click, read complete diagnostic descriptions, and advance ticket statuses through *Open* ➔ *In Progress* ➔ *Resolved* without refreshing the browser!
- 👑 **Super Admin Portal (`admin-dashboard.html`):** Executive oversight across all corporate physical assets, real-time ticket resolutions, and staff directories, equipped with direct user account creation tools.

---

## 🏛️ Core Architectural Highlights & Technical Innovations
As computer science students, paying attention to **how** a system is constructed under the hood is vital. Here are five core complex architectural patterns implemented in AssetFlow:

### 1. Single-Table Multi-Tenancy (Database Isolation)
* **The Engineering Challenge:** How do you serve multiple separate corporate clients (for example, *Intec Service Hub* vs. *Acme Corp*) from one single shared PostgreSQL database without allowing Company A to see Company B's private helpdesk tickets or employee phone numbers?
* **The Solution:** We architected strict **Single-Table Multi-Tenancy**. Every record inside our `users`, `assets`, and `tickets` tables is tagged with a mandatory foreign key: `workspace_id` (pointing to the `workspaces` directory table).
* **Server-Side Security Definered RPCs:** Rather than relying purely on client-side filtering (which attackers can bypass by modifying browser developer console code), we engineered **PostgreSQL Stored Procedures (`RPC`)** running under `SECURITY DEFINER` privileges in Supabase. Functions like `login_user`, `get_secure_tickets`, and `engineer_claim_ticket` safely perform server-side validations to ensure queries return data belonging **strictly** to the authenticated user's organization!

```sql
-- Example of our secure PostgreSQL server-side query architecture in schema.sql:
CREATE OR REPLACE FUNCTION get_secure_tickets(p_user_id UUID, p_workspace_id UUID)
RETURNS SETOF tickets AS $$
BEGIN
    -- Verify user authorization inside this specific organization before returning data!
    IF EXISTS (SELECT 1 FROM users WHERE id = p_user_id AND workspace_id = p_workspace_id) THEN
        RETURN QUERY SELECT * FROM tickets WHERE workspace_id = p_workspace_id ORDER BY created_at DESC;
    ELSE
        RAISE EXCEPTION 'Unauthorized Attempt Blocked';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2. Serverless Email OTP Verification Engine (EmailJS SDK Integration)
* **The Engineering Challenge:** Standard implementations of live Email One-Time Passwords (OTPs) require setting up dedicated Node.js or Python background servers equipped with complicated SMTP email relay integrations, leading to higher maintenance costs and potential DevOps failure points.
* **The Solution:** We completely decentralized authentication email dispatching by integrating **EmailJS** directly into our frontend architecture! When a workspace creator enters their email address, our cryptographic frontend engine generates a random 4-digit code and timestamp, then communicates via secure HTTPS Web APIs directly to EmailJS (`service_n9sol5z` / `template_xvr9ku3`) to deliver a formatted HTML verification message into their Gmail or Outlook inbox!
* **Developer Friendly Fallback:** To prevent developers and presentation speakers from getting blocked during live demos or offline testing if spam filters delay an email, we implemented a secure *"Testing Shortcut: Click to reveal OTP"* interactive toggle directly inside the UI toast notification!

### 3. Real-Time WebSocket Synchronization (No Polling!)
* **The Engineering Challenge:** In traditional web apps, if an employee raises a ticket, the IT Engineer won't see it until they hit F5 or unless the page constantly polls the server every few seconds (wasting server network bandwidth and battery life).
* **The Solution:** Powered by **Supabase Realtime**, all AssetFlow dashboards automatically open a lightweight, persistent bi-directional **WebSocket** channel listening directly to PostgreSQL table change events:
  ```javascript
  supabaseClient
      .channel('public:tickets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, payload => {
          console.log('Real-Time change detected over WebSockets!', payload);
          loadPortalData(); // Automatically refreshes the DOM instantly!
      })
      .subscribe();
  ```
  When an Engineer updates a ticket status from *"Open"* to *"In Progress"*, every employee viewing their portal sees the status pill color change across their screens immediately!

### 4. High-Speed In-Browser CSV Processing Engine
* To ensure zero latency and prevent uploading corrupt spreadsheet files to our Supabase storage, we utilize **PapaParse** directly inside the browser memory during workspace onboarding. Before a single network byte is sent to the cloud, our verification loop inspects the uploaded file types, confirms exact file naming standards (`asset_template.csv`), and validates that mandatory column headers exist!

### 5. Account Settings & Real-Time Supabase Password Revocation
* Every dashboard incorporates an intuitive **⚙️ Settings Gear Icon** and sidebar item granting users self-service password control.
* When changing an account password, the application executes a live database query against the Supabase `users` table to authenticate the user's **Current Password** before applying adjustments. Once saved, the update query overwrites their active database record—meaning old passwords are immediately revoked for future logins across any device!

---

## 🛠️ Technology Stack & Why We Chose It
One of our proudest architectural decisions was rejecting bloated modern web UI frameworks in favor of **unplugged web performance** and foundational mastery:

| Technology | Role & Purpose | Educational Rationale |
| :--- | :--- | :--- |
| **HTML5 & Vanilla CSS3** | Structural Markup & Responsive Design Design System | Utilizing custom CSS attributes (`var(--primary-color)`), flexbox grids, sleek HSL dark mode palettes, and smooth micro-animations proves you don't need heavy UI dependencies to build stunning, wow-factor user experiences! |
| **Modern JavaScript (ES6+)** | Frontend Business Logic & DOM Manipulation | By relying on standard ES6 asynchronous programming (`async/await`), event delegation, and browser APIs (`localStorage`, `FileReader`), the code remains ultra-fast and completely readable without build-tool complexity. |
| **Supabase (PostgreSQL 15)** | Cloud Database, RPC Auth Engine & Realtime Server | Supabase provides enterprise-grade relational database reliability while equipping us with built-in WebSocket streaming and powerful server-side Stored Procedures (PL/pgSQL). |
| **EmailJS SDK** | Serverless Live Email OTP Delivery Engine | Allows reliable dispatching of real verification emails via secure client-side API invocations without configuring complex backend SMTP servers or Node instances. |
| **PapaParse** | High-Performance In-Browser CSV Data Reader | Industry-standard parsing library that converts complex Excel/CSV raw text files into structured Javascript objects in milliseconds. |
| **Vercel / GitHub Pages** | CI/CD Hosting & Global Content CDN | Guarantees instant deployment with automated free SSL encryption (`https://`) on every git code push! |

---

## 📂 Project Directory & Sitemap
Here is a complete road map of the codebase so you can navigate and learn how each module fits together:

```bash
📦 AssetFlow (Root Directory)
 ├─ 📄 index.html              # Landing Page & Feature Showcase (Marketing Entry Point)
 ├─ 📄 create-workspace.html     # 3-Step Workspace Onboarding Wizard (Email OTP & CSV Ingestion)
 ├─ 📄 login.html              # Universal Secure Portal Sign-in Screen (Multi-Company Select)
 ├─ 📄 employee-dashboard.html   # Dedicated Employee Helpdesk & Asset Portal
 ├─ 📄 engineer-dashboard.html   # Dedicated IT Engineer Ticket Queue & Claim Workspace
 ├─ 📄 admin-dashboard.html      # Executive Super Admin Overview & User Directory Control
 │
 ├─ 🎨 style.css               # Global Design System (Color Variables, Buttons, Utilities)
 ├─ 🎨 dashboard.css           # Portal Specific CSS (Data Tables, Stat Cards, Filter Pills, Modals)
 ├─ 🎨 onboarding.css          # Onboarding Stepper, File Upload Drop zones & Alert boxes
 ├─ 🎨 login.css               # Clean Glassmorphic Login Layout styling
 │
 ├─ ⚙️ db.js                   # Universal Supabase Client Configuration & CSV Parser Utilities
 ├─ ⚙️ employee.js             # Employee Portal Logic (Ticket raising, Asset fetches & Realtime sync)
 ├─ ⚙️ engineer.js             # Engineer Portal Logic (Queue filters, Ticket claiming & Task generator)
 ├─ ⚙️ admin.js                # Super Admin Logic (User creation, Directory table & System stats)
 │
 ├─ 🗄️ schema.sql              # Supabase PostgreSQL Table Definitions, RLS Rules & PL/pgSQL RPC Functions
 ├─ 🐍 generate_seed.py        # Bonus Utility: Python script to generate demo seed files
 │
 └─ 📁 intec service hub/      # Demonstration Workspace: Production-ready templates ready for testing!
     ├─ 📊 asset_template.csv    # Sample pre-filled Hardware Asset equipment directory
     ├─ 📊 user_template.csv     # Sample pre-filled Workforce employee profiles & roles
     └─ 📊 ticket_template.csv   # Sample pre-filled Historical service incident reports
```

---

## 🚀 How to Setup & Run Locally (For Students)
Want to test-drive, study, or fork AssetFlow for your university project or portfolio? Follow these simple steps:

### 1️⃣ Clone the Repository
Open your computer terminal (Terminal / PowerShell / Git Bash) and run:
```bash
git clone https://github.com/AnantSoni360/Assetflownew.git
cd Assetflownew
```

### 2️⃣ Configure Your Cloud Database (Supabase)
1. Create a free account at **[Supabase.com](https://supabase.com/)** and start a new project.
2. Once your database initializes, copy your **Project URL** and **Anon / Public API Key** from project settings.
3. Open `db.js` in your text editor (VS Code) and replace the keys at the top of the file:
   ```javascript
   const supabaseUrl = 'YOUR_SUPABASE_PROJECT_URL_HERE';
   const supabaseKey = 'YOUR_SUPABASE_PUBLIC_ANON_KEY_HERE';
   ```
4. Navigate to the **SQL Editor** tab inside your Supabase online control panel, open the `schema.sql` file from this project folder, paste all contents into the query window, and click **Run**. This immediately builds your multi-tenant database tables, RLS policies, and secure Stored Procedures!

### 3️⃣ Configure Live OTP Email Verification (EmailJS)
1. Register for a free account at **[EmailJS.com](https://www.emailjs.com/)**.
2. Connect an Email Service (e.g., Gmail) and create an **Email Template** utilizing variables like `{{to_email}}`, `{{otp_code}}`, and `{{company_name}}`.
3. Open `create-workspace.html` around line `702` and plug in your three identifiers:
   ```javascript
   const serviceID = "YOUR_SERVICE_ID";
   const templateID = "YOUR_TEMPLATE_ID";
   const publicKey = "YOUR_PUBLIC_KEY";
   ```

### 4️⃣ Run in Your Browser
Because AssetFlow runs entirely on modern frontend browser architectures communicating directly with secure cloud APIs, **no Node.js installation or `npm install` build loop is required!**
* You can simply double-click `index.html` to launch it immediately in Google Chrome or Microsoft Edge!
* *Tip:* For optimal performance with Real-Time WebSockets, open the project folder using the **Live Server** extension inside Visual Studio Code!

### 5️⃣ Instant Cloud Deployment (Vercel)
When you are ready to share your working application with the world:
1. Push your updated codebase to your own GitHub account.
2. Log into **[Vercel.com](https://vercel.com/)** and click **"Add New Project"**.
3. Select your GitHub repository and click **Deploy**. Vercel will bundle and launch your global secure web link with free SSL (`https://`) in less than 60 seconds!

---

## 🏆 Summary of Key Learning Outcomes for Students
By reviewing this source code, you will gain hands-on architectural experience with:
- **Relational Schema Engineering:** Designing scalable foreign keys and indexing multi-tenant data structures.
- **Serverless Security:** Executing complex authentication verification loops without relying on vulnerability-prone backend server instances.
- **Realtime Reactive UI Design:** Using WebSocket notifications to automatically synchronize user screens without manual page reloads.
- **Defensive Frontend Programming:** Managing DOM state cleanly, handling spreadsheet ingestion errors gracefully, and writing maintainable Vanilla JavaScript at scale!

*Built with 💚 by the AssetFlow Engineering Team. Enjoy exploring, coding, and learning!*
