// API endpoints
const STAFF_API = '/api/staff';
const UNIFORMS_API = '/api/uniforms';

// Flash message function
function showFlashMessage(message, type = 'success') {
    const flashContainer = document.getElementById('flash-messages');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    flashContainer.appendChild(alert);
    setTimeout(() => alert.remove(), 5000);
}

let allStaff = [];
let sortField = null;
let sortDirection = 1; // 1 for ascending, -1 for descending
let expandedStaffIds = new Set();

function sortStaff(staff, field) {
    return staff.slice().sort((a, b) => {
        let aValue = a[field] ? a[field].toLowerCase() : '';
        let bValue = b[field] ? b[field].toLowerCase() : '';
        if (aValue < bValue) return -1 * sortDirection;
        if (aValue > bValue) return 1 * sortDirection;
        return 0;
    });
}

// Helper to sort staff by name alphabetically
function sortStaffByNameAlpha(staff) {
    return staff.slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

// Load staff list with their assignments
async function loadStaffList() {
    try {
        const response = await fetch(`${STAFF_API}/with-assignments`);
        const staff = await response.json();
        allStaff = staff; // Store the full list for filtering
        // Always sort by name alphabetically by default
        renderStaffList(sortStaffByNameAlpha(staff));
    } catch (error) {
        showFlashMessage(error.message, 'danger');
    }
}

function renderStaffList(staff) {
    const staffList = document.getElementById('staffList');
    staffList.innerHTML = '';
    for (const person of staff) {
        const activeAssignments = (person.assignments || []).filter(a => a.status === 'assigned');
        const isExpanded = expandedStaffIds.has(person.id);
        // Row for staff info
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                ${person.name}
                ${activeAssignments.length > 0 ? `<button class="btn btn-link btn-sm p-0 ms-2 staff-toggle" data-staff-id="${person.id}" title="Toggle uniforms"><i class="bi bi-chevron-${isExpanded ? 'down' : 'right'}"></i></button>` : ''}
            </td>
            <td>${person.department}</td>
            <td>${activeAssignments.length > 0 && isExpanded ? activeAssignments[0].uniform_type : '-'}</td>
            <td>${activeAssignments.length > 0 && isExpanded ? activeAssignments[0].uniform_size : '-'}</td>
            <td>${activeAssignments.length > 0 && isExpanded ? activeAssignments[0].uniform_color : '-'}</td>
            <td>${activeAssignments.length > 0 && isExpanded ? `<button class="btn btn-stock-action btn-sm" onclick="showReturnModal(${activeAssignments[0].assignment_id})" title="Return Uniform"><i class="bi bi-box-arrow-in-left"></i></button>` : '-'}</td>
            <td>
                <div class="d-flex gap-2">
                    <button class="btn btn-stock-action btn-sm" onclick="showAssignModal(${person.id})" title="Assign Uniform"><i class="bi bi-plus-circle"></i></button>
                    <button class="btn btn-stock-action btn-sm" onclick="deleteStaff(${person.id})" title="Delete Staff"><i class="bi bi-trash"></i></button>
                </div>
            </td>
        `;
        staffList.appendChild(row);
        // Additional rows for other assignments if expanded
        if (isExpanded && activeAssignments.length > 1) {
            for (let i = 1; i < activeAssignments.length; i++) {
                const a = activeAssignments[i];
                const assignRow = document.createElement('tr');
                assignRow.innerHTML = `
                    <td></td>
                    <td></td>
                    <td>${a.uniform_type}</td>
                    <td>${a.uniform_size}</td>
                    <td>${a.uniform_color}</td>
                    <td><button class="btn btn-stock-action btn-sm" onclick="showReturnModal(${a.assignment_id})" title="Return Uniform"><i class="bi bi-box-arrow-in-left"></i></button></td>
                    <td></td>
                `;
                staffList.appendChild(assignRow);
            }
        }
    }
    // Initialize tooltips after the staff list is loaded
    const tooltips = document.querySelectorAll('[title]');
    tooltips.forEach(el => {
        new bootstrap.Tooltip(el, {
            trigger: 'hover',
            placement: 'top'
        });
    });
    // Add toggle event listeners
    document.querySelectorAll('.staff-toggle').forEach(btn => {
        btn.addEventListener('click', function() {
            const staffId = parseInt(this.getAttribute('data-staff-id'));
            if (expandedStaffIds.has(staffId)) {
                expandedStaffIds.delete(staffId);
            } else {
                expandedStaffIds.add(staffId);
            }
            renderStaffList(staff);
        });
    });
    updateToggleAllStaffBtn();
}

document.getElementById('sortName').addEventListener('click', function() {
    if (sortField === 'name') {
        sortDirection *= -1;
    } else {
        sortField = 'name';
        sortDirection = 1;
    }
    const searchValue = document.getElementById('staffSearch').value.trim().toLowerCase();
    let filtered = allStaff;
    if (searchValue) {
        filtered = allStaff.filter(person => person.name.toLowerCase().includes(searchValue));
    }
    renderStaffList(sortStaff(filtered, 'name'));
});

document.getElementById('sortDepartment').addEventListener('click', function() {
    if (sortField === 'department') {
        sortDirection *= -1;
    } else {
        sortField = 'department';
        sortDirection = 1;
    }
    const searchValue = document.getElementById('staffSearch').value.trim().toLowerCase();
    let filtered = allStaff;
    if (searchValue) {
        filtered = allStaff.filter(person => person.name.toLowerCase().includes(searchValue));
    }
    renderStaffList(sortStaff(filtered, 'department'));
});

// Update search filter to respect current sort
const staffSearchInput = document.getElementById('staffSearch');
staffSearchInput.addEventListener('input', function() {
    const searchValue = this.value.trim().toLowerCase();
    let filtered = allStaff.filter(person => person.name.toLowerCase().includes(searchValue));
    if (sortField) {
        filtered = sortStaff(filtered, sortField);
    }
    renderStaffList(filtered);
});

// Custom dropdown for uniform search
let uniformDropdownOptions = [];

async function loadAvailableUniforms() {
    try {
        const response = await fetch(UNIFORMS_API);
        const uniforms = await response.json();
        const availableUniforms = uniforms.filter(u => u.current_stock > 0);
        window._availableUniforms = availableUniforms;
        uniformDropdownOptions = availableUniforms.map(u => ({
            id: u.id,
            label: `${u.type} (${u.size}, ${u.color}) - ${u.current_stock} in stock`,
        }));
    } catch (error) {
        showFlashMessage(error.message, 'danger');
    }
}

function showCustomDropdown(filteredOptions) {
    const dropdown = document.getElementById('customUniformDropdown');
    dropdown.innerHTML = '';
    if (filteredOptions.length === 0) {
        dropdown.style.display = 'none';
        return;
    }
    filteredOptions.forEach((option, idx) => {
        const div = document.createElement('div');
        div.className = 'custom-dropdown-item';
        div.textContent = option.label;
        div.dataset.id = option.id;
        div.tabIndex = 0;
        div.addEventListener('mousedown', function(e) {
            e.preventDefault();
            selectUniformOption(option);
        });
        dropdown.appendChild(div);
    });
    dropdown.style.display = 'block';
}

function hideCustomDropdown() {
    const dropdown = document.getElementById('customUniformDropdown');
    dropdown.style.display = 'none';
}

function selectUniformOption(option) {
    document.getElementById('uniformInput').value = option.label;
    document.getElementById('uniformInput').dataset.selectedId = option.id;
    hideCustomDropdown();
}

const uniformInput = document.getElementById('uniformInput');
uniformInput.addEventListener('input', function() {
    const value = this.value.trim().toLowerCase();
    const filtered = uniformDropdownOptions.filter(opt => opt.label.toLowerCase().includes(value));
    showCustomDropdown(filtered);
    this.dataset.selectedId = '';
});

uniformInput.addEventListener('focus', function() {
    const value = this.value.trim().toLowerCase();
    const filtered = uniformDropdownOptions.filter(opt => opt.label.toLowerCase().includes(value));
    showCustomDropdown(filtered);
});

uniformInput.addEventListener('blur', function() {
    setTimeout(hideCustomDropdown, 150);
});

// Keyboard navigation
uniformInput.addEventListener('keydown', function(e) {
    const dropdown = document.getElementById('customUniformDropdown');
    const items = Array.from(dropdown.querySelectorAll('.custom-dropdown-item'));
    let idx = items.findIndex(item => item.classList.contains('active'));
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (items.length) {
            if (idx >= 0) items[idx].classList.remove('active');
            idx = (idx + 1) % items.length;
            items[idx].classList.add('active');
            items[idx].scrollIntoView({ block: 'nearest' });
        }
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (items.length) {
            if (idx >= 0) items[idx].classList.remove('active');
            idx = (idx - 1 + items.length) % items.length;
            items[idx].classList.add('active');
            items[idx].scrollIntoView({ block: 'nearest' });
        }
    } else if (e.key === 'Enter') {
        if (idx >= 0 && items[idx]) {
            e.preventDefault();
            items[idx].dispatchEvent(new Event('mousedown'));
        }
    }
});

// Show assign uniform modal
function showAssignModal(staffId) {
    document.getElementById('assignStaffId').value = staffId;
    loadAvailableUniforms();
    const modal = new bootstrap.Modal(document.getElementById('assignUniformModal'));
    modal.show();
}

// Show return uniform modal
function showReturnModal(assignmentId) {
    document.getElementById('returnAssignmentId').value = assignmentId;
    const modal = new bootstrap.Modal(document.getElementById('returnUniformModal'));
    modal.show();
}

// Custom dropdown for department search
const departmentOptions = [
    'Bartender', 'Captain', 'Chef', 'Cruise Director', 'Deck Crew', 'Dhoni Captain',
    'Dhoni Crew', 'Dive', 'Engineer', 'Freelance', 'Housekeeping', 'Spa Therapist', 'Waiter', 'Other'
];

function showDepartmentDropdown(filteredOptions) {
    const dropdown = document.getElementById('customDepartmentDropdown');
    dropdown.innerHTML = '';
    if (filteredOptions.length === 0) {
        dropdown.style.display = 'none';
        return;
    }
    filteredOptions.forEach(option => {
        const div = document.createElement('div');
        div.className = 'custom-dropdown-item';
        div.textContent = option;
        div.tabIndex = 0;
        div.addEventListener('mousedown', function(e) {
            e.preventDefault();
            selectDepartmentOption(option);
        });
        dropdown.appendChild(div);
    });
    dropdown.style.display = 'block';
}

function hideDepartmentDropdown() {
    const dropdown = document.getElementById('customDepartmentDropdown');
    dropdown.style.display = 'none';
}

function selectDepartmentOption(option) {
    document.getElementById('departmentInput').value = option;
    hideDepartmentDropdown();
}

const departmentInput = document.getElementById('departmentInput');
departmentInput.addEventListener('input', function() {
    const value = this.value.trim().toLowerCase();
    const filtered = departmentOptions.filter(opt => opt.toLowerCase().includes(value));
    showDepartmentDropdown(filtered);
});
departmentInput.addEventListener('focus', function() {
    const value = this.value.trim().toLowerCase();
    const filtered = departmentOptions.filter(opt => opt.toLowerCase().includes(value));
    showDepartmentDropdown(filtered);
});
departmentInput.addEventListener('blur', function() {
    setTimeout(hideDepartmentDropdown, 150);
});
departmentInput.addEventListener('keydown', function(e) {
    const dropdown = document.getElementById('customDepartmentDropdown');
    const items = Array.from(dropdown.querySelectorAll('.custom-dropdown-item'));
    let idx = items.findIndex(item => item.classList.contains('active'));
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (items.length) {
            if (idx >= 0) items[idx].classList.remove('active');
            idx = (idx + 1) % items.length;
            items[idx].classList.add('active');
            items[idx].scrollIntoView({ block: 'nearest' });
        }
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (items.length) {
            if (idx >= 0) items[idx].classList.remove('active');
            idx = (idx - 1 + items.length) % items.length;
            items[idx].classList.add('active');
            items[idx].scrollIntoView({ block: 'nearest' });
        }
    } else if (e.key === 'Enter') {
        if (idx >= 0 && items[idx]) {
            e.preventDefault();
            items[idx].dispatchEvent(new Event('mousedown'));
        }
    }
});

// Update add staff form submission to use departmentInput value
const addStaffForm = document.getElementById('addStaffForm');
addStaffForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const name = document.getElementById('staffName').value.trim();
        const department = document.getElementById('departmentInput').value.trim();
        if (!departmentOptions.includes(department)) {
            showFlashMessage('Please select a valid department from the list.', 'danger');
            return;
        }
        // Prevent duplicate staff (same name and department)
        const duplicate = allStaff.some(staff => staff.name.trim().toLowerCase() === name.toLowerCase() && staff.department.trim().toLowerCase() === department.toLowerCase());
        if (duplicate) {
            showFlashMessage('A staff member with the same name and department already exists.', 'danger');
            return;
        }
        const response = await fetch(STAFF_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, department })
        });

        if (!response.ok) {
            throw new Error('Failed to add staff member');
        }

        const result = await response.json();
        showFlashMessage('Staff member added successfully');
        bootstrap.Modal.getInstance(document.getElementById('addStaffModal')).hide();
        addStaffForm.reset();
        loadStaffList();
    } catch (error) {
        showFlashMessage(error.message, 'danger');
    }
});

// Assign uniform (update to use selectedId)
document.getElementById('assignUniformForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const selectedId = document.getElementById('uniformInput').dataset.selectedId;
        if (!selectedId) {
            showFlashMessage('Please select a valid uniform from the list.', 'danger');
            return;
        }
        const response = await fetch(`${STAFF_API}/assign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                staff_id: parseInt(document.getElementById('assignStaffId').value),
                uniform_id: parseInt(selectedId)
            })
        });

        if (!response.ok) {
            throw new Error('Failed to assign uniform');
        }

        showFlashMessage('Uniform assigned successfully');
        bootstrap.Modal.getInstance(document.getElementById('assignUniformModal')).hide();
        document.getElementById('assignUniformForm').reset();
        loadStaffList();
    } catch (error) {
        showFlashMessage(error.message, 'danger');
    }
});

// Return uniform
document.getElementById('returnUniformForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const assignmentId = document.getElementById('returnAssignmentId').value;
        const status = document.querySelector('input[name="returnStatus"]:checked').value;
        const notes = document.getElementById('returnNotes').value.trim();

        // Add warning if discarding without notes
        if (status === 'discarded' && !notes) {
            if (!confirm('Warning: You are discarding a uniform without providing any notes. Would you like to continue?')) {
                return;
            }
        }

        const response = await fetch(`${STAFF_API}/return/${assignmentId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                status,
                notes: notes || null  // Send null if notes is empty
            })
        });

        if (!response.ok) {
            throw new Error('Failed to return uniform');
        }

        showFlashMessage('Uniform returned successfully');
        bootstrap.Modal.getInstance(document.getElementById('returnUniformModal')).hide();
        document.getElementById('returnUniformForm').reset();
        loadStaffList();
    } catch (error) {
        showFlashMessage(error.message, 'danger');
    }
});

// Delete staff member
async function deleteStaff(staffId) {
    if (!confirm('Are you sure you want to delete this staff member? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch(`${STAFF_API}/${staffId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Failed to delete staff member');
        }

        showFlashMessage('Staff member deleted successfully');
        loadStaffList();
    } catch (error) {
        showFlashMessage(error.message, 'danger');
    }
}

// Export to CSV
document.getElementById('exportCsvBtn').addEventListener('click', async () => {
    try {
        const response = await fetch(`${STAFF_API}/export`);
        if (!response.ok) {
            throw new Error('Failed to export data');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'staff_assignments.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showFlashMessage('Export completed successfully');
    } catch (error) {
        showFlashMessage(error.message, 'danger');
    }
});

function areAllStaffExpanded() {
    return allStaff.every(person => (person.assignments || []).some(a => a.status === 'assigned') ? expandedStaffIds.has(person.id) : true);
}

document.getElementById('toggleAllStaffBtn').addEventListener('click', function() {
    const expand = !areAllStaffExpanded();
    allStaff.forEach(person => {
        if ((person.assignments || []).some(a => a.status === 'assigned')) {
            if (expand) {
                expandedStaffIds.add(person.id);
            } else {
                expandedStaffIds.delete(person.id);
            }
        }
    });
    renderStaffList(sortField ? sortStaff(allStaff, sortField) : sortStaffByNameAlpha(allStaff));
    updateToggleAllStaffBtn();
});

function updateToggleAllStaffBtn() {
    const expand = !areAllStaffExpanded();
    document.getElementById('toggleAllStaffIcon').className = expand ? 'bi bi-arrows-angle-expand' : 'bi bi-arrows-angle-contract';
    document.getElementById('toggleAllStaffText').textContent = expand ? 'Expand All' : 'Collapse All';
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadStaffList();
}); 