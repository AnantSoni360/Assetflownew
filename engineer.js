// 1. Initialize Supabase
let supabaseClient = null;
try {
    const supabaseUrl = 'https://nphdpclywjsmqowbvegy.supabase.co';
    const supabaseKey = 'sb_publishable_z-wkJgi8fRnyUblLwyu-Fg_v5TlVaG_';
    supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
} catch (e) {
    console.error("Supabase failed to initialize:", e);
}

let currentUser = null;
let allTickets = [];

// 2. Session Management
function checkSession() {
    const session = localStorage.getItem('assetflow_session');
    if (!session) {
        window.location.href = 'login.html';
        return false;
    }
    currentUser = JSON.parse(session);
    
    // Ensure only Engineers access this page
    if (currentUser.role !== 'Engineer') {
        window.location.href = 'login.html';
        return false;
    }

    document.getElementById('sidebar-user-name').textContent = `${currentUser.first_name} ${currentUser.last_name}`;
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
function switchTab(tabId) {
    // Hide all panes
    document.querySelectorAll('.content-pane').forEach(p => p.classList.remove('active'));
    // Deactivate all tabs
    document.querySelectorAll('.menu-item').forEach(t => t.classList.remove('active'));
    
    // Show selected pane
    document.getElementById(`pane-${tabId}`).classList.add('active');
    document.getElementById(`tab-${tabId}`).classList.add('active');
    
    if (tabId === 'overview') {
        renderOverviewWidgets();
    }
}

// 4. Data Fetching
async function loadPortalData() {
    if (!checkSession()) return;
    
    const workspaceId = currentUser.workspace_id;
    const userId = currentUser.id;

    // Fetch Engineer Tickets (Assigned to them OR Unassigned)
    const { data: tickets, error: ticketsError } = await supabaseClient.rpc('get_engineer_tickets', {
        p_user_id: userId,
        p_workspace_id: workspaceId
    });
        
    if (!ticketsError && tickets) {
        allTickets = tickets;
        
        // Calculate Stats
        const myAssigned = tickets.filter(t => t.assigned_to === currentUser.email && t.status !== 'Resolved' && t.status !== 'Closed');
        const unassigned = tickets.filter(t => !t.assigned_to);
        const resolvedToday = tickets.filter(t => t.assigned_to === currentUser.email && (t.status === 'Resolved' || t.status === 'Closed')).length; // Simplified for MVP
        
        document.getElementById('stat-my-tickets').textContent = myAssigned.length;
        document.getElementById('stat-unassigned').textContent = unassigned.length;
        document.getElementById('stat-resolved').textContent = resolvedToday;

        filterTickets();
        renderOverviewWidgets();
    }
}

// 5. Render Tickets Table
function renderTicketsTable(tickets) {
    const tbody = document.getElementById('tickets-table-body');
    if (tickets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No tickets found.</td></tr>';
        return;
    }
    
    tbody.innerHTML = tickets.map(t => {
        let statusBadge = 'badge-gray';
        if (t.status === 'Open') statusBadge = 'badge-yellow';
        else if (t.status === 'In Progress') statusBadge = 'badge-blue';
        else if (t.status === 'Resolved' || t.status === 'Closed') statusBadge = 'badge-green';

        let prioColor = t.priority === 'Critical' ? '#991b1b' : (t.priority === 'High' ? '#c2410c' : 'inherit');
        
        let actionHTML = '';
        if (!t.assigned_to) {
            actionHTML = `<button class="btn btn-secondary btn-small" onclick="claimTicket('${t.id}')">Claim Ticket</button>`;
        } else {
            const isLocked = (t.status === 'Resolved' || t.status === 'Closed');
            actionHTML = `
                <select class="modern-select" style="padding: 0.2rem;" onchange="updateTicketStatus('${t.id}', this.value)" ${isLocked ? 'disabled' : ''}>
                    <option value="Open" ${t.status === 'Open' ? 'selected' : ''}>Open</option>
                    <option value="In Progress" ${t.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                    <option value="Resolved" ${t.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                    <option value="Closed" ${t.status === 'Closed' ? 'selected' : ''}>Closed</option>
                </select>
            `;
        }
        
        return `
            <tr>
                <td><strong>${t.ticket_id_tag}</strong></td>
                <td style="max-width: 320px;">
                    <div style="font-weight: 600; color: #1e293b; margin-bottom: 4px;">${t.issue_type}</div>
                    ${t.description ? `<div style="font-size: 0.85rem; color: #475569; line-height: 1.4; background: #f8fafc; padding: 6px 10px; border-radius: 6px; border-left: 3px solid #3b82f6; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">${t.description}</div>` : `<div style="font-size: 0.8rem; color: #94a3b8; font-style: italic;">No description provided</div>`}
                </td>
                <td>${t.reported_by}</td>
                <td style="color: ${prioColor}; font-weight: ${t.priority === 'Critical' ? 'bold' : 'normal'}">${t.priority}</td>
                <td><span class="badge ${statusBadge}">${t.status}</span></td>
                <td>${actionHTML}</td>
            </tr>
        `;
    }).join('');
}

// 5.1 Filters & Search
let showOnlyUnassigned = false;

function toggleUnassignedFilter() {
    showOnlyUnassigned = !showOnlyUnassigned;
    const btn = document.getElementById('filter-unassigned');
    if (showOnlyUnassigned) {
        btn.classList.add('active');
    } else {
        btn.classList.remove('active');
    }
    filterTickets();
}

function filterTickets() {
    const searchTerm = document.getElementById('ticket-search').value.toLowerCase();
    const statusFilter = document.getElementById('ticket-status-filter').value;
    const priorityFilter = document.getElementById('ticket-priority-filter').value;
    
    const filtered = allTickets.filter(t => {
        // Search
        const matchesSearch = 
            t.ticket_id_tag.toLowerCase().includes(searchTerm) || 
            t.issue_type.toLowerCase().includes(searchTerm) || 
            (t.description && t.description.toLowerCase().includes(searchTerm)) || 
            t.reported_by.toLowerCase().includes(searchTerm);
            
        // Status
        const matchesStatus = statusFilter === 'All' || t.status === statusFilter;
        
        // Priority
        const matchesPriority = priorityFilter === 'All' || t.priority === priorityFilter;
        
        // Unassigned
        const matchesUnassigned = !showOnlyUnassigned || !t.assigned_to;
        
        return matchesSearch && matchesStatus && matchesPriority && matchesUnassigned;
    });
    
    renderTicketsTable(filtered);
}

// 6. Action: Generate Overview Widgets
function renderOverviewWidgets() {
    // Generate Smart To-Do List (Critical tickets assigned to me, or Unassigned Critical tickets)
    const todoList = document.getElementById('todo-list');
    
    // Priority tasks: 
    // 1. My critical open tickets
    // 2. Unassigned critical tickets
    // 3. My high open tickets
    let tasks = [];
    
    const myCritical = allTickets.filter(t => t.assigned_to === currentUser.email && t.priority === 'Critical' && t.status !== 'Resolved' && t.status !== 'Closed');
    tasks = tasks.concat(myCritical.map(t => ({text: `Resolve Critical: ${t.ticket_id_tag} - ${t.issue_type}`, type: 'urgent'})));
    
    const unassignedCritical = allTickets.filter(t => !t.assigned_to && t.priority === 'Critical');
    tasks = tasks.concat(unassignedCritical.map(t => ({text: `Claim Critical: ${t.ticket_id_tag}`, type: 'warning'})));
    
    const myHigh = allTickets.filter(t => t.assigned_to === currentUser.email && t.priority === 'High' && t.status !== 'Resolved' && t.status !== 'Closed');
    tasks = tasks.concat(myHigh.map(t => ({text: `High Priority: ${t.ticket_id_tag}`, type: 'normal'})));
    
    if (tasks.length === 0) {
        todoList.innerHTML = `<div class="empty-state">No urgent tasks. You're caught up! 🎉</div>`;
    } else {
        todoList.innerHTML = tasks.slice(0, 5).map(task => {
            const icon = task.type === 'urgent' ? '🚨' : (task.type === 'warning' ? '⚠️' : '📌');
            const color = task.type === 'urgent' ? '#991b1b' : (task.type === 'warning' ? '#b45309' : '#1e293b');
            return `<div class="action-item" style="color: ${color};"><span class="icon">${icon}</span> ${task.text}</div>`;
        }).join('');
    }
}

// 7. Backend Interactions
async function claimTicket(ticketId) {
    if (!confirm('Claim this ticket?')) return;
    
    try {
        const { error } = await supabaseClient.rpc('engineer_claim_ticket', {
            p_user_id: currentUser.id,
            p_workspace_id: currentUser.workspace_id,
            p_ticket_id: ticketId
        });
        
        if (error) throw error;
        await loadPortalData();
    } catch (err) {
        alert("Failed to claim ticket: " + err.message);
    }
}

async function updateTicketStatus(ticketId, newStatus) {
    try {
        const { error } = await supabaseClient.rpc('engineer_update_ticket_status', {
            p_user_id: currentUser.id,
            p_workspace_id: currentUser.workspace_id,
            p_ticket_id: ticketId,
            p_new_status: newStatus
        });
        
        if (error) throw error;
        await loadPortalData();
    } catch (err) {
        alert("Failed to update status: " + err.message);
        await loadPortalData(); // reset dropdown
    }
}

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
