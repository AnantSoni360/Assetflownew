// 1. Supabase Initialization
let supabaseClient = null;
try {
    const supabaseUrl = 'https://nphdpclywjsmqowbvegy.supabase.co';
    const supabaseKey = 'sb_publishable_z-wkJgi8fRnyUblLwyu-Fg_v5TlVaG_';
    supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
} catch (e) {
    console.error("Supabase failed to initialize:", e);
}

// 2. Authentication & Session Check
let currentUser = null;

function checkSession() {
    const sessionData = localStorage.getItem('assetflow_session');
    if (!sessionData) {
        window.location.href = 'login.html';
        return false;
    }
    
    currentUser = JSON.parse(sessionData);
    
    // UI Updates
    document.getElementById('sidebar-user-name').textContent = `${currentUser.first_name} ${currentUser.last_name}`;
    document.getElementById('sidebar-company-name').textContent = currentUser.company_name;
    document.getElementById('user-avatar').textContent = currentUser.first_name.charAt(0).toUpperCase();
    
    // Role-based UI updates
    if (currentUser.role === 'Engineer') {
        const usersTab = document.getElementById('tab-users');
        if (usersTab) usersTab.style.display = 'none';
    }
    
    return true;
}

function logout() {
    localStorage.removeItem('assetflow_session');
    window.location.href = 'login.html';
}

// 3. UI Tab Switching logic
function switchTab(tabId) {
    // Role-based access control for tabs
    if (tabId === 'users' && currentUser && currentUser.role === 'Engineer') {
        alert("Access Denied: Engineers cannot view or manage users.");
        return;
    }

    // Hide all panes
    document.querySelectorAll('.content-pane').forEach(p => p.classList.remove('active'));
    // Deactivate all tabs
    document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
    
    // Activate selected
    document.getElementById(`pane-${tabId}`).classList.add('active');
    document.getElementById(`tab-${tabId}`).classList.add('active');
    
    // Update Header
    const titles = {
        'overview': 'Overview',
        'tickets': 'Tickets',
        'assets': 'Assets',
        'users': 'Users'
    };
    document.getElementById('header-title').textContent = titles[tabId];
}

// 4. Data Fetching
let engineersCache = [];
let allUsersCache = [];
let allTickets = [];

async function loadDashboardData() {
    if (!checkSession()) return;
    
    const workspaceId = currentUser.workspace_id;

    // Fetch Users (to get engineers for assignment dropdown, and populate Users tab)
    const { data: users, error: usersError } = await supabaseClient.rpc('get_secure_users', {
        p_user_id: currentUser.id,
        p_workspace_id: workspaceId
    });
        
    if (!usersError && users) {
        engineersCache = users.filter(u => u.role === 'Engineer');
        allUsersCache = users;
        renderUsersTable(users);
        document.getElementById('stat-users').textContent = users.length;
    }

    // Fetch Assets
    const { data: assets, error: assetsError } = await supabaseClient.rpc('get_secure_assets', {
        p_user_id: currentUser.id,
        p_workspace_id: workspaceId
    });
        
    if (!assetsError && assets) {
        renderAssetsTable(assets);
        document.getElementById('stat-assets').textContent = assets.length;
    }

    // Fetch Tickets
    const { data: tickets, error: ticketsError } = await supabaseClient.rpc('get_secure_tickets', {
        p_user_id: currentUser.id,
        p_workspace_id: workspaceId
    });
        
    if (!ticketsError && tickets) {
        allTickets = tickets;
        renderTicketsTable(allTickets);
        const openTickets = allTickets.filter(t => t.status !== 'Resolved' && t.status !== 'Closed').length;
        document.getElementById('stat-tickets').textContent = openTickets;
        
        // Generate dynamic overview widgets
        renderOverviewWidgets(tickets);
    }
}

// 5. Render Functions
function renderAssetsTable(assets) {
    const tbody = document.getElementById('assets-table-body');
    if (assets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No assets found.</td></tr>';
        return;
    }
    
    tbody.innerHTML = assets.map(a => {
        // Assignment Dropdown
        let assignSelect = `<select class="assign-select" onchange="assignAsset('${a.id}', this.value)">`;
        assignSelect += `<option value="">Unassigned</option>`;
        allUsersCache.forEach(u => {
            const selected = a.assigned_to === u.email ? 'selected' : '';
            assignSelect += `<option value="${u.email}" ${selected}>${u.first_name} ${u.last_name}</option>`;
        });
        assignSelect += `</select>`;

        return `
            <tr>
                <td><strong>${a.asset_id_tag}</strong></td>
                <td>${a.asset_type}</td>
                <td>${a.brand} - ${a.model}</td>
                <td>${a.serial_number}</td>
                <td>${assignSelect}</td>
                <td><span class="badge ${a.status === 'Active' ? 'badge-green' : 'badge-gray'}">${a.status}</span></td>
                <td>${a.purchase_date || 'N/A'}</td>
            </tr>
        `;
    }).join('');
}

function renderUsersTable(users) {
    const tbody = document.getElementById('users-table-body');
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No users found.</td></tr>';
        return;
    }
    
    tbody.innerHTML = users.map(u => `
        <tr>
            <td style="font-weight: 600;">${u.first_name} ${u.last_name}</td>
            <td>${u.email}</td>
            <td><span class="badge badge-gray">${u.role}</span></td>
            <td>${u.department}</td>
        </tr>
    `).join('');
}

function renderTicketsTable(tickets) {
    const tbody = document.getElementById('tickets-table-body');
    if (tickets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No tickets found.</td></tr>';
        return;
    }
    
    // Generate Engineer Dropdown Options
    const engineerOptions = engineersCache.map(e => `<option value="${e.email}">${e.first_name} ${e.last_name}</option>`).join('');

    tbody.innerHTML = tickets.map(t => {
        
        let statusBadge = 'badge-gray';
        if(t.status === 'Resolved' || t.status === 'Closed') statusBadge = 'badge-green';
        if(t.status === 'In Progress') statusBadge = 'badge-blue';
        if(t.status === 'Open') statusBadge = 'badge-yellow';
        if(t.priority === 'Critical') statusBadge = 'badge-red'; // Override color if critical
        
        // Build the assignment dropdown for this specific ticket
        const isLocked = (t.status === 'Resolved' || t.status === 'Closed');
        const assignSelect = `
            <select class="assign-select" onchange="assignTicket('${t.id}', this.value)" ${isLocked ? 'disabled' : ''}>
                <option value="">Unassigned</option>
                ${engineersCache.map(e => `<option value="${e.email}" ${t.assigned_to === e.email ? 'selected' : ''}>${e.first_name} ${e.last_name}</option>`).join('')}
            </select>
        `;

        return `
            <tr>
                <td style="font-weight: 600;">${t.ticket_id_tag}</td>
                <td style="max-width: 320px;">
                    <div style="font-weight: 600; color: #1e293b; margin-bottom: 4px;">${t.issue_type}</div>
                    ${t.description ? `<div style="font-size: 0.85rem; color: #475569; line-height: 1.4; background: #f8fafc; padding: 6px 10px; border-radius: 6px; border-left: 3px solid #3b82f6; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">${t.description}</div>` : `<div style="font-size: 0.8rem; color: #94a3b8; font-style: italic;">No description provided</div>`}
                </td>
                <td>${t.reported_by}</td>
                <td><span class="badge ${t.priority === 'Critical' ? 'badge-red' : 'badge-gray'}">${t.priority}</span></td>
                <td><span class="badge ${statusBadge}">${t.status}</span></td>
                <td>${assignSelect}</td>
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
let ticketChart = null;

function renderOverviewWidgets(tickets) {
    // A. Generate Chart
    const statusCounts = { 'Open': 0, 'In Progress': 0, 'Resolved': 0, 'Closed': 0 };
    tickets.forEach(t => {
        if(statusCounts[t.status] !== undefined) statusCounts[t.status]++;
    });

    const ctx = document.getElementById('ticketStatusChart').getContext('2d');
    if (ticketChart) ticketChart.destroy();
    
    ticketChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Open', 'In Progress', 'Resolved', 'Closed'],
            datasets: [{
                data: [statusCounts['Open'], statusCounts['In Progress'], statusCounts['Resolved'], statusCounts['Closed']],
                backgroundColor: ['#fef08a', '#bfdbfe', '#bbf7d0', '#e2e8f0'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { position: 'right' }
            }
        }
    });

    // B. Generate Notifications (Top 5 Recent Tickets)
    const notifList = document.getElementById('notification-list');
    const recent = tickets.slice(0, 5); // Already sorted DESC by created_at in SQL
    
    if (recent.length === 0) {
        notifList.innerHTML = '<div class="empty-state">No recent activity</div>';
    } else {
        notifList.innerHTML = recent.map(t => {
            const timeStr = new Date(t.created_at).toLocaleDateString();
            return `
                <div class="notification-item">
                    <div class="notification-time">${timeStr}</div>
                    <div class="notification-text">
                        <strong>${t.reported_by}</strong> reported a ${t.priority.toLowerCase()} issue: <em>${t.issue_type}</em>
                        ${t.description ? `<div style="font-size: 0.8rem; color: #475569; margin-top: 4px; background: #f8fafc; padding: 4px 8px; border-radius: 4px; border-left: 2px solid #3b82f6;">"${t.description}"</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    // C. Generate Smart To-Do List
    const todoList = document.getElementById('todo-list');
    let todos = [];

    // Rule 1: Unassigned active tickets
    const unassigned = tickets.filter(t => (t.status === 'Open' || t.status === 'In Progress') && !t.assigned_to);
    unassigned.forEach(t => {
        todos.push({
            urgent: t.priority === 'Critical',
            icon: '🧑‍💻',
            text: `<strong>Needs Engineer:</strong> Ticket <a href="#" onclick="switchTab('tickets')" style="color:inherit">${t.ticket_id_tag}</a> is unassigned.`
        });
    });

    // Rule 2: Critical active tickets
    const critical = tickets.filter(t => t.priority === 'Critical' && t.status !== 'Resolved' && t.status !== 'Closed');
    critical.forEach(t => {
        todos.push({
            urgent: true,
            icon: '🚨',
            text: `<strong>High Priority:</strong> Please review and resolve <a href="#" onclick="switchTab('tickets')" style="color:inherit">${t.ticket_id_tag}</a>.`
        });
    });

    if (todos.length === 0) {
        todoList.innerHTML = `
            <div class="action-item" style="border-left-color: #10b981; background: #dcfce7;">
                <div class="action-icon">🎉</div>
                <div class="action-text"><strong>All caught up!</strong> No urgent action items.</div>
            </div>`;
    } else {
        // Sort urgent first
        todos.sort((a,b) => (a.urgent === b.urgent) ? 0 : a.urgent ? -1 : 1);
        
        todoList.innerHTML = todos.slice(0,6).map(todo => `
            <div class="action-item ${todo.urgent ? 'urgent' : ''}">
                <div class="action-icon">${todo.icon}</div>
                <div class="action-text">${todo.text}</div>
            </div>
        `).join('');
    }
}

// 7. Action: Assign Ticket
async function assignTicket(ticketId, assigneeEmail) {
    // Only update if they have permissions
    const { error } = await supabaseClient.rpc('secure_assign_ticket', {
        p_user_id: currentUser.id,
        p_workspace_id: currentUser.workspace_id,
        p_ticket_id: ticketId,
        p_assignee_email: assigneeEmail || null
    });
        
    if (error) {
        alert("Failed to assign ticket: " + error.message);
        loadDashboardData(); // reload original data to reset dropdown
    } else {
        console.log("Ticket assigned to", assigneeEmail);
    }
}

// 8. Action: Assign Asset
async function assignAsset(assetId, assigneeEmail) {
    const { error } = await supabaseClient.rpc('secure_assign_asset', {
        p_user_id: currentUser.id,
        p_workspace_id: currentUser.workspace_id,
        p_asset_id: assetId,
        p_assignee_email: assigneeEmail || null
    });
        
    if (error) {
        alert("Failed to assign asset: " + error.message);
    } else {
        // Reload dashboard to reflect changes
        loadDashboardData();
    }
}

// 7. Action: Add User Modal Logic
function openAddUserModal() {
    document.getElementById('addUserModal').classList.add('active');
    document.getElementById('add-user-error').style.display = 'none';
}

function closeAddUserModal() {
    document.getElementById('addUserModal').classList.remove('active');
    document.getElementById('add-user-form').reset();
}

document.getElementById('add-user-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const errorDiv = document.getElementById('add-user-error');
    const errorMsg = document.getElementById('add-user-error-msg');
    const btn = e.target.querySelector('button');
    
    errorDiv.style.display = 'none';
    btn.textContent = 'Creating...';
    btn.disabled = true;
    
    const newUser = {
        workspace_id: currentUser.workspace_id,
        first_name: document.getElementById('new-user-first').value.trim(),
        last_name: document.getElementById('new-user-last').value.trim(),
        email: document.getElementById('new-user-email').value.trim(),
        password: document.getElementById('new-user-password').value,
        role: document.getElementById('new-user-role').value,
        department: document.getElementById('new-user-dept').value.trim(),
        phone_number: ''
    };
    
    const { error } = await supabaseClient.from('users').insert([newUser]);
    
    if (error) {
        errorDiv.style.display = 'block';
        errorMsg.textContent = error.message;
        btn.textContent = 'Create User';
        btn.disabled = false;
    } else {
        closeAddUserModal();
        loadDashboardData(); // Refresh table and stats
        btn.textContent = 'Create User';
        btn.disabled = false;
    }
});

// Start
document.addEventListener('DOMContentLoaded', () => {
    loadDashboardData();
    
    // Real-Time Subscription
    supabaseClient
        .channel('public:tickets')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, payload => {
            console.log('Real-Time update received!', payload);
            loadDashboardData(); // Refresh UI instantly
        })
        .subscribe();
});
