const STAFF_API = '/api/staff';

const DEPARTMENTS = [
    'Bartender', 'Captain', 'Chef', 'Cruise Director', 'Deck Crew', 'Dhoni Captain',
    'Dhoni Crew', 'Dive', 'Engineer', 'Freelance', 'Housekeeping', 'Spa Therapist', 'Waiter', 'Other'
];

function showFlashMessage(message, type = 'success') {
    const flashContainer = document.getElementById('flash-messages');
    if (!flashContainer) return;
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    flashContainer.appendChild(alert);
    setTimeout(() => {
        alert.classList.remove('show');
        alert.addEventListener('transitionend', () => alert.remove(), { once: true });
    }, 4000);
}

function formatDisplayDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '-';
    }
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function toIsoDate(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return date.toISOString().split('T')[0];
}

let allStaff = [];
let filteredStaff = [];
let staffModal = null;

function populateDepartmentOptions() {
    const select = document.getElementById('staffFormDepartment');
    if (!select) return;
    select.innerHTML = '<option value="" disabled selected>Select department</option>';
    DEPARTMENTS.forEach(dept => {
        const option = document.createElement('option');
        option.value = dept;
        option.textContent = dept;
        select.appendChild(option);
    });
}

function resetStaffForm() {
    const form = document.getElementById('staffForm');
    if (form) {
        form.reset();
    }
    const idField = document.getElementById('staffFormId');
    if (idField) {
        idField.value = '';
    }
    const statusSelect = document.getElementById('staffFormStatus');
    if (statusSelect) {
        statusSelect.value = 'active';
    }
    setStatusError('');
}

function openStaffModal(title, staff) {
    const modalTitle = document.getElementById('staffFormModalTitle');
    if (modalTitle) {
        modalTitle.textContent = title;
    }
    const submitBtn = document.getElementById('staffFormSubmitBtn');
    if (submitBtn) {
        submitBtn.textContent = staff ? 'Update' : 'Add';
    }

    const idField = document.getElementById('staffFormId');
    const nameField = document.getElementById('staffFormName');
    const fullNameField = document.getElementById('staffFormFullName');
    const deptField = document.getElementById('staffFormDepartment');
    const startField = document.getElementById('staffFormStartingDate');
    const birthdayField = document.getElementById('staffFormBirthday');
    const statusField = document.getElementById('staffFormStatus');

    if (staff && idField && nameField && deptField && statusField) {
        idField.value = String(staff.id ?? '');
        nameField.value = staff.name || '';
        if (fullNameField) fullNameField.value = staff.full_name || '';
        deptField.value = staff.department || '';
        if (startField) startField.value = staff.starting_date ? toIsoDate(staff.starting_date) || staff.starting_date : '';
        if (birthdayField) birthdayField.value = staff.birthday ? toIsoDate(staff.birthday) || staff.birthday : '';
        statusField.value = staff.status === 'inactive' ? 'inactive' : 'active';
    } else {
        resetStaffForm();
    }

    if (staffModal) {
        staffModal.show();
    }

    setStatusError('');
}

function setStatusError(message) {
    const errorEl = document.getElementById('staffFormStatusError');
    if (!errorEl) return;
    if (message) {
        errorEl.textContent = message;
        errorEl.classList.remove('d-none');
    } else {
        errorEl.textContent = '';
        errorEl.classList.add('d-none');
    }
}

function applyFilters() {
    const searchInput = document.getElementById('staffDirectorySearch');
    const statusFilter = document.getElementById('staffStatusFilter');
    const searchTerm = (searchInput?.value || '').trim().toLowerCase();
    const statusValue = statusFilter?.value || 'all';

    filteredStaff = allStaff.filter(staff => {
        if (statusValue !== 'all' && staff.status !== statusValue) {
            return false;
        }
        if (!searchTerm) {
            return true;
        }
        const haystack = [
            staff.name,
            staff.full_name,
            staff.department,
            staff.status
        ];
        return haystack.some(value => (value || '').toLowerCase().includes(searchTerm));
    });

    renderStaffTable();
}

function renderStaffTable() {
    const tbody = document.getElementById('staffDirectoryBody');
    if (!tbody) return;

    if (!filteredStaff.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted py-4">No staff found.</td>
            </tr>
        `;
        return;
    }

    const rows = filteredStaff
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
        .map(staff => {
            const statusLabel = staff.status === 'inactive' ? 'Inactive' : 'Active';
            const badgeClass = staff.status === 'inactive' ? 'bg-secondary' : 'bg-success';
            return `
            <tr>
                <td>${staff.name || '-'}</td>
                <td>${staff.full_name || '-'}</td>
                <td>${staff.department || '-'}</td>
                <td>${formatDisplayDate(staff.starting_date)}</td>
                <td>${formatDisplayDate(staff.birthday)}</td>
                <td><span class="badge ${badgeClass}">${statusLabel}</span></td>
                <td class="text-end">
                    <div class="d-flex justify-content-end gap-2">
                        <button class="btn btn-stock-action btn-sm" data-action="edit" data-id="${staff.id}" title="Edit ${staff.name || 'staff'}">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-stock-action btn-sm" data-action="delete" data-id="${staff.id}" data-name="${staff.name}" title="Delete ${staff.name || 'staff'}">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
        })
        .join('');

    tbody.innerHTML = rows;
}

function escapeForCsv(value) {
    const str = value ?? '';
    return `"${String(str).replace(/"/g, '""')}"`;
}

function buildStaffCsv(data) {
    const headers = ['Name', 'Full Name', 'Department', 'Starting Date', 'Date of Birth', 'Status'];
    const rows = data.map(staff => {
        const statusLabel = staff.status === 'inactive' ? 'Inactive' : 'Active';
        return [
            escapeForCsv(staff.name || ''),
            escapeForCsv(staff.full_name || ''),
            escapeForCsv(staff.department || ''),
            escapeForCsv(formatDisplayDate(staff.starting_date)),
            escapeForCsv(formatDisplayDate(staff.birthday)),
            escapeForCsv(statusLabel)
        ].join(',');
    });
    return [headers.join(','), ...rows].join('\n');
}

async function loadStaffDirectory() {
    try {
        const response = await fetch(`${STAFF_API}`);
        if (!response.ok) {
            throw new Error('Failed to load staff directory');
        }
        allStaff = await response.json();
        applyFilters();
    } catch (error) {
        showFlashMessage(error.message || 'Unable to load staff directory.', 'danger');
    }
}

function isDuplicateStaffEntry(candidate, existingList) {
    const normalizedName = (candidate.name || '').trim().toLowerCase();
    const normalizedFullName = (candidate.full_name || '').trim().toLowerCase();
    const normalizedDepartment = (candidate.department || '').trim().toLowerCase();

    return existingList.some(staff => {
        const staffName = (staff.name || '').trim().toLowerCase();
        const staffFullName = (staff.full_name || '').trim().toLowerCase();
        const staffDepartment = (staff.department || '').trim().toLowerCase();
        return staffName === normalizedName &&
            staffFullName === normalizedFullName &&
            staffDepartment === normalizedDepartment;
    });
}

async function submitStaffForm(event) {
    event.preventDefault();
    const idField = document.getElementById('staffFormId');
    const nameField = document.getElementById('staffFormName');
    const fullNameField = document.getElementById('staffFormFullName');
    const deptField = document.getElementById('staffFormDepartment');
    const startField = document.getElementById('staffFormStartingDate');
    const birthdayField = document.getElementById('staffFormBirthday');
    const statusField = document.getElementById('staffFormStatus');

    if (!nameField?.value.trim() || !deptField?.value) {
        showFlashMessage('Name and department are required.', 'danger');
        return;
    }

    const payload = {
        name: nameField.value.trim(),
        full_name: fullNameField?.value.trim() || null,
        department: deptField.value,
        starting_date: startField?.value || null,
        birthday: birthdayField?.value || null,
        status: statusField?.value === 'inactive' ? 'inactive' : 'active'
    };

    const staffId = idField?.value ? Number.parseInt(idField.value, 10) : null;

    if (!staffId) {
        if (isDuplicateStaffEntry(payload, allStaff)) {
            setStatusError('');
            showFlashMessage('A staff member with the same name and department already exists.', 'danger');
            return;
        }
    }

    try {
        const response = await fetch(staffId ? `${STAFF_API}/${staffId}` : STAFF_API, {
            method: staffId ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to save staff member');
        }

        if (staffModal) {
            setStatusError('');
            staffModal.hide();
        }
        showFlashMessage(`Staff ${staffId ? 'updated' : 'added'} successfully.`);
        await loadStaffDirectory();
    } catch (error) {
        const message = error.message || 'Failed to save staff member.';
        if (statusField && statusField.value === 'inactive' && message.includes('cannot be set to Inactive')) {
            statusField.value = 'active';
            setStatusError('This staff member cannot be set to Inactive while uniforms are still assigned.');
            return;
        }
        setStatusError('');
        showFlashMessage(message, 'danger');
    }
}

async function deleteStaffMember(staffId, name) {
    if (!Number.isInteger(staffId)) return;
    const confirmed = confirm(`Are you sure you want to delete ${name || 'this staff member'}? This action cannot be undone.`);
    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(`${STAFF_API}/${staffId}`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to delete staff member');
        }
        showFlashMessage('Staff member deleted successfully.');
        await loadStaffDirectory();
    } catch (error) {
        showFlashMessage(error.message || 'Failed to delete staff member.', 'danger');
    }
}

function handleTableClick(event) {
    const target = event.target.closest('button[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    const staffId = Number.parseInt(target.dataset.id || '', 10);
    const staff = allStaff.find(item => item.id === staffId);

    if (action === 'edit' && staff) {
        openStaffModal(`Edit ${staff.name || 'Staff'}`, staff);
    } else if (action === 'delete' && staff) {
        deleteStaffMember(staffId, staff.name);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    populateDepartmentOptions();
    const modalElement = document.getElementById('staffFormModal');
    if (modalElement) {
        staffModal = new bootstrap.Modal(modalElement);
        modalElement.addEventListener('hidden.bs.modal', resetStaffForm);
    }

    const addBtn = document.getElementById('addStaffBtn');
    if (addBtn) {
        addBtn.addEventListener('click', () => openStaffModal('Add Staff', null));
    }

    const searchInput = document.getElementById('staffDirectorySearch');
    if (searchInput) {
        searchInput.addEventListener('input', applyFilters);
    }

    const statusFilter = document.getElementById('staffStatusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', applyFilters);
    }

    const tableBody = document.getElementById('staffDirectoryBody');
    if (tableBody) {
        tableBody.addEventListener('click', handleTableClick);
    }

    const staffForm = document.getElementById('staffForm');
    if (staffForm) {
        staffForm.addEventListener('submit', submitStaffForm);
    }

    const statusSelect = document.getElementById('staffFormStatus');
    if (statusSelect) {
        statusSelect.addEventListener('change', () => setStatusError(''));
    }

    const exportBtn = document.getElementById('exportStaffCsvBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            if (!Array.isArray(filteredStaff) || filteredStaff.length === 0) {
                showFlashMessage('No staff to export for the current view.', 'info');
                return;
            }
            const csvContent = buildStaffCsv(filteredStaff);
            const today = new Date();
            const fileName = typeof getCsvFilename === 'function'
                ? getCsvFilename('staff_directory', today)
                : `staff_directory_${today.toISOString().split('T')[0]}.csv`;
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            showFlashMessage('Staff Directory exported successfully');
        });
    }

    loadStaffDirectory();
});
