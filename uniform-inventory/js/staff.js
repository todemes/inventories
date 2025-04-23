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

function sortStaff(staff, field) {
    return staff.slice().sort((a, b) => {
        let aValue = a[field] ? a[field].toLowerCase() : '';
        let bValue = b[field] ? b[field].toLowerCase() : '';
        if (aValue < bValue) return -1 * sortDirection;
        if (aValue > bValue) return 1 * sortDirection;
        return 0;
    });
}

// Load staff list with their assignments
async function loadStaffList() {
    try {
        const response = await fetch(`${STAFF_API}/with-assignments`);
        const staff = await response.json();
        allStaff = staff; // Store the full list for filtering
        renderStaffList(staff);
    } catch (error) {
        showFlashMessage(error.message, 'danger');
    }
}

function renderStaffList(staff) {
    const staffList = document.getElementById('staffList');
    staffList.innerHTML = '';
    for (const person of staff) {
        const activeAssignments = (person.assignments || []).filter(a => a.status === 'assigned');
        // Create a row for each assigned uniform
        if (activeAssignments.length > 0) {
            activeAssignments.forEach((assignment, index) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${index === 0 ? person.name : ''}</td>
                    <td>${index === 0 ? person.department : ''}</td>
                    <td>${assignment.uniform_type}</td>
                    <td>${assignment.uniform_size}</td>
                    <td>${assignment.uniform_color}</td>
                    <td>
                        <button class="btn btn-stock-action btn-sm" 
                            onclick="showReturnModal(${assignment.assignment_id})"
                            title="Return Uniform">
                            <i class="bi bi-box-arrow-in-left"></i>
                        </button>
                    </td>
                    <td>
                        ${index === 0 ? `
                            <div class="d-flex gap-2">
                                <button class="btn btn-stock-action btn-sm" 
                                    onclick="showAssignModal(${person.id})"
                                    title="Assign Uniform">
                                    <i class="bi bi-plus-circle"></i>
                                </button>
                                <button class="btn btn-stock-action btn-sm" 
                                    onclick="deleteStaff(${person.id})"
                                    title="Delete Staff">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </div>
                        ` : ''}
                    </td>
                `;
                staffList.appendChild(row);
            });
        } else {
            // If no uniforms assigned, show a single row with empty uniform columns
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${person.name}</td>
                <td>${person.department}</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td>
                    <div class="d-flex gap-2">
                        <button class="btn btn-stock-action btn-sm" 
                            onclick="showAssignModal(${person.id})"
                            title="Assign Uniform">
                            <i class="bi bi-plus-circle"></i>
                        </button>
                        <button class="btn btn-stock-action btn-sm" 
                            onclick="deleteStaff(${person.id})"
                            title="Delete Staff">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            staffList.appendChild(row);
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

// Load available uniforms for assignment
async function loadAvailableUniforms() {
    try {
        const response = await fetch(UNIFORMS_API);
        const uniforms = await response.json();
        const uniformSelect = document.getElementById('uniformSelect');
        uniformSelect.innerHTML = '<option value="">Select a uniform...</option>';

        const availableUniforms = uniforms.filter(u => u.current_stock > 0);
        for (const uniform of availableUniforms) {
            const option = document.createElement('option');
            option.value = uniform.id;
            option.textContent = `${uniform.type} (${uniform.size}, ${uniform.color}) - ${uniform.current_stock} in stock`;
            uniformSelect.appendChild(option);
        }
    } catch (error) {
        showFlashMessage(error.message, 'danger');
    }
}

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

// Add new staff
document.getElementById('addStaffForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const response = await fetch(STAFF_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: document.getElementById('staffName').value,
                department: document.getElementById('department').value
            })
        });

        if (!response.ok) {
            throw new Error('Failed to add staff member');
        }

        const result = await response.json();
        showFlashMessage('Staff member added successfully');
        bootstrap.Modal.getInstance(document.getElementById('addStaffModal')).hide();
        document.getElementById('addStaffForm').reset();
        loadStaffList();
    } catch (error) {
        showFlashMessage(error.message, 'danger');
    }
});

// Assign uniform
document.getElementById('assignUniformForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const response = await fetch(`${STAFF_API}/assign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                staff_id: parseInt(document.getElementById('assignStaffId').value),
                uniform_id: parseInt(document.getElementById('uniformSelect').value)
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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadStaffList();
}); 