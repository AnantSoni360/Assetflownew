// 1. Initialize Supabase
let supabaseClient = null;
try {
    const supabaseUrl = 'https://vclwchoyxjbkekmqmkbz.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjbHdjaG95eGpia2VrbXFta2J6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzOTIyNTcsImV4cCI6MjEwNzk2ODI1N30.WucmtpvrwrPAEsHoVbFTmAFUlmdv5NUudiwvI6lF9p8';
    supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
} catch (e) {
    console.error("Supabase failed to initialize:", e);
}

let currentUser = null;

// 2. Session Management
function checkSession() {
    const session = localStorage.getItem('assetflow_session');
    if (!session) {
        window.location.href = 'login.html';
        return false;
    }
    currentUser = JSON.parse(session);
    
    // Ensure only Employees access this page
    if (currentUser.role !== 'Employee') {
        window.location.href = 'login.html';
        return false;
    }

    document.getElementById('user-name-display').textContent = `${currentUser.first_name} ${currentUser.last_name}`;
    document.getElementById('welcome-message').textContent = `Welcome, ${currentUser.first_name}!`;
    document.getElementById('sidebar-company-name').textContent = currentUser.company_name;
    document.getElementById('user-avatar').textContent = currentUser.first_name.charAt(0).toUpperCase();
    
    return true;
}

function logout() {
    localStorage.removeItem('assetflow_session');
    window.location.href = 'login.html';
}

// 3. Tab Switching
function switchTab(tabId, element) {
    // Hide all panes
    document.querySelectorAll('.content-pane').forEach(p => p.classList.remove('active'));
    // Deactivate all tabs
    document.querySelectorAll('.menu-item').forEach(t => t.classList.remove('active'));
    
    // Show selected pane
    document.getElementById(`pane-${tabId}`).classList.add('active');
    
    // Activate selected tab (if element provided, else find it by href/onclick string)
    if(element) {
        element.classList.add('active');
    }
}

// 4. Data Fetching
async function loadPortalData() {
    if (!checkSession()) return;
    
    const workspaceId = currentUser.workspace_id;
    const userId = currentUser.id;

    // Fetch My Tickets
    const { data: tickets, error: ticketsError } = await supabaseClient.rpc('get_employee_tickets', {
        p_user_id: userId,
        p_workspace_id: workspaceId
    });
        
    if (!ticketsError && tickets) {
        renderTicketsTable(tickets);
        const openTickets = tickets.filter(t => t.status !== 'Resolved' && t.status !== 'Closed').length;
        document.getElementById('stat-tickets').textContent = openTickets;
    }

    // Fetch My Assets
    const { data: assets, error: assetsError } = await supabaseClient.rpc('get_employee_assets', {
        p_user_id: userId,
        p_workspace_id: workspaceId
    });
        
    if (!assetsError && assets) {
        renderAssetsTable(assets);
        document.getElementById('stat-assets').textContent = assets.length;
    }
}

// 5. Rendering Functions
function renderTicketsTable(tickets) {
    const tbody = document.getElementById('tickets-table-body');
    if (tickets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">You have no support tickets.</td></tr>';
        return;
    }
    
    tbody.innerHTML = tickets.map(t => {
        let statusBadge = 'badge-gray';
        if (t.status === 'Open') statusBadge = 'badge-yellow';
        else if (t.status === 'In Progress') statusBadge = 'badge-blue';
        else if (t.status === 'Resolved') statusBadge = 'badge-green';

        let prioColor = t.priority === 'Critical' ? '#991b1b' : (t.priority === 'High' ? '#c2410c' : 'inherit');
        
        return `
            <tr>
                <td><strong>${t.ticket_id_tag}</strong></td>
                <td style="max-width: 320px;">
                    <div style="font-weight: 600; color: #1e293b; margin-bottom: 4px;">${t.issue_type}</div>
                    ${t.description ? `<div style="font-size: 0.85rem; color: #475569; line-height: 1.4; background: #f8fafc; padding: 6px 10px; border-radius: 6px; border-left: 3px solid #3b82f6; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">${t.description}</div>` : `<div style="font-size: 0.8rem; color: #94a3b8; font-style: italic;">No description provided</div>`}
                </td>
                <td style="color: ${prioColor}; font-weight: ${t.priority === 'Critical' ? 'bold' : 'normal'}">${t.priority}</td>
                <td><span class="badge ${statusBadge}">${t.status}</span></td>
                <td>${new Date(t.created_at).toLocaleDateString()}</td>
            </tr>
        `;
    }).join('');
}

function renderAssetsTable(assets) {
    const tbody = document.getElementById('assets-table-body');
    if (assets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">You have no assigned assets.</td></tr>';
        return;
    }
    
    tbody.innerHTML = assets.map(a => `
        <tr>
            <td><strong>${a.asset_id_tag}</strong></td>
            <td>${a.asset_type}</td>
            <td>${a.brand} - ${a.model}</td>
            <td>${a.serial_number}</td>
        </tr>
    `).join('');
}

// 6. Raise Ticket Modal Logic
function openRaiseTicketModal() {
    document.getElementById('raiseTicketModal').classList.add('active');
    document.getElementById('ticket-error').style.display = 'none';
}

function closeRaiseTicketModal() {
    document.getElementById('raiseTicketModal').classList.remove('active');
    document.getElementById('raise-ticket-form').reset();
}

// 7. Submit Ticket Form
document.getElementById('raise-ticket-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const issueType = document.getElementById('t-issue').value;
    const priority = document.getElementById('t-priority').value;
    const desc = document.getElementById('t-desc').value;
    
    const btn = document.getElementById('submit-ticket-btn');
    btn.textContent = 'Submitting...';
    btn.disabled = true;
    
    try {
        const { error } = await supabaseClient.rpc('raise_ticket', {
            p_user_id: currentUser.id,
            p_workspace_id: currentUser.workspace_id,
            p_issue_type: issueType,
            p_description: desc,
            p_priority: priority
        });

        if (error) throw error;
        
        closeRaiseTicketModal();
        alert("Ticket submitted successfully!");
        loadPortalData(); // Reload their data
        
    } catch (err) {
        document.getElementById('ticket-error').style.display = 'block';
        document.getElementById('ticket-error-msg').textContent = err.message;
    } finally {
        btn.textContent = 'Submit Ticket';
        btn.disabled = false;
    }
});

// Initialize on page load
window.onload = () => {
    loadPortalData();
    
    // Real-Time Subscription
    supabaseClient
        .channel('public:tickets')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, payload => {
            console.log('Real-Time update received!', payload);
            loadPortalData(); // Refresh UI instantly
        })
        .subscribe();
};

// ==========================================
// ACCOUNT SETTINGS: CHANGE PASSWORD ENGINE
// ==========================================
function openPasswordModal() {
    const modal = document.getElementById('change-password-modal');
    if (modal) {
        document.getElementById('current-password-input').value = '';
        document.getElementById('new-password-input').value = '';
        document.getElementById('confirm-new-password-input').value = '';
        document.getElementById('pw-change-error').style.display = 'none';
        document.getElementById('pw-change-success').style.display = 'none';
        modal.classList.add('active');
        document.getElementById('current-password-input').focus();
    }
}

function closePasswordModal() {
    const modal = document.getElementById('change-password-modal');
    if (modal) modal.classList.remove('active');
}

async function handlePasswordChange(e) {
    e.preventDefault();
    const currentPw = document.getElementById('current-password-input').value.trim();
    const newPw = document.getElementById('new-password-input').value.trim();
    const confirmNewPw = document.getElementById('confirm-new-password-input').value.trim();
    
    const errorDiv = document.getElementById('pw-change-error');
    const errorMsg = document.getElementById('pw-change-error-msg');
    const successDiv = document.getElementById('pw-change-success');
    const saveBtn = document.getElementById('save-password-btn');

    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';

    // 1. Validate password length and matching
    if (newPw.length < 6) {
        errorDiv.style.display = 'block';
        errorMsg.textContent = 'For security, your new password must be at least 6 characters long.';
        return;
    }

    if (newPw !== confirmNewPw) {
        errorDiv.style.display = 'block';
        errorMsg.textContent = 'New Password and Confirm New Password do not match! Please enter the exact same password in both fields.';
        return;
    }

    if (currentPw === newPw) {
        errorDiv.style.display = 'block';
        errorMsg.textContent = 'Your new password cannot be exactly the same as your current password!';
        return;
    }

    if (!currentUser || !currentUser.id || !currentUser.workspace_id) {
        errorDiv.style.display = 'block';
        errorMsg.textContent = 'User session error. Please log in again to change your password.';
        return;
    }

    // 2. Perform backend verification and update in Supabase
    saveBtn.textContent = 'Verifying & Updating...';
    saveBtn.disabled = true;

    try {
        // First attempt using custom secure RPC
        const { data: rpcSuccess, error: rpcErr } = await supabaseClient.rpc('change_user_password', {
            p_user_id: currentUser.id,
            p_workspace_id: currentUser.workspace_id,
            p_current_password: currentPw,
            p_new_password: newPw
        });

        if (!rpcErr && rpcSuccess === false) {
            errorDiv.style.display = 'block';
            errorMsg.textContent = '❌ Incorrect Current Password! The current password you entered does not match your active account password in Supabase.';
            saveBtn.textContent = 'Save New Password';
            saveBtn.disabled = false;
            return;
        }

        if (rpcErr || rpcSuccess === undefined) {
            // Fallback to direct table query (works automatically without requiring manual SQL creation)
            const { data: userData, error: fetchErr } = await supabaseClient
                .from('users')
                .select('id, password')
                .eq('id', currentUser.id)
                .eq('workspace_id', currentUser.workspace_id)
                .single();

            if (fetchErr || !userData) {
                throw new Error(fetchErr ? fetchErr.message : 'Could not locate your user record in Supabase.');
            }

            if (userData.password !== currentPw) {
                errorDiv.style.display = 'block';
                errorMsg.textContent = '❌ Incorrect Current Password! The current password you entered does not match your active account password in Supabase.';
                saveBtn.textContent = 'Save New Password';
                saveBtn.disabled = false;
                return;
            }

            // Perform Supabase update!
            const { error: updateErr } = await supabaseClient
                .from('users')
                .update({ password: newPw })
                .eq('id', currentUser.id)
                .eq('workspace_id', currentUser.workspace_id);

            if (updateErr) {
                throw new Error(updateErr.message);
            }
        }

        // 3. Update Success!
        successDiv.style.display = 'block';
        document.getElementById('current-password-input').value = '';
        document.getElementById('new-password-input').value = '';
        document.getElementById('confirm-new-password-input').value = '';
        
        console.log(`[Supabase Auth] Password successfully updated for ${currentUser.email} in workspace ${currentUser.workspace_id}`);

        setTimeout(() => {
            closePasswordModal();
            alert("🔒 Your password has been updated in Supabase! Your old password no longer works; please use your new password next time you log in.");
        }, 1500);

    } catch (err) {
        console.error("Password change failure:", err);
        errorDiv.style.display = 'block';
        errorMsg.textContent = 'Failed to update password: ' + (err.message || err);
    } finally {
        saveBtn.textContent = 'Save New Password';
        saveBtn.disabled = false;
    }
}
