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
const assignmentMap = new Map();
let currentStaffSearchQuery = '';
let savedExpandedStaffIds = null;
const assignLocationInfo = document.getElementById('assignLocationInfo');

const STATUS_BADGE_CLASSES = {
    assigned: 'bg-success',
    returned: 'bg-warning',
    discarded: 'bg-secondary'
};

function formatAssignmentLocation(assignment) {
    if (!assignment) return '-';
    const vessel = String(assignment.vessel || 'yin').toUpperCase();
    const storage = assignment.storage_location || 'Unspecified';
    return vessel + ' · ' + storage;
}

function getAssignmentLocationKey(assignment) {
    return [assignment.vessel || 'yin', (assignment.storage_location || 'Unspecified').trim().toLowerCase()].join('__');
}

function formatStatusLabel(status) {
    if (!status) return '';
    return status.charAt(0).toUpperCase() + status.slice(1);
}

function normalizeDateKey(value) {
    if (!value) return 'unknown';
    if (value instanceof Date) {
        return value.toISOString().split('T')[0];
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return 'unknown';
        const isoTest = new Date(trimmed);
        if (!Number.isNaN(isoTest.getTime())) {
            return isoTest.toISOString().split('T')[0];
        }
        const parts = trimmed.split(/[ T]/);
        if (parts.length > 0 && parts[0]) {
            return parts[0];
        }
    }
    return 'unknown';
}

function formatDateShort(value) {
    if (!value) return '-';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '-';
    }
    const day = String(date.getDate()).padStart(2, '0');
    const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = MONTH_LABELS[date.getMonth()] || '';
    const year = String(date.getFullYear()).slice(-2);
    return month ? `${day}-${month}-${year}` : '-';
}

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

function hasActiveAssignments(person) {
    return Array.isArray(person.assignments)
        ? person.assignments.some(assignment => assignment && assignment.status === 'assigned' && (assignment.quantity || 0) > 0)
        : false;
}

function shouldDisplayPerson(person) {
    const status = (person.status || 'active').toLowerCase();
    if (status === 'active') {
        return true;
    }
    return hasActiveAssignments(person);
}

function filterStaffByQuery(dataset, query) {
    const trimmed = (query || '').trim().toLowerCase();

    return dataset.reduce((acc, person) => {
        const assignments = Array.isArray(person.assignments)
            ? person.assignments.filter(a => a && a.status === 'assigned')
            : [];

        if (!trimmed) {
            acc.push({
                ...person,
                assignments: assignments.map(a => ({ ...a }))
            });
            return acc;
        }

        const staffFields = [person.name, person.department];
        const staffMatches = staffFields.some(value => (value || '').toLowerCase().includes(trimmed));

        const matchedAssignments = assignments.filter(assignment => {
            const fields = [
                assignment.uniform_type,
                assignment.uniform_size,
                assignment.uniform_color,
                assignment.assigned_condition,
                assignment.returned_condition,
                assignment.vessel,
                assignment.storage_location
            ];
            return fields.some(value => (value || '').toLowerCase().includes(trimmed));
        });

        if (matchedAssignments.length > 0 || staffMatches) {
            acc.push({
                ...person,
                assignments: matchedAssignments.length > 0
                    ? matchedAssignments.map(a => ({ ...a }))
                    : assignments.map(a => ({ ...a })),
                _searchMatched: true
            });
        }

        return acc;
    }, []);
}

function updateStaffView() {
    let filtered = filterStaffByQuery(allStaff, currentStaffSearchQuery);
    if (sortField) {
        filtered = sortStaff(filtered, sortField);
    }
    if (currentStaffSearchQuery) {
        expandedStaffIds = new Set(filtered.map(person => person.id));
    }
    renderStaffList(filtered);
}

// Load staff list with their assignments
async function loadStaffList(options = {}) {
    const { preserveSearch = false } = options;
    const previousSearch = preserveSearch ? currentStaffSearchQuery : '';
    const previousExpanded = new Set(expandedStaffIds);
    const previousSavedExpanded = savedExpandedStaffIds ? new Set(savedExpandedStaffIds) : null;

    try {
        const response = await fetch(`${STAFF_API}/with-assignments`);
        const staff = await response.json();
        const sorted = sortStaffByNameAlpha(staff).map(person => ({
            ...person,
            status: (person.status || 'active'),
            assignments: Array.isArray(person.assignments)
                ? person.assignments.map(a => ({ ...a }))
                : []
        }));
        const filtered = sorted.filter(shouldDisplayPerson);
        allStaff = filtered;
        const preserved = new Set();
        filtered.forEach(person => {
            if (previousExpanded.has(person.id)) {
                preserved.add(person.id);
            }
        });
        expandedStaffIds = preserved;

        if (preserveSearch) {
            currentStaffSearchQuery = previousSearch;
            if (staffSearchInput) {
                staffSearchInput.value = previousSearch;
            }
            savedExpandedStaffIds = previousSavedExpanded ? new Set(previousSavedExpanded) : savedExpandedStaffIds;
        } else {
            currentStaffSearchQuery = '';
            if (staffSearchInput) {
                staffSearchInput.value = '';
            }
            savedExpandedStaffIds = null;
        }
        updateStaffView();
    } catch (error) {
        showFlashMessage(error.message, 'danger');
    }
}

function renderStaffList(staff) {
    const staffList = document.getElementById('staffList');
    staffList.innerHTML = '';
    assignmentMap.clear();
    const searchActive = Boolean(currentStaffSearchQuery);

    for (const person of staff) {
        const assignments = Array.isArray(person.assignments)
            ? [...person.assignments]
            : [];

        const mergedAssignmentsMap = assignments.reduce((acc, assignment) => {
            if (!assignment) return acc;
            const status = assignment.status;
            if (status !== 'assigned') {
                return acc;
            }
            const keyParts = [
                status,
                assignment.uniform_type,
                assignment.uniform_size,
                assignment.uniform_color,
                assignment.assigned_condition || 'New',
                assignment.vessel || 'yin',
                assignment.storage_location || 'Unspecified'
            ];
            if (status === 'assigned') {
                keyParts.push('all-assigned');
            } else {
                const dateKey = normalizeDateKey(assignment.returned_date || assignment.assigned_date);
                keyParts.push(dateKey);
                if (dateKey === 'unknown') {
                    keyParts.push(`id:${assignment.assignment_id || Math.random()}`);
                }
            }
            const key = keyParts.join('__');
            if (!acc[key]) {
                acc[key] = { ...assignment };
                acc[key].quantity = assignment.quantity || 1;
            } else {
                acc[key].quantity += assignment.quantity || 1;
                const existingDate = acc[key].assigned_date;
                const candidateDate = assignment.assigned_date;
                if (existingDate && candidateDate) {
                    if (new Date(candidateDate).getTime() < new Date(existingDate).getTime()) {
                        acc[key].assigned_date = candidateDate;
                    }
                }
                const existingReturnDate = acc[key].returned_date;
                const candidateReturnDate = assignment.returned_date;
                if (existingReturnDate && candidateReturnDate) {
                    if (new Date(candidateReturnDate).getTime() < new Date(existingReturnDate).getTime()) {
                        acc[key].returned_date = candidateReturnDate;
                    }
                }
            }
            return acc;
        }, {});

        const mergedAssignments = Object.values(mergedAssignmentsMap);

        mergedAssignments.sort((a, b) => {
            const dateA = a?.assigned_date ? new Date(a.assigned_date).getTime() : 0;
            const dateB = b?.assigned_date ? new Date(b.assigned_date).getTime() : 0;
            return dateB - dateA;
        });

        mergedAssignments.forEach(assignment => {
            if (assignment && typeof assignment.assignment_id === 'number') {
                assignment.quantity = assignment.quantity || 1;
                assignmentMap.set(assignment.assignment_id, assignment);
            }
        });

        const activeAssignments = mergedAssignments.filter(a => a && a.status === 'assigned');

        const hasAdditionalRows = activeAssignments.length > 1;
        if (!searchActive && !hasAdditionalRows) {
            expandedStaffIds.delete(person.id);
        }
        let isExpanded = expandedStaffIds.has(person.id);
        if (searchActive) {
            isExpanded = true;
        }
        const primaryAssignment = activeAssignments[0] || null;

        const toggleButton = hasAdditionalRows
            ? `<button class="btn btn-link btn-sm p-0 ms-2 staff-toggle" data-staff-id="${person.id}" title="Toggle assignments"><i class="bi bi-chevron-${isExpanded ? 'down' : 'right'}"></i></button>`
            : '';

        const uniformType = primaryAssignment ? primaryAssignment.uniform_type : '-';
        const uniformSize = primaryAssignment ? primaryAssignment.uniform_size : '-';
        const uniformColor = primaryAssignment ? primaryAssignment.uniform_color : '-';
        const uniformLocation = primaryAssignment ? formatAssignmentLocation(primaryAssignment) : '-';
        const uniformQuantity = primaryAssignment ? (primaryAssignment.quantity || 1) : '-';
        const assignedCondition = primaryAssignment ? (primaryAssignment.assigned_condition || 'New') : '-';
        const returnedCondition = primaryAssignment
            ? (primaryAssignment.returned_condition || '-')
            : '-';

        let returnCell = '-';
        if (primaryAssignment) {
            returnCell = `<button class="btn btn-stock-action btn-sm" onclick="showReturnModal(${primaryAssignment.assignment_id})" title="Return Uniform"><i class="bi bi-box-arrow-in-left"></i></button>`;
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                ${person.name}
                ${toggleButton}
            </td>
            <td>${person.department || '-'}</td>
            <td>${uniformType}</td>
            <td>${uniformSize}</td>
            <td>${uniformColor}</td>
            <td>${uniformLocation}</td>
            <td>${uniformQuantity}</td>
            <td>${assignedCondition}</td>
            <td>${returnedCondition}</td>
            <td>${returnCell}</td>
            <td>
                <div class="d-flex">
                    <button class="btn btn-stock-action btn-sm" onclick="showAssignModal(${person.id})" title="Assign Uniform"><i class="bi bi-plus-circle"></i></button>
                </div>
            </td>
        `;
        staffList.appendChild(row);

        if (isExpanded && activeAssignments.length > 1) {
            for (let i = 1; i < activeAssignments.length; i++) {
                const a = activeAssignments[i];
                const extraReturnCell = `<button class="btn btn-stock-action btn-sm" onclick="showReturnModal(${a.assignment_id})" title="Return Uniform"><i class="bi bi-box-arrow-in-left"></i></button>`;

                const assignRow = document.createElement('tr');
                assignRow.innerHTML = `
                    <td></td>
                    <td></td>
                    <td>${a.uniform_type}</td>
                    <td>${a.uniform_size}</td>
                    <td>${a.uniform_color}</td>
                    <td>${formatAssignmentLocation(a)}</td>
                    <td>${a.quantity || 1}</td>
                    <td>${a.assigned_condition || 'New'}</td>
                    <td>${a.returned_condition || '-'}</td>
                    <td>${extraReturnCell}</td>
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
    updateStaffView();
});

document.getElementById('sortDepartment').addEventListener('click', function() {
    if (sortField === 'department') {
        sortDirection *= -1;
    } else {
        sortField = 'department';
        sortDirection = 1;
    }
    updateStaffView();
});

// Update search filter to respect current sort
const staffSearchInput = document.getElementById('staffSearch');
if (staffSearchInput) {
    staffSearchInput.addEventListener('input', function() {
        const rawValue = this.value || '';
        const trimmed = rawValue.trim();

        if (trimmed && !currentStaffSearchQuery) {
            savedExpandedStaffIds = new Set(expandedStaffIds);
        } else if (!trimmed && currentStaffSearchQuery) {
            expandedStaffIds = savedExpandedStaffIds || new Set();
            savedExpandedStaffIds = null;
        }

        currentStaffSearchQuery = trimmed;
        updateStaffView();
    });
}

// Custom dropdown for uniform search
let uniformDropdownOptions = [];
const assignQuantityInput = document.getElementById('assignQuantity');
const assignQuantityFeedback = document.getElementById('assignQuantityFeedback');
const assignQuantityAvailable = document.getElementById('assignQuantityAvailable');
const assignPerformedByInput = document.getElementById('assignPerformedBy');
const returnQuantityInput = document.getElementById('returnQuantity');
const returnQuantityFeedback = document.getElementById('returnQuantityFeedback');
const returnQuantityAvailable = document.getElementById('returnQuantityAvailable');
const returnAssignmentSelect = document.getElementById('returnAssignmentSelect');
const returnAssignmentWrapper = document.getElementById('returnAssignmentWrapper');
const availableUniformMap = new Map();
let currentReturnAssignment = null;
let currentReturnCandidates = [];
const returnConditionSelect = document.getElementById('returnCondition');
const baseReturnConditions = ['New', 'Good', 'Fair', 'Poor'];
const returnReasonInput = document.getElementById('returnReason');
let dynamicReturnConditions = [];
let previousReturnCondition = returnConditionSelect ? returnConditionSelect.value : baseReturnConditions[0];
const addConditionModalElement = document.getElementById('addConditionModal');
const addConditionInput = document.getElementById('addConditionInput');
const addConditionCharCount = document.getElementById('addConditionCharCount');
const addConditionFeedback = document.getElementById('addConditionFeedback');
const confirmAddConditionBtn = document.getElementById('confirmAddConditionBtn');
const cancelAddConditionBtn = document.getElementById('cancelAddConditionBtn');
const addConditionModal = addConditionModalElement ? new bootstrap.Modal(addConditionModalElement) : null;

function conditionExists(value) {
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;
    if (baseReturnConditions.some(cond => cond.toLowerCase() === normalized)) {
        return true;
    }
    return dynamicReturnConditions.some(cond => cond.toLowerCase() === normalized);
}

function updateReturnConditionOptions(selectedValue = null) {
    if (!returnConditionSelect) return;
    const values = [];
    const seen = new Set();
    const pushValue = (value) => {
        if (value === undefined || value === null) return;
        const trimmed = String(value).trim();
        if (!trimmed) return;
        const key = trimmed.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        values.push(trimmed);
    };

    baseReturnConditions.forEach(pushValue);
    dynamicReturnConditions.forEach(pushValue);

    returnConditionSelect.innerHTML = '';
    values.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        returnConditionSelect.appendChild(option);
    });

    const addOption = document.createElement('option');
    addOption.value = '__add__';
    addOption.textContent = 'Add Condition';
    returnConditionSelect.appendChild(addOption);

    const targetLower = selectedValue ? selectedValue.toLowerCase() : null;
    const match = targetLower && values.find(value => value.toLowerCase() === targetLower);
    returnConditionSelect.value = match || values[0] || 'Good';
    previousReturnCondition = returnConditionSelect.value;
}

function updateAddConditionCharCount() {
    if (!addConditionCharCount || !addConditionInput) return;
    const length = addConditionInput.value.length;
    addConditionCharCount.textContent = `${length} / 15`;
    if (length >= 15) {
        addConditionCharCount.classList.add('text-danger');
        if (addConditionFeedback) {
            addConditionFeedback.textContent = 'Maximum 15 characters allowed.';
            addConditionFeedback.classList.remove('d-none');
        }
    } else {
        addConditionCharCount.classList.remove('text-danger');
        if (addConditionFeedback) {
            addConditionFeedback.classList.add('d-none');
        }
    }
}

function promptForNewCondition() {
    if (!addConditionModal || !addConditionInput) {
        while (true) {
            const input = window.prompt('Enter new condition (max 15 characters):', '');
            if (input === null) {
                return null;
            }
            const trimmed = input.trim();
            if (!trimmed) {
                window.alert('Condition name cannot be empty.');
                continue;
            }
            if (trimmed.length > 15) {
                window.alert('Condition name cannot exceed 15 characters.');
                continue;
            }
            if (conditionExists(trimmed)) {
                window.alert('Condition already exists.');
                continue;
            }
            return trimmed;
        }
    }

    return new Promise(resolve => {
        let resolved = false;

        const cleanup = () => {
            addConditionInput.removeEventListener('input', handleInput);
            if (confirmAddConditionBtn) confirmAddConditionBtn.removeEventListener('click', handleSave);
            if (cancelAddConditionBtn) cancelAddConditionBtn.removeEventListener('click', handleCancel);
            addConditionModalElement.removeEventListener('hidden.bs.modal', handleHidden);
        };

        const handleInput = () => {
            if (!addConditionInput) return;
            if (addConditionInput.value.length > 15) {
                addConditionInput.value = addConditionInput.value.slice(0, 15);
            }
            updateAddConditionCharCount();
        };

        const handleSave = () => {
            if (!addConditionInput) return;
            const trimmed = addConditionInput.value.trim();
            if (!trimmed) {
                if (addConditionFeedback) {
                    addConditionFeedback.textContent = 'Condition name cannot be empty.';
                    addConditionFeedback.classList.remove('d-none');
                }
                addConditionInput.focus();
                return;
            }
            if (trimmed.length > 15) {
                if (addConditionFeedback) {
                    addConditionFeedback.textContent = 'Condition name cannot exceed 15 characters.';
                    addConditionFeedback.classList.remove('d-none');
                }
                addConditionInput.focus();
                return;
            }
            if (conditionExists(trimmed)) {
                if (addConditionFeedback) {
                    addConditionFeedback.textContent = 'Condition already exists.';
                    addConditionFeedback.classList.remove('d-none');
                }
                addConditionInput.focus();
                return;
            }
            resolved = true;
            cleanup();
            addConditionModal.hide();
            resolve(trimmed);
        };

        const handleCancel = () => {
            cleanup();
            addConditionModal.hide();
            if (!resolved) {
                resolved = true;
                resolve(null);
            }
        };

        const handleHidden = () => {
            cleanup();
            if (!resolved) {
                resolved = true;
                resolve(null);
            }
        };

        if (addConditionFeedback) {
            addConditionFeedback.classList.add('d-none');
        }
        addConditionInput.value = '';
        updateAddConditionCharCount();

        addConditionInput.addEventListener('input', handleInput);
        if (confirmAddConditionBtn) confirmAddConditionBtn.addEventListener('click', handleSave);
        if (cancelAddConditionBtn) cancelAddConditionBtn.addEventListener('click', handleCancel);
        addConditionModalElement.addEventListener('hidden.bs.modal', handleHidden);

        addConditionModal.show();
        addConditionInput.focus();
    });
}

async function loadAvailableUniforms() {
    try {
        const response = await fetch(UNIFORMS_API);
        const uniforms = await response.json();
        const availableUniforms = uniforms.filter(u => u.current_stock > 0);
        window._availableUniforms = availableUniforms;
        availableUniformMap.clear();
        uniformDropdownOptions = [];
        availableUniforms.forEach(u => {
            const locations = Array.isArray(u.locations) ? u.locations.filter(location => Number(location.quantity || 0) > 0) : [];
            locations.forEach(location => {
                const optionId = [u.id, location.vessel || 'yin', location.storage_location || 'Unspecified'].join('__');
                const option = {
                    id: optionId,
                    uniform_id: u.id,
                    vessel: location.vessel || 'yin',
                    storage_location: location.storage_location || 'Unspecified',
                    quantity: Number(location.quantity || 0),
                    label: u.type + ' (' + u.size + ', ' + u.color + ') • ' + String(location.vessel || 'yin').toUpperCase() + ' · ' + (location.storage_location || 'Unspecified') + ' — Qty ' + Number(location.quantity || 0)
                };
                availableUniformMap.set(optionId, option);
                uniformDropdownOptions.push(option);
            });
        });
        updateAssignQuantityLimits(uniformInput.dataset.selectedId || null);
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

function setAssignQuantityFeedback(message) {
    if (!assignQuantityFeedback) return;
    if (message) {
        assignQuantityFeedback.textContent = message;
        assignQuantityFeedback.classList.remove('d-none');
    } else {
        assignQuantityFeedback.textContent = '';
        assignQuantityFeedback.classList.add('d-none');
    }
}

function updateAssignQuantityLimits(uniformId) {
    if (!assignQuantityInput) return;
    const uniform = uniformId ? availableUniformMap.get(String(uniformId)) : null;
    const max = uniform ? uniform.quantity : 0;
    if (assignLocationInfo) {
        assignLocationInfo.textContent = uniform
            ? String(uniform.vessel || 'yin').toUpperCase() + ' · ' + (uniform.storage_location || 'Unspecified') + ' has ' + max + ' available.'
            : 'Select a uniform location to see available quantity.';
    }
    if (assignQuantityAvailable) {
        assignQuantityAvailable.textContent = max;
    }
    if (max > 0) {
        assignQuantityInput.setAttribute('max', String(max));
        if (Number(assignQuantityInput.value) > max) {
            assignQuantityInput.value = String(max);
        }
    } else {
        assignQuantityInput.removeAttribute('max');
    }
    if (!Number.isInteger(Number(assignQuantityInput.value)) || Number(assignQuantityInput.value) < 1) {
        assignQuantityInput.value = '1';
    }
    validateAssignQuantity();
}

function validateAssignQuantity() {
    if (!assignQuantityInput) return false;
    const quantity = Number.parseInt(assignQuantityInput.value, 10);
    if (!Number.isInteger(quantity) || quantity < 1) {
        setAssignQuantityFeedback('Quantity must be at least 1');
        return false;
    }
    const uniformId = uniformInput.dataset.selectedId;
    if (uniformId) {
        const uniform = availableUniformMap.get(String(uniformId));
        if (uniform && quantity > uniform.quantity) {
            setAssignQuantityFeedback('⚠️ Quantity cannot exceed available stock');
            return false;
        }
    }
    setAssignQuantityFeedback('');
    return true;
}

function setReturnQuantityFeedback(message) {
    if (!returnQuantityFeedback) return;
    if (message) {
        returnQuantityFeedback.textContent = message;
        returnQuantityFeedback.classList.remove('d-none');
    } else {
        returnQuantityFeedback.textContent = '';
        returnQuantityFeedback.classList.add('d-none');
    }
}

function getReturnAssignmentQuantity(assignment) {
    if (!assignment) return 0;
    const quantity = Number.parseInt(assignment.quantity, 10);
    return Number.isInteger(quantity) && quantity > 0 ? quantity : 0;
}

function updateReturnQuantityLimits(assignment) {
    if (!returnQuantityInput) return;
    const max = getReturnAssignmentQuantity(assignment);
    if (returnQuantityAvailable) {
        returnQuantityAvailable.textContent = max;
    }
    if (max > 0) {
        returnQuantityInput.setAttribute('max', String(max));
        if (Number(returnQuantityInput.value) > max) {
            returnQuantityInput.value = String(max);
        }
    } else {
        returnQuantityInput.removeAttribute('max');
        returnQuantityInput.value = '1';
    }
    validateReturnQuantity();
}

function validateReturnQuantity() {
    if (!returnQuantityInput) return false;
    const quantity = Number.parseInt(returnQuantityInput.value, 10);
    if (!Number.isInteger(quantity) || quantity < 1) {
        setReturnQuantityFeedback('Quantity must be at least 1');
        return false;
    }
    const max = getReturnAssignmentQuantity(currentReturnAssignment);
    if (quantity > max) {
        setReturnQuantityFeedback('⚠️ Quantity cannot exceed assigned amount');
        return false;
    }
    setReturnQuantityFeedback('');
    return true;
}

function selectUniformOption(option) {
    document.getElementById('uniformInput').value = option.label;
    document.getElementById('uniformInput').dataset.selectedId = option.id;
    hideCustomDropdown();
    updateAssignQuantityLimits(option.id);
}

const uniformInput = document.getElementById('uniformInput');
uniformInput.addEventListener('input', function() {
    const value = this.value.trim().toLowerCase();
    const filtered = uniformDropdownOptions.filter(opt => opt.label.toLowerCase().includes(value));
    showCustomDropdown(filtered);
    this.dataset.selectedId = '';
    updateAssignQuantityLimits(null);
});

uniformInput.addEventListener('focus', function() {
    const value = this.value.trim().toLowerCase();
    const filtered = uniformDropdownOptions.filter(opt => opt.label.toLowerCase().includes(value));
    showCustomDropdown(filtered);
    updateAssignQuantityLimits(this.dataset.selectedId || null);
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

if (assignQuantityInput) {
    assignQuantityInput.addEventListener('input', validateAssignQuantity);
}
if (returnQuantityInput) {
    returnQuantityInput.addEventListener('input', validateReturnQuantity);
}

// Show assign uniform modal
function showAssignModal(staffId) {
    document.getElementById('assignStaffId').value = staffId;
    uniformInput.value = '';
    uniformInput.dataset.selectedId = '';
    document.getElementById('assignCondition').value = 'New';
    hideCustomDropdown();
    if (assignQuantityInput) {
        assignQuantityInput.value = '1';
    }
    if (assignPerformedByInput) {
        const storedName = window.localStorage?.getItem('lastAssignedBy') || '';
        assignPerformedByInput.value = storedName;
    }
    if (assignQuantityAvailable) {
        assignQuantityAvailable.textContent = '0';
    }
    if (assignLocationInfo) {
        assignLocationInfo.textContent = 'Select a uniform location to see available quantity.';
    }
    setAssignQuantityFeedback('');
    updateAssignQuantityLimits(null);
    loadAvailableUniforms();
    const modal = new bootstrap.Modal(document.getElementById('assignUniformModal'));
    modal.show();
}

// Show return uniform modal
function showReturnModal(assignmentId) {
    document.getElementById('returnAssignmentId').value = assignmentId;
    if (!returnConditionSelect) {
        const modal = new bootstrap.Modal(document.getElementById('returnUniformModal'));
        modal.show();
        return;
    }
    const returnToStock = document.getElementById('returnToStock');
    const discardUniform = document.getElementById('discardUniform');
    if (returnToStock) returnToStock.checked = true;
    if (discardUniform) discardUniform.checked = false;

    if (returnReasonInput) {
        returnReasonInput.value = '';
    }

    const assignment = assignmentMap.get(assignmentId);
    const person = assignment ? allStaff.find(p => p.id === assignment.staff_id) : null;
    const baseAssignments = person && Array.isArray(person.assignments) ? person.assignments : [];
    const targetCondition = assignment ? (assignment.assigned_condition || 'New') : null;
    const targetUniformId = assignment ? assignment.uniform_id : null;
    const targetLocationKey = assignment ? getAssignmentLocationKey(assignment) : null;
    dynamicReturnConditions = [];

    currentReturnCandidates = baseAssignments
        .filter(a => a && a.status === 'assigned')
        .filter(a => {
            if (targetUniformId && a.uniform_id !== targetUniformId) return false;
            if (targetCondition && (a.assigned_condition || 'New') !== targetCondition) return false;
            if (targetLocationKey && getAssignmentLocationKey(a) !== targetLocationKey) return false;
            return true;
        })
        .map(a => ({ ...a }));

    if (!currentReturnCandidates.length && assignment) {
        currentReturnCandidates = [{ ...assignment }];
    }

    const sortedCandidates = currentReturnCandidates.slice().sort((a, b) => {
        const dateA = a.assigned_date ? new Date(a.assigned_date).getTime() : 0;
        const dateB = b.assigned_date ? new Date(b.assigned_date).getTime() : 0;
        return dateB - dateA;
    });

    const totalCandidateQuantity = sortedCandidates.reduce((sum, candidate) => {
        return sum + getReturnAssignmentQuantity(candidate);
    }, 0);
    const allMatchingSelection = sortedCandidates.length > 1 && totalCandidateQuantity > 0
        ? {
            ...sortedCandidates[0],
            assignment_id: sortedCandidates[0].assignment_id,
            quantity: totalCandidateQuantity,
            is_all_matching: true
        }
        : null;

    const populateAssignmentSelect = () => {
        if (!returnAssignmentSelect || !returnAssignmentWrapper) return;
        returnAssignmentSelect.innerHTML = '';

        if (allMatchingSelection) {
            const option = document.createElement('option');
            option.value = 'all';
            option.textContent = `All matching items • Qty ${totalCandidateQuantity}`;
            returnAssignmentSelect.appendChild(option);
        }

        sortedCandidates.forEach(candidate => {
            const option = document.createElement('option');
            option.value = candidate.assignment_id;
            const qty = getReturnAssignmentQuantity(candidate) || 1;
            option.textContent = `${formatDateShort(candidate.assigned_date)} • Qty ${qty}`;
            returnAssignmentSelect.appendChild(option);
        });
        const shouldHide = sortedCandidates.length <= 1;
        returnAssignmentWrapper.classList.toggle('d-none', shouldHide);
    };

    const applySelection = (selected) => {
        currentReturnAssignment = selected || null;
        const hiddenInput = document.getElementById('returnAssignmentId');
        if (hiddenInput && selected) {
            hiddenInput.value = selected.assignment_id;
        }

        let preferredCondition = 'New';
        if (selected) {
            if (selected.status === 'discarded' && discardUniform) {
                discardUniform.checked = true;
            }
            const fallbackCondition = selected.returned_condition
                || (selected.assigned_condition ? selected.assigned_condition : null);
            preferredCondition = fallbackCondition && String(fallbackCondition).trim()
                ? String(fallbackCondition).trim()
                : 'New';
        }
        if (!conditionExists(preferredCondition)) {
            dynamicReturnConditions.push(preferredCondition);
        }
        updateReturnConditionOptions(preferredCondition);

        const maxQty = getReturnAssignmentQuantity(selected) || 1;
        if (returnQuantityInput) {
            returnQuantityInput.value = String(Math.max(1, maxQty));
        }
        updateReturnQuantityLimits(selected);
        setReturnQuantityFeedback('');
        validateReturnQuantity();
    };

    populateAssignmentSelect();
    const initialSelection = sortedCandidates.find(c => c.assignment_id === assignmentId) || sortedCandidates[0] || null;
    applySelection(initialSelection);
    if (returnAssignmentSelect) {
        returnAssignmentSelect.value = initialSelection ? String(initialSelection.assignment_id) : '';
        returnAssignmentSelect.onchange = () => {
            const value = returnAssignmentSelect.value;
            const selected = value === 'all'
                ? allMatchingSelection
                : sortedCandidates.find(c => String(c.assignment_id) === value) || sortedCandidates[0] || null;
            applySelection(selected);
        };
    }


    const modal = new bootstrap.Modal(document.getElementById('returnUniformModal'));
    modal.show();
}

// Assign uniform (update to use selectedId)
document.getElementById('assignUniformForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const selectedId = document.getElementById('uniformInput').dataset.selectedId;
        const selectedOption = selectedId ? availableUniformMap.get(String(selectedId)) : null;
        if (!selectedOption) {
            showFlashMessage('Please select a valid uniform from the list.', 'danger');
            return;
        }
        const condition = document.getElementById('assignCondition').value;
        if (!['New', 'Good', 'Fair', 'Poor'].includes(condition)) {
            showFlashMessage('Please select a valid condition.', 'danger');
            return;
        }
        const assignedBy = assignPerformedByInput ? (assignPerformedByInput.value || '').trim() : '';
        if (!assignedBy) {
            showFlashMessage('Please enter who is assigning the uniform.', 'danger');
            if (assignPerformedByInput) {
                assignPerformedByInput.focus();
            }
            return;
        }
        const staffId = parseInt(document.getElementById('assignStaffId').value, 10);
        if (Number.isNaN(staffId)) {
            showFlashMessage('Unable to determine the selected staff member.', 'danger');
            return;
        }
        if (!validateAssignQuantity()) {
            return;
        }
        const quantity = Number.parseInt(assignQuantityInput.value, 10);
        const response = await fetch(`${STAFF_API}/assign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                staff_id: staffId,
                uniform_id: parseInt(selectedOption.uniform_id, 10),
                vessel: selectedOption.vessel,
                storage_location: selectedOption.storage_location,
                condition,
                quantity,
                assigned_by: assignedBy
            })
        });

        if (!response.ok) {
            throw new Error('Failed to assign uniform');
        }

        showFlashMessage('Uniform assigned successfully');
        window.localStorage?.setItem('lastAssignedBy', assignedBy);
        bootstrap.Modal.getInstance(document.getElementById('assignUniformModal')).hide();
        document.getElementById('assignUniformForm').reset();
        if (assignQuantityAvailable) {
            assignQuantityAvailable.textContent = '0';
        }
        setAssignQuantityFeedback('');
        loadStaffList({ preserveSearch: true });
    } catch (error) {
        showFlashMessage(error.message, 'danger');
    }
});

// Return uniform
document.getElementById('returnUniformForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const assignmentId = document.getElementById('returnAssignmentId').value;
        if (!assignmentId) {
            showFlashMessage('Unable to determine the selected assignment.', 'danger');
            return;
        }
        const status = document.querySelector('input[name="returnStatus"]:checked').value;
        const condition = (returnConditionSelect.value || '').trim();
        const reason = returnReasonInput ? (returnReasonInput.value || '').trim() : '';

        if (!condition || condition === '__add__') {
            showFlashMessage('Please select a valid return condition.', 'danger');
            return;
        }
        if (reason.length > 250) {
            showFlashMessage('Reason must be 250 characters or fewer.', 'danger');
            return;
        }
        if (!validateReturnQuantity()) {
            return;
        }
        const quantity = Number.parseInt(returnQuantityInput.value, 10);

        const response = await fetch(`${STAFF_API}/return/${assignmentId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                status,
                condition,
                quantity,
                reason
            })
        });

        if (!response.ok) {
            throw new Error('Failed to return uniform');
        }

        showFlashMessage('Uniform returned successfully');
        bootstrap.Modal.getInstance(document.getElementById('returnUniformModal')).hide();
        document.getElementById('returnUniformForm').reset();
        setReturnQuantityFeedback('');
        loadStaffList({ preserveSearch: true });
    } catch (error) {
        showFlashMessage(error.message, 'danger');
    }
});

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
        a.download = typeof getCsvFilename === 'function'
            ? getCsvFilename('staff_assignment')
            : 'staff_assignment.csv';
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
    const currentView = filterStaffByQuery(allStaff, currentStaffSearchQuery);
    return currentView.every(person => (person.assignments || []).length > 1 ? expandedStaffIds.has(person.id) : true);
}

document.getElementById('toggleAllStaffBtn').addEventListener('click', function() {
    const currentView = filterStaffByQuery(allStaff, currentStaffSearchQuery);
    const expand = !currentView.every(person => (person.assignments || []).length > 1 ? expandedStaffIds.has(person.id) : true);

    currentView.forEach(person => {
        if ((person.assignments || []).length > 1) {
            if (expand) {
                expandedStaffIds.add(person.id);
            } else {
                expandedStaffIds.delete(person.id);
            }
        }
    });

    let view = currentView;
    if (sortField) {
        view = sortStaff(view, sortField);
    }
    renderStaffList(view);
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

    if (returnConditionSelect) {
        updateReturnConditionOptions(previousReturnCondition);

        returnConditionSelect.addEventListener('focus', () => {
            previousReturnCondition = returnConditionSelect.value;
        });

        returnConditionSelect.addEventListener('change', async () => {
            if (returnConditionSelect.value === '__add__') {
                const newCondition = await promptForNewCondition();
                if (newCondition) {
                    dynamicReturnConditions.push(newCondition);
                    updateReturnConditionOptions(newCondition);
                } else {
                    updateReturnConditionOptions(previousReturnCondition);
                }
            } else {
                previousReturnCondition = returnConditionSelect.value;
            }
        });
    }

    const assignModalElement = document.getElementById('assignUniformModal');
    if (assignModalElement) {
        assignModalElement.addEventListener('hidden.bs.modal', () => {
            setAssignQuantityFeedback('');
            if (assignQuantityInput) {
                assignQuantityInput.value = '1';
            }
            if (assignQuantityAvailable) {
                assignQuantityAvailable.textContent = '0';
            }
        });
    }

    const returnModalElement = document.getElementById('returnUniformModal');
    if (returnModalElement) {
        returnModalElement.addEventListener('hidden.bs.modal', () => {
            currentReturnAssignment = null;
            setReturnQuantityFeedback('');
            if (returnQuantityInput) {
                returnQuantityInput.value = '1';
            }
            if (returnQuantityAvailable) {
                returnQuantityAvailable.textContent = '0';
            }
            const defaultReturnRadio = document.getElementById('returnToStock');
            const discardRadio = document.getElementById('discardUniform');
            if (defaultReturnRadio) defaultReturnRadio.checked = true;
            if (discardRadio) discardRadio.checked = false;
            dynamicReturnConditions = [];
            updateReturnConditionOptions('Good');
            previousReturnCondition = returnConditionSelect ? returnConditionSelect.value : baseReturnConditions[0];
        });
    }
});
