// API endpoints
const HISTORY_API = '/api/uniforms/assignment-history';
const EXPORT_API = '/api/uniforms/assignment-history/export';
const DELETE_API = '/api/uniforms/assignment-history/delete';

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

// Format date as DD-MMM-YY
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
        return '-';
    }
    const day = String(date.getDate()).padStart(2, '0');
    const month = MONTH_LABELS[date.getMonth()] || '-';
    const year = String(date.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
}

function normalizeDateKey(value) {
    if (!value) return 'unknown';
    if (value instanceof Date) {
        return value.toISOString().split('T')[0];
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return 'unknown';
        const asDate = new Date(trimmed);
        if (!Number.isNaN(asDate.getTime())) {
            return asDate.toISOString().split('T')[0];
        }
        const parts = trimmed.split(/[ T]/);
        if (parts.length > 0 && parts[0]) {
            return parts[0];
        }
    }
    return 'unknown';
}

let allHistory = [];
let visibleHistory = [];
let editMode = false;
const selectedHistoryIds = new Set();
const sortState = { field: 'returned_date', direction: 'desc' };

const historyTable = () => document.getElementById('historyTable');
const editButton = () => document.getElementById('editHistoryBtn');
const deleteButton = () => document.getElementById('deleteHistoryBtn');
const selectAllCheckbox = () => document.getElementById('selectAllHistory');
const assignedHeader = () => document.getElementById('assignedDateHeader');
const returnedHeader = () => document.getElementById('returnedDateHeader');

function getFilterValue(id) {
    return (document.getElementById(id)?.value || '').trim().toLowerCase();
}

function applyHistoryFilters(source) {
    const query = getFilterValue('historySearch');
    if (!query) {
        return source;
    }

    return source.filter(item => {
        const haystack = [
            item.staff_name,
            item.department,
            item.uniform_type,
            item.size,
            item.color,
            item.assigned_by,
            item.assigned_condition,
            item.returned_condition,
            item.notes
        ];
        return haystack.some(value => (value || '').toLowerCase().includes(query));
    });
}

function refreshHistoryView() {
    const filtered = applyHistoryFilters(allHistory);
    renderHistoryList(filtered);
}

function getDateTimestamp(value) {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function resolveDateForSort(item, field, direction) {
    const ts = getDateTimestamp(item[field]);
    if (ts === null) {
        return direction === 'asc' ? Infinity : -Infinity;
    }
    return ts;
}

function sortHistoryItems(items) {
    const direction = sortState.direction === 'asc' ? 1 : -1; // default desc
    const primaryField = sortState.field === 'assigned_date' ? 'assigned_date' : 'returned_date';
    const secondaryField = primaryField === 'assigned_date' ? 'returned_date' : 'assigned_date';

    const sorted = [...items];
    sorted.sort((a, b) => {
        const aPrimary = resolveDateForSort(a, primaryField, sortState.direction);
        const bPrimary = resolveDateForSort(b, primaryField, sortState.direction);

        if (aPrimary !== bPrimary) {
            return direction * (aPrimary - bPrimary);
        }

        const aSecondary = resolveDateForSort(a, secondaryField, sortState.direction);
        const bSecondary = resolveDateForSort(b, secondaryField, sortState.direction);
        return direction * (aSecondary - bSecondary);
    });
    return sorted;
}

function applySort(field) {
    if (sortState.field === field) {
        sortState.direction = sortState.direction === 'desc' ? 'asc' : 'desc';
    } else {
        sortState.field = field;
        sortState.direction = 'desc';
    }
    updateSortIndicators();
    refreshHistoryView();
}

function updateSortIndicators() {
    const indicators = {
        asc: '▲',
        desc: '▼'
    };
    const headers = [
        { el: assignedHeader(), field: 'assigned_date', label: 'Assigned Date' },
        { el: returnedHeader(), field: 'returned_date', label: 'Returned Date' }
    ];

    headers.forEach(({ el, field, label }) => {
        if (!el) return;
        const isActive = sortState.field === field;
        const indicator = isActive ? indicators[sortState.direction] : '';
        el.innerHTML = `${label} <span class="sort-indicator" aria-hidden="true">${indicator || ''}</span>`;
        el.setAttribute('aria-sort', isActive ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none');
    });
}

// Load history
async function loadHistory() {
    try {
        const response = await fetch(HISTORY_API);
        if (!response.ok) {
            throw new Error('Failed to fetch history');
        }
        const history = await response.json();
        allHistory = history; // Store for filtering
        refreshHistoryView();
    } catch (error) {
        showFlashMessage(error.message, 'danger');
    }
}

function renderHistoryList(history) {
    const mergedHistory = history.reduce((acc, item) => {
        if (!item) return acc;
        const status = (item.status || (item.returned_date ? 'returned' : 'assigned')).toLowerCase();
        const dateValue = status === 'assigned' ? item.assigned_date : item.returned_date;
        const dateKey = normalizeDateKey(dateValue);
        const key = [
            item.staff_name,
            item.department,
            item.uniform_type,
            item.size,
            item.color,
            item.assigned_by || '-',
            item.assigned_condition || 'New',
            item.returned_condition || '-',
            item.notes || '-',
            status,
            dateKey
        ];
        if (dateKey === 'unknown') {
            key.push(`id:${item.assignment_id || Math.random()}`);
        }
        const keyString = key.join('__');
        if (!acc[keyString]) {
            acc[keyString] = { ...item };
            acc[keyString].quantity = item.quantity || 1;
            acc[keyString].assigned_date = item.assigned_date;
            acc[keyString].returned_date = item.returned_date;
        } else {
            acc[keyString].quantity += item.quantity || 1;
        }
        return acc;
    }, {});

    const mergedArray = Object.values(mergedHistory);
    const sortedHistory = sortHistoryItems(mergedArray);

    visibleHistory = sortedHistory;
    updateSortIndicators();
    const table = historyTable();
    if (table) {
        table.classList.toggle('history-table-edit', editMode);
    }

    const historyList = document.getElementById('historyList');
    historyList.innerHTML = sortedHistory.map(item => {
        const status = (item.status || (item.returned_date ? 'returned' : 'assigned')).toLowerCase();
        const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
        const badgeClass = status === 'returned'
            ? 'bg-warning'
            : status === 'discarded'
                ? 'bg-secondary'
                : 'bg-success';
        const isSelectable = status === 'returned' || status === 'discarded';
        const isChecked = selectedHistoryIds.has(item.assignment_id);
        return `
        <tr>
            <td class="history-date-cell" data-label="Assigned Date">${formatDate(item.assigned_date)}</td>
            <td class="history-date-cell" data-label="Returned Date">${formatDate(item.returned_date)}</td>
            <td class="history-staff-cell" data-label="Staff">
                <strong>${item.staff_name || '-'}</strong>
            </td>
            <td data-label="Department">${item.department || '-'}</td>
            <td class="history-uniform-type-cell" data-label="Uniform">
                <strong>${item.uniform_type || '-'}</strong>
            </td>
            <td data-label="Size">${item.size || '-'}</td>
            <td data-label="Color">${item.color || '-'}</td>
            <td data-label="Assigned by">${item.assigned_by ? item.assigned_by : '-'}</td>
            <td class="history-assigned-condition-cell" data-label="Assigned Condition">${item.assigned_condition ? item.assigned_condition : '-'}</td>
            <td class="history-returned-condition-cell" data-label="Returned Condition">${item.returned_condition ? item.returned_condition : '-'}</td>
            <td class="text-center history-qty-cell" data-label="Qty">${item.quantity || 1}</td>
            <td class="history-status-cell" data-label="Status">
                <span class="badge ${badgeClass}">${statusLabel}</span>
            </td>
            <td class="history-comment-cell" data-label="Comment" title="${item.notes || ''}">${item.notes || '-'}</td>
            <td class="history-select-cell text-center" data-label="Select">
                <input type="checkbox" class="form-check-input history-select"
                    data-id="${item.assignment_id}"
                    ${isSelectable ? '' : 'disabled'}
                    ${isChecked ? 'checked' : ''}
                    aria-label="Select history entry for ${item.staff_name || 'staff member'}">
            </td>
        </tr>`;
    }).join('');

    if (editMode) {
        attachSelectionHandlers();
    } else {
        const selectAll = selectAllCheckbox();
        if (selectAll) {
            selectAll.checked = false;
            selectAll.indeterminate = false;
            selectAll.disabled = true;
        }
    }
}

const unifiedSearchInput = document.getElementById('historySearch');
if (unifiedSearchInput) {
    unifiedSearchInput.addEventListener('input', refreshHistoryView);
}

const assignedHeaderEl = assignedHeader();
if (assignedHeaderEl) {
    assignedHeaderEl.addEventListener('click', () => applySort('assigned_date'));
}

const returnedHeaderEl = returnedHeader();
if (returnedHeaderEl) {
    returnedHeaderEl.addEventListener('click', () => applySort('returned_date'));
}

function attachSelectionHandlers() {
    const checkboxes = document.querySelectorAll('.history-select');
    checkboxes.forEach(box => {
        box.onchange = () => {
            const id = parseInt(box.getAttribute('data-id'));
            if (!Number.isInteger(id)) return;
            if (box.checked) {
                selectedHistoryIds.add(id);
            } else {
                selectedHistoryIds.delete(id);
            }
            updateDeleteState();
            syncSelectAllState();
        };
    });

    const selectAll = selectAllCheckbox();
    if (selectAll) {
        selectAll.disabled = getSelectableIds().length === 0;
        selectAll.onchange = () => {
            const eligibleIds = getSelectableIds();
            const shouldSelect = selectAll.checked && !selectAll.indeterminate;
            eligibleIds.forEach(id => {
                const checkbox = document.querySelector(`.history-select[data-id="${id}"]`);
                if (!checkbox || checkbox.disabled) return;
                checkbox.checked = shouldSelect;
                if (shouldSelect) {
                    selectedHistoryIds.add(id);
                } else {
                    selectedHistoryIds.delete(id);
                }
            });
            updateDeleteState();
            syncSelectAllState();
        };
        syncSelectAllState();
    }
}

function updateDeleteState() {
    const btn = deleteButton();
    if (!btn) return;
    btn.disabled = selectedHistoryIds.size === 0;
}

function resetSelection() {
    selectedHistoryIds.clear();
    updateDeleteState();
    syncSelectAllState();
}

function toggleEditMode() {
    editMode = !editMode;
    resetSelection();
    const editBtn = editButton();
    const delBtn = deleteButton();

    if (editBtn) {
        editBtn.innerHTML = editMode
            ? '<i class="bi bi-x-lg"></i> <span class="btn-text">Cancel</span>'
            : '<i class="bi bi-pencil"></i> <span class="btn-text">Edit</span>';
    }

    if (delBtn) {
        delBtn.classList.toggle('d-none', !editMode);
        delBtn.disabled = selectedHistoryIds.size === 0;
    }

    const searchValue = document.getElementById('historySearch').value.trim().toLowerCase();
    const filtered = searchValue
        ? allHistory.filter(item => item.staff_name && item.staff_name.toLowerCase().includes(searchValue))
        : allHistory;
    renderHistoryList(filtered);
}

function getSelectableIds() {
    return visibleHistory
        .filter(item => {
            const status = (item.status || (item.returned_date ? 'returned' : 'assigned')).toLowerCase();
            return status === 'returned' || status === 'discarded';
        })
        .map(item => item.assignment_id);
}

function syncSelectAllState() {
    const selectAll = selectAllCheckbox();
    if (!selectAll) {
        return;
    }

    const eligibleIds = getSelectableIds();
    selectedHistoryIds.forEach(id => {
        if (!eligibleIds.includes(id)) {
            selectedHistoryIds.delete(id);
        }
    });
    if (!editMode || eligibleIds.length === 0) {
        selectAll.checked = false;
        selectAll.indeterminate = false;
        selectAll.disabled = true;
        return;
    }

    selectAll.disabled = false;
    const selectedCount = eligibleIds.filter(id => selectedHistoryIds.has(id)).length;

    if (selectedCount === 0) {
        selectAll.checked = false;
        selectAll.indeterminate = false;
    } else if (selectedCount === eligibleIds.length) {
        selectAll.checked = true;
        selectAll.indeterminate = false;
    } else {
        selectAll.checked = false;
        selectAll.indeterminate = true;
    }
}

async function deleteSelectedHistory() {
    if (!selectedHistoryIds.size) return;
    const confirmation = confirm('Remove the selected history entries? This action cannot be undone.');
    if (!confirmation) return;

    try {
        const response = await fetch(DELETE_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: Array.from(selectedHistoryIds) })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to delete selected entries');
        }

        showFlashMessage('Selected history entries removed');
        toggleEditMode();
        await loadHistory();
    } catch (error) {
        showFlashMessage(error.message || 'Failed to delete selected entries', 'danger');
    }
}

// Export history to CSV
document.getElementById('exportCsvBtn').addEventListener('click', async () => {
    try {
        const response = await fetch(EXPORT_API);
        if (!response.ok) {
            throw new Error('Failed to export history');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = typeof getCsvFilename === 'function'
            ? getCsvFilename('assignment_history')
            : 'assignment_history.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showFlashMessage('Export completed successfully');
    } catch (error) {
        showFlashMessage(error.message, 'danger');
    }
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    updateSortIndicators();
    loadHistory();
    const editBtn = editButton();
    const delBtn = deleteButton();
    if (editBtn) {
        editBtn.addEventListener('click', toggleEditMode);
    }
    if (delBtn) {
        delBtn.addEventListener('click', deleteSelectedHistory);
    }
});
