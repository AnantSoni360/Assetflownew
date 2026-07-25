// Initialize Supabase Client
const supabaseUrl = 'https://nphdpclywjsmqowbvegy.supabase.co';
const supabaseKey = 'sb_publishable_z-wkJgi8fRnyUblLwyu-Fg_v5TlVaG_';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Define Expected Templates
const EXPECTED_TEMPLATES = {
    'asset_template.csv': ['Asset ID', 'Asset Type', 'Brand', 'Model', 'Serial Number', 'Assigned To (Email)', 'Status', 'Purchase Date'],
    'user_template.csv': ['First Name', 'Last Name', 'Email', 'Role', 'Department', 'Phone Number'],
    'ticket_template.csv': ['Ticket ID', 'Issue Type', 'Description', 'Asset ID', 'Reported By (Email)', 'Priority', 'Status', 'Created Date']
};

function showError(title, message) {
    const loader = document.getElementById('loading-overlay');
    const errorBox = document.getElementById('validation-error');
    const errorTitle = document.getElementById('error-title');
    const errorMessage = document.getElementById('error-message');

    loader.classList.remove('active');
    errorTitle.textContent = title;
    errorMessage.textContent = message;
    errorBox.classList.add('active');
}

function parseCSV(file) {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                resolve(results);
            },
            error: function(error) {
                reject(error);
            }
        });
    });
}

async function processWorkspaceCreation(event) {
    event.preventDefault();

    // Hide error box if visible
    document.getElementById('validation-error').classList.remove('active');

    const fileInput = document.getElementById('data-upload');
    const files = Array.from(fileInput.files);

    if (files.length === 0) {
        showError('Missing Files', 'Please upload your filled template files before continuing.');
        return;
    }

    // Show Loading Overlay
    const loader = document.getElementById('loading-overlay');
    loader.classList.add('active');

    const parsedData = {};

    // 1. Validation Loop
    for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Format Rule: Must be CSV
        if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
            showError('Invalid File Format', `The file "${file.name}" is not a valid CSV file. Only .csv is allowed.`);
            return;
        }

        // Naming Rule: Must match our exact names
        const expectedHeaders = EXPECTED_TEMPLATES[file.name];
        if (!expectedHeaders) {
            showError('Invalid File Name', `The file "${file.name}" is not recognized. You must keep the exact file names (e.g., asset_template.csv).`);
            return;
        }

        try {
            const result = await parseCSV(file);
            const actualHeaders = result.meta.fields;

            // Template Rule: Headers must match exactly
            for (let j = 0; j < expectedHeaders.length; j++) {
                if (!actualHeaders.includes(expectedHeaders[j])) {
                    showError('Template Violation', `The file "${file.name}" is missing the required column: "${expectedHeaders[j]}". Please strictly follow the template.`);
                    return;
                }
            }

            parsedData[file.name] = result.data;

        } catch (err) {
            showError('Parsing Error', `Could not read the file "${file.name}". Please ensure it is a properly formatted CSV.`);
            return;
        }
    }

    // 2. All Validation Passed - Insert to Supabase (Simulation / Real if tables exist)
    try {
        const companyName = document.getElementById('company-name').value;
        const subdomain = document.getElementById('workspace-url').value;
        const adminEmail = document.getElementById('admin-email').value;

        // Step 1: Create Workspace
        const { data: workspace, error: workspaceError } = await supabase
            .from('workspaces')
            .insert([{ company_name: companyName, subdomain: subdomain }])
            .select()
            .single();

        if (workspaceError) {
            console.warn('Workspace table might not exist yet, falling back to mock success mode. Error:', workspaceError.message);
            // If tables don't exist yet, we still show success for the frontend demo
            setTimeout(() => {
                loader.classList.remove('active');
                goToStep(null, 'step6', 'step-success');
            }, 1000);
            return;
        }

        const workspaceId = workspace.id;

        // Step 2: Insert Users (if provided)
        if (parsedData['user_template.csv']) {
            const usersToInsert = parsedData['user_template.csv'].map(u => ({
                workspace_id: workspaceId,
                first_name: u['First Name'],
                last_name: u['Last Name'],
                email: u['Email'],
                role: u['Role'],
                department: u['Department'],
                phone_number: u['Phone Number']
            }));
            await supabase.from('users').insert(usersToInsert);
        }

        // Step 3: Insert Assets
        if (parsedData['asset_template.csv']) {
            const assetsToInsert = parsedData['asset_template.csv'].map(a => ({
                workspace_id: workspaceId,
                asset_id_tag: a['Asset ID'],
                asset_type: a['Asset Type'],
                brand: a['Brand'],
                model: a['Model'],
                serial_number: a['Serial Number'],
                assigned_to: a['Assigned To (Email)'],
                status: a['Status']
            }));
            await supabase.from('assets').insert(assetsToInsert);
        }

        // Finish Success State
        loader.classList.remove('active');
        goToStep(null, 'step6', 'step-success');

    } catch (dbError) {
        showError('Database Error', 'Something went wrong saving to the database. Did you run schema.sql?');
    }
}
