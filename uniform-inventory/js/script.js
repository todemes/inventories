// API endpoints
const UNIFORMS_API = '/api/uniforms';
const ASSIGNMENTS_API = '/api/staff/assignments';
const STOCK_HISTORY_API = `${UNIFORMS_API}/stock-history`;
const STOCK_HISTORY_EXPORT_API = `${UNIFORMS_API}/stock-history/export`;

// Constants
const SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'No Size'];
const COLORS = ['Black', 'Blue', 'Navy', 'White'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STOCK_UPDATE_REASON_OPTIONS = [
    'Stock take',
    'New order',
    'Other'
];
const DEFAULT_VESSEL = 'yin';
const DEFAULT_STORAGE_LOCATION = 'Storage';
const STORAGE_LOCATION_ADD_NEW = 'add_new';
const STORAGE_LOCATION_OTHER_LABEL = 'Others';

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

let lastGroupedUniforms = {};
let lastUniformsById = {};
let lastAssignedCounts = {};
let lastAssignedDetails = {};
let assignedDetailsModal = null;
let assignedModalTitle = null;
let assignedModalBody = null;
let stockLocationsModal = null;
let stockLocationsModalTitle = null;
let stockLocationsModalBody = null;
const updateUniformSummary = document.getElementById('updateUniformSummary');
const updateUniformIdInput = document.getElementById('updateUniformId');
const currentStockHiddenInput = document.getElementById('currentStock');
const currentStockDisplayInput = document.getElementById('currentStockDisplay');
const newStockInput = document.getElementById('newStock');
const addUpdatedByInput = document.getElementById('addUpdatedBy');
const updatePerformedByInput = document.getElementById('updatePerformedBy');
const updateReasonSelect = document.getElementById('updateReason');
const updateReasonDetailWrapper = document.getElementById('updateReasonDetailWrapper');
const updateReasonDetailInput = document.getElementById('updateReasonDetail');
const addVesselSelect = document.getElementById('addVessel');
const addStorageLocationInput = document.getElementById('addStorageLocation');
const updateVesselSelect = document.getElementById('updateVessel');
const updateStorageLocationInput = document.getElementById('updateStorageLocation');
const openTransferStockBtn = document.getElementById('openTransferStockBtn');
const transferStockForm = document.getElementById('transferStockForm');
const transferUniformIdInput = document.getElementById('transferUniformId');
const transferUniformSummary = document.getElementById('transferUniformSummary');
const transferFromLocationSelect = document.getElementById('transferFromLocation');
const transferToVesselSelect = document.getElementById('transferToVessel');
const transferToStorageLocationInput = document.getElementById('transferToStorageLocation');
const transferQuantityInput = document.getElementById('transferQuantity');
const transferAvailableQuantity = document.getElementById('transferAvailableQuantity');
const transferUpdatedByInput = document.getElementById('transferUpdatedBy');
const transferCommentInput = document.getElementById('transferComment');
let activeLocationsUniformId = null;

// Load stock list
async function loadStockList() {
    try {
        const [uniformsResponse, assignmentsResponse] = await Promise.all([
            fetch(UNIFORMS_API),
            fetch(ASSIGNMENTS_API)
        ]);
        
        if (!uniformsResponse.ok) {
            throw new Error('Failed to fetch uniforms');
        }
        if (!assignmentsResponse.ok) {
            throw new Error('Failed to fetch assignments');
        }
        
        const uniforms = await uniformsResponse.json();
        const assignments = await assignmentsResponse.json();
        
        // Count assigned uniforms (only count active assignments)
        const activeAssignments = assignments.filter(assignment => assignment.status === 'assigned');

        const assignedCounts = activeAssignments.reduce((acc, assignment) => {
            const { uniform_id } = assignment;
            acc[uniform_id] = (acc[uniform_id] || 0) + (assignment.quantity || 1);
            return acc;
        }, {});

        const assignedDetails = activeAssignments.reduce((acc, assignment) => {
            const { uniform_id } = assignment;
            if (!acc[uniform_id]) {
                acc[uniform_id] = [];
            }
            acc[uniform_id].push(assignment);
            return acc;
        }, {});
        
        
        // Group uniforms by type
        const groupedUniforms = uniforms.reduce((acc, uniform) => {
            if (!acc[uniform.type]) {
                acc[uniform.type] = [];
            }
            acc[uniform.type].push(uniform);
            return acc;
        }, {});
        lastGroupedUniforms = groupedUniforms;
        lastUniformsById = uniforms.reduce((acc, uniform) => {
            acc[uniform.id] = uniform;
            return acc;
        }, {});
        lastAssignedCounts = assignedCounts;
        lastAssignedDetails = assignedDetails;
        renderStockSections(groupedUniforms, assignedCounts);

    } catch (error) {
        showFlashMessage(error.message, 'danger');
    }
}


function truncateDisplayText(value, maxLength = 25) {
    const text = String(value || '');
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeLocationKey(value) {
    return (value || '').trim().toLowerCase();
}

function getUniformLocations(uniform) {
    return Array.isArray(uniform?.locations) ? uniform.locations : [];
}

function getLocationQuantity(uniform, vessel, storageLocation) {
    const normalizedVessel = (vessel || DEFAULT_VESSEL).trim().toLowerCase();
    const normalizedStorage = normalizeLocationKey(storageLocation);
    const locations = getUniformLocations(uniform);
    const location = locations.find(item =>
        (item.vessel || '').toLowerCase() === normalizedVessel &&
        normalizeLocationKey(item.storage_location) === normalizedStorage
    );
    if (location) {
        return Number(location.quantity || 0);
    }

    if (normalizedStorage === normalizeLocationKey(DEFAULT_STORAGE_LOCATION)) {
        const legacyLocation = locations.find(item =>
            (item.vessel || '').toLowerCase() === normalizedVessel &&
            normalizeLocationKey(item.storage_location) === 'unspecified'
        );
        return legacyLocation ? Number(legacyLocation.quantity || 0) : 0;
    }

    return 0;
}

function getPositiveLocations(uniform) {
    return getUniformLocations(uniform).filter(location => Number(location.quantity || 0) > 0);
}

function formatLocationLabel(location, options = {}) {
    const includeQuantity = options.includeQuantity !== false;
    const vessel = String(location?.vessel || DEFAULT_VESSEL).toUpperCase();
    const storage = location?.storage_location || DEFAULT_STORAGE_LOCATION;
    const quantity = Number(location?.quantity || 0);
    return includeQuantity ? vessel + ' · ' + storage + ' — Qty ' + quantity : vessel + ' · ' + storage;
}

function getLocationOptionLabel(uniform, vessel, storageLocation) {
    if (!uniform || !storageLocation) return storageLocation || DEFAULT_STORAGE_LOCATION;
    const quantity = getLocationQuantity(uniform, vessel || DEFAULT_VESSEL, storageLocation);
    return (storageLocation || DEFAULT_STORAGE_LOCATION) + ' — Qty ' + quantity;
}

function populateStorageLocationSelect(select, { uniform = null, vessel = DEFAULT_VESSEL, selected = DEFAULT_STORAGE_LOCATION, includeQuantities = false } = {}) {
    if (!select) return;
    const selectedValue = String(selected || DEFAULT_STORAGE_LOCATION).trim() || DEFAULT_STORAGE_LOCATION;
    const normalizedSelected = selectedValue.toLowerCase();
    const storageLabel = includeQuantities ? getLocationOptionLabel(uniform, vessel, DEFAULT_STORAGE_LOCATION) : DEFAULT_STORAGE_LOCATION;

    select.innerHTML = '';
    const storageOption = document.createElement('option');
    storageOption.value = DEFAULT_STORAGE_LOCATION;
    storageOption.textContent = storageLabel;
    select.appendChild(storageOption);

    if (normalizedSelected && normalizedSelected !== DEFAULT_STORAGE_LOCATION.toLowerCase() && normalizedSelected !== STORAGE_LOCATION_ADD_NEW) {
        const currentOption = document.createElement('option');
        currentOption.value = selectedValue;
        currentOption.textContent = includeQuantities ? getLocationOptionLabel(uniform, vessel, selectedValue) : selectedValue;
        currentOption.dataset.temporaryLocation = 'true';
        select.appendChild(currentOption);
    }

    const addOption = document.createElement('option');
    addOption.value = STORAGE_LOCATION_ADD_NEW;
    addOption.textContent = STORAGE_LOCATION_OTHER_LABEL;
    select.appendChild(addOption);
    select.value = normalizedSelected && normalizedSelected !== STORAGE_LOCATION_ADD_NEW ? selectedValue : DEFAULT_STORAGE_LOCATION;
}

function handleStorageLocationSelectChange(select, options = {}) {
    if (!select || select.value !== STORAGE_LOCATION_ADD_NEW) return false;
    const newLocation = prompt('Enter storage location:');
    if (newLocation && newLocation.trim()) {
        const trimmed = newLocation.trim();
        populateStorageLocationSelect(select, { ...options, selected: trimmed });
        select.value = trimmed;
        return true;
    }
    populateStorageLocationSelect(select, options);
    return false;
}

function getLocationSummary(uniform) {
    const locations = getPositiveLocations(uniform);
    if (!locations.length) {
        return 'No locations';
    }
    if (locations.length === 1) {
        const location = locations[0];
        return `${(location.vessel || '').toUpperCase()} · ${location.storage_location || DEFAULT_STORAGE_LOCATION}`;
    }
    return `${locations.length} locations`;
}

function openStockLocationsModal(uniformId) {
    const uniform = lastUniformsById[uniformId];
    if (!uniform || !stockLocationsModal || !stockLocationsModalTitle || !stockLocationsModalBody) {
        return;
    }

    activeLocationsUniformId = uniformId;
    stockLocationsModalTitle.textContent = [uniform.type, uniform.size, uniform.color].filter(Boolean).join(' · ');
    const locations = getPositiveLocations(uniform);

    if (!locations.length) {
        stockLocationsModalBody.innerHTML = '<p class="text-muted mb-0">No stock locations recorded.</p>';
    } else {
        const rows = locations
            .sort((a, b) => {
                const vesselCmp = String(a.vessel || '').localeCompare(String(b.vessel || ''), undefined, { sensitivity: 'base' });
                if (vesselCmp !== 0) return vesselCmp;
                return String(a.storage_location || '').localeCompare(String(b.storage_location || ''), undefined, { sensitivity: 'base' });
            })
            .map(location => `
                <tr>
                    <td><span class="vessel-pill">${String(location.vessel || '').toUpperCase()}</span></td>
                    <td>${location.storage_location || DEFAULT_STORAGE_LOCATION}</td>
                    <td class="text-end fw-semibold">${location.quantity || 0}</td>
                </tr>
            `).join('');

        stockLocationsModalBody.innerHTML = `
            <div class="location-total">
                <span>Total stock</span>
                <strong>${uniform.current_stock || 0}</strong>
            </div>
            <div class="table-responsive">
                <table class="table table-sm location-detail-table mb-0">
                    <thead>
                        <tr>
                            <th>Vessel</th>
                            <th>Storage</th>
                            <th class="text-end">Qty</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    }

    stockLocationsModal.show();
}

function getDefaultLocationForUniform(uniform) {
    const locations = getUniformLocations(uniform);
    const positiveLocation = locations.find(location => Number(location.quantity || 0) > 0);
    return positiveLocation || locations[0] || { vessel: DEFAULT_VESSEL, storage_location: DEFAULT_STORAGE_LOCATION, quantity: 0 };
}

function refreshUpdateLocationStock({ syncNewStock = false } = {}) {
    const uniformId = updateUniformIdInput?.value;
    const uniform = uniformId ? lastUniformsById[uniformId] : null;
    const vessel = updateVesselSelect?.value || DEFAULT_VESSEL;
    const storageLocation = updateStorageLocationInput?.value || '';
    const previousDisplayedQuantity = Number.parseInt(currentStockHiddenInput?.value || '0', 10) || 0;
    const quantity = uniform && storageLocation.trim()
        ? getLocationQuantity(uniform, vessel, storageLocation)
        : 0;
    const newStockWasStillSynced = newStockInput
        ? (Number.parseInt(newStockInput.value || '0', 10) || 0) === previousDisplayedQuantity
        : false;
    if (currentStockHiddenInput) currentStockHiddenInput.value = String(quantity);
    if (currentStockDisplayInput) currentStockDisplayInput.value = String(quantity);
    if (newStockInput && (syncNewStock || newStockWasStillSynced)) {
        newStockInput.value = String(quantity);
    }
}

function renderStockSections(groupedUniforms, assignedCounts) {
    const stockList = document.getElementById('stockList');
    stockList.innerHTML = '';
    // Get filter value
    const filterValue = (document.getElementById('stockTypeSearch')?.value || '').trim().toLowerCase();
    for (const [type, items] of Object.entries(groupedUniforms)) {
        if (filterValue && !type.toLowerCase().includes(filterValue)) continue;
        // Sort items by color, then by size (using SIZES order)
        const sortedItems = items.slice().sort((a, b) => {
            const colorCmp = a.color.localeCompare(b.color, undefined, { sensitivity: 'base' });
            if (colorCmp !== 0) return colorCmp;
            return SIZES.indexOf(a.size) - SIZES.indexOf(b.size);
        });
        const section = document.createElement('div');
        section.className = 'card mb-4';
        section.innerHTML = `
            <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="mb-0 uniform-title" title="${escapeHtml(type)}">${escapeHtml(truncateDisplayText(type, 25))}</h5>
                <button class="btn btn-stock-action btn-sm" onclick="showAddUniformModal('${type}')" title="Add ${type}">
                    <i class="bi bi-plus-lg"></i>
                </button>
            </div>
            <div class="card-body">
                <div class="table-responsive stock-table-responsive">
                    <table class="table table-hover stock-management-table">
                        <colgroup>
                            <col class="stock-size-col">
                            <col class="stock-color-col">
                            <col class="stock-current-col">
                            <col class="stock-assigned-col">
                            <col class="stock-actions-col">
                        </colgroup>
                        <thead>
                            <tr>
                                <th>Size</th>
                                <th>Color</th>
                                <th title="Current Stock">Stock</th>
                                <th>Assigned</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sortedItems.map(item => {
                                const assignedCount = assignedCounts[item.id] || 0;
                                const assignedCell = assignedCount > 0
                                    ? `<button type="button" class="btn btn-link p-0 assigned-count" data-uniform-id="${item.id}" data-uniform-type="${encodeURIComponent(item.type)}" data-uniform-size="${encodeURIComponent(item.size)}" data-uniform-color="${encodeURIComponent(item.color)}" title="View assigned staff">${assignedCount}</button>`
                                    : '<span>0</span>';
                                return `
                                    <tr>
                                        <td data-label="Size">${item.size}</td>
                                        <td data-label="Color">${item.color}</td>
                                        <td data-label="Current Stock" class="stock-current-cell">
                                            <button type="button" class="stock-total stock-total-button" onclick="openStockLocationsModal(${item.id})" title="View stock locations" aria-label="View stock locations for ${escapeHtml(item.type)}">
                                                ${item.current_stock}
                                            </button>
                                        </td>
                                        <td data-label="Assigned">${assignedCell}</td>
                                        <td data-label="Actions">
                                            <div class="row-actions">
                                                <button class="btn btn-stock-action btn-sm" 
                                                        onclick="showUpdateStockModal(${item.id}, ${item.current_stock}, '${encodeURIComponent(item.type)}', '${encodeURIComponent(item.size)}', '${encodeURIComponent(item.color)}')"
                                                        title="Update Stock">
                                                    <i class="bi bi-arrow-repeat"></i>
                                                </button>
                                                <button class="btn btn-stock-action btn-sm" 
                                                        onclick="deleteUniform(${item.id})"
                                                        title="Delete">
                                                    <i class="bi bi-trash"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        stockList.appendChild(section);
    }
    // Initialize tooltips
    const tooltips = document.querySelectorAll('[title]');
    tooltips.forEach(el => new bootstrap.Tooltip(el));
}

function formatAssignedDate(value) {
    if (!value) return '-';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '-';
    }
    const day = String(date.getDate()).padStart(2, '0');
    const month = MONTH_LABELS[date.getMonth()] || '';
    const year = String(date.getFullYear()).slice(-2);
    return month ? `${day}-${month}-${year}` : '-';
}

function formatDateTime(value) {
    if (!value) return '-';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '-';
    }
    const day = String(date.getDate()).padStart(2, '0');
    const month = MONTH_LABELS[date.getMonth()] || '';
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

function handleAssignedCountClick(event) {
    const trigger = event.target.closest('.assigned-count');
    if (!trigger) {
        return;
    }
    event.preventDefault();
    const uniformId = trigger.dataset.uniformId;
    if (!uniformId) {
        return;
    }

    const meta = {
        type: decodeURIComponent(trigger.dataset.uniformType || ''),
        size: decodeURIComponent(trigger.dataset.uniformSize || ''),
        color: decodeURIComponent(trigger.dataset.uniformColor || '')
    };

    openAssignedDetailsModal(uniformId, meta);
}

function openAssignedDetailsModal(uniformId, meta) {
    if (!assignedDetailsModal || !assignedModalTitle || !assignedModalBody) {
        return;
    }

    const entries = lastAssignedDetails[uniformId] || [];
    const parts = [meta.type, meta.size, meta.color].filter(Boolean);
    assignedModalTitle.textContent = parts.length ? parts.join(' • ') : 'Assigned Staff';

    if (!entries.length) {
        assignedModalBody.innerHTML = '<p class="text-muted mb-0">No active assignments for this uniform.</p>';
    } else {
        const grouped = entries.reduce((acc, entry) => {
            const staffKey = entry.staff_id || entry.staff_name || 'unknown';
            if (!acc[staffKey]) {
                acc[staffKey] = {
                    staff: entry.staff_name || 'Unknown Staff',
                    department: entry.department || '-',
                    quantity: 0
                };
            }
            acc[staffKey].quantity += entry.quantity || 1;
            return acc;
        }, {});

        const rows = Object.values(grouped)
            .sort((a, b) => a.staff.localeCompare(b.staff, undefined, { sensitivity: 'base' }))
            .map(item => `
                <tr>
                    <td>${item.staff}</td>
                    <td>${item.department}</td>
                    <td class="text-center">${item.quantity}</td>
                </tr>
            `).join('');

        assignedModalBody.innerHTML = `
            <div class="table-responsive">
                <table class="table table-sm mb-0">
                    <thead>
                        <tr>
                            <th>Staff</th>
                            <th>Department</th>
                            <th class="text-center">Qty</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    }

    assignedDetailsModal.show();
}

function getSelectedTransferFromLocation() {
    if (!transferFromLocationSelect) return null;
    const selected = transferFromLocationSelect.selectedOptions[0];
    if (!selected) return null;
    return {
        vessel: selected.dataset.vessel || DEFAULT_VESSEL,
        storage_location: selected.dataset.storageLocation || DEFAULT_STORAGE_LOCATION,
        quantity: Number.parseInt(selected.dataset.quantity || '0', 10) || 0
    };
}

function updateTransferQuantityLimit() {
    const location = getSelectedTransferFromLocation();
    const max = location ? location.quantity : 0;
    if (transferAvailableQuantity) transferAvailableQuantity.textContent = String(max);
    if (transferQuantityInput) {
        transferQuantityInput.max = String(max);
        if ((Number.parseInt(transferQuantityInput.value || '1', 10) || 1) > max) {
            transferQuantityInput.value = String(Math.max(1, max));
        }
    }
}

function openTransferStockModal(uniformId = activeLocationsUniformId) {
    const uniform = uniformId ? lastUniformsById[uniformId] : null;
    const modalElement = document.getElementById('transferStockModal');
    if (!uniform || !modalElement || !transferFromLocationSelect || !transferUniformIdInput) {
        showFlashMessage('Unable to open transfer form for this uniform.', 'danger');
        return;
    }
    const locations = getPositiveLocations(uniform);
    if (!locations.length) {
        showFlashMessage('There is no stock available to transfer for this uniform.', 'info');
        return;
    }
    transferUniformIdInput.value = String(uniform.id);
    if (transferUniformSummary) {
        transferUniformSummary.textContent = [uniform.type, uniform.size, uniform.color].filter(Boolean).join(' • ');
    }
    transferFromLocationSelect.innerHTML = '';
    locations.forEach(location => {
        const option = document.createElement('option');
        option.value = String(location.vessel || DEFAULT_VESSEL) + '__' + String(location.storage_location || DEFAULT_STORAGE_LOCATION);
        option.dataset.vessel = location.vessel || DEFAULT_VESSEL;
        option.dataset.storageLocation = location.storage_location || DEFAULT_STORAGE_LOCATION;
        option.dataset.quantity = String(Number(location.quantity || 0));
        option.textContent = formatLocationLabel(location);
        transferFromLocationSelect.appendChild(option);
    });
    if (transferToVesselSelect) transferToVesselSelect.value = DEFAULT_VESSEL;
    if (transferQuantityInput) transferQuantityInput.value = '1';
    if (transferUpdatedByInput) transferUpdatedByInput.value = window.localStorage?.getItem('lastStockUpdatedBy') || '';
    if (transferCommentInput) transferCommentInput.value = '';
    populateStorageLocationSelect(transferToStorageLocationInput, { uniform, vessel: transferToVesselSelect?.value || DEFAULT_VESSEL, selected: DEFAULT_STORAGE_LOCATION, includeQuantities: true });
    updateTransferQuantityLimit();
    stockLocationsModal?.hide();
    new bootstrap.Modal(modalElement).show();
}
document.getElementById('stockTypeSearch').addEventListener('input', function() {
    renderStockSections(lastGroupedUniforms, lastAssignedCounts);
});

// Show add uniform modal
function showAddUniformModal(type = null) {
    const modal = document.getElementById('addUniformModal');
    const title = modal.querySelector('.modal-title');
    const typeInput = document.getElementById('uniformType');
    const sizeSelect = document.getElementById('size');
    const colorSelect = document.getElementById('color');
    
    // Reset form
    const form = document.getElementById('addUniformForm');
    form.reset();
    
    // Set title and type
    if (type) {
        title.textContent = `Add New ${type}`;
        typeInput.value = type;
        typeInput.readOnly = true;
    } else {
        title.textContent = 'Add New Uniform';
        typeInput.value = '';
        typeInput.readOnly = false;
    }
    
    // Reset and populate size dropdown
    sizeSelect.innerHTML = '<option value="">Select Size</option>';
    SIZES.forEach(size => {
        const option = document.createElement('option');
        option.value = size;
        option.textContent = size;
        sizeSelect.appendChild(option);
    });

    // Add "Add Size" option
    const addSizeOption = document.createElement('option');
    addSizeOption.value = "add_new";
    addSizeOption.textContent = "Add Size";
    sizeSelect.appendChild(addSizeOption);
    
    // Reset and populate color dropdown
    colorSelect.innerHTML = '<option value="">Select Color</option>';
    COLORS.forEach(color => {
        const option = document.createElement('option');
        option.value = color;
        option.textContent = color;
        colorSelect.appendChild(option);
    });
    
    // Add "Add Color" option
    const addColorOption = document.createElement('option');
    addColorOption.value = "add_new";
    addColorOption.textContent = "Add Color";
    colorSelect.appendChild(addColorOption);

    if (addVesselSelect) addVesselSelect.value = DEFAULT_VESSEL;
    populateStorageLocationSelect(addStorageLocationInput, { selected: DEFAULT_STORAGE_LOCATION });

    if (addUpdatedByInput) {
        const storedName = window.localStorage?.getItem('lastStockUpdatedBy') || '';
        addUpdatedByInput.value = storedName;
    }
    
    // Show modal
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

// Add event listener for modal close
document.getElementById('addUniformModal').addEventListener('hidden.bs.modal', function () {
    // Reset the form when modal is closed
    const form = document.getElementById('addUniformForm');
    form.reset();
    
    // Reset the type input
    const typeInput = document.getElementById('uniformType');
    typeInput.value = '';
    typeInput.readOnly = false;
    
    // Reset dropdowns
    const sizeSelect = document.getElementById('size');
    const colorSelect = document.getElementById('color');
    sizeSelect.value = '';
    colorSelect.value = '';
});

// Show update stock modal
function showUpdateStockModal(uniformId, currentStock, encodedType = '', encodedSize = '', encodedColor = '') {
    const modal = document.getElementById('updateStockModal');
    if (!modal || !updateUniformIdInput || !currentStockHiddenInput || !newStockInput) {
        return;
    }

    const type = decodeURIComponent(encodedType || '');
    const size = decodeURIComponent(encodedSize || '');
    const color = decodeURIComponent(encodedColor || '');

    const uniform = lastUniformsById[uniformId];
    const defaultLocation = getDefaultLocationForUniform(uniform);
    const locationQuantity = Number(defaultLocation.quantity || 0);

    updateUniformIdInput.value = String(uniformId);
    if (updateVesselSelect) updateVesselSelect.value = defaultLocation.vessel || DEFAULT_VESSEL;
    populateStorageLocationSelect(updateStorageLocationInput, { uniform, vessel: updateVesselSelect?.value || defaultLocation.vessel || DEFAULT_VESSEL, selected: defaultLocation.storage_location || DEFAULT_STORAGE_LOCATION, includeQuantities: true });
    if (updateStorageLocationInput) updateStorageLocationInput.value = defaultLocation.storage_location || DEFAULT_STORAGE_LOCATION;
    currentStockHiddenInput.value = String(locationQuantity);
    if (currentStockDisplayInput) {
        currentStockDisplayInput.value = String(locationQuantity);
    }
    newStockInput.value = String(locationQuantity);
    newStockInput.min = 0;

    if (updateUniformSummary) {
        const summaryParts = [type, size, color].filter(Boolean);
        updateUniformSummary.textContent = summaryParts.join(' • ');
    }

    if (updatePerformedByInput) {
        const storedName = window.localStorage?.getItem('lastStockUpdatedBy') || '';
        updatePerformedByInput.value = storedName;
    }

    if (updateReasonSelect) {
        updateReasonSelect.value = '';
    }
    if (updateReasonDetailWrapper) {
        updateReasonDetailWrapper.classList.add('d-none');
    }
    if (updateReasonDetailInput) {
        updateReasonDetailInput.value = '';
    }
    

    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();

    setTimeout(() => {
        newStockInput.focus();
        newStockInput.select();
    }, 200);
}

// Handle size selection
document.getElementById('size').addEventListener('change', function(e) {
    if (e.target.value === 'add_new') {
        const newSize = prompt('Enter new size:');
        if (newSize) {
            // Add new option
            const option = document.createElement('option');
            option.value = newSize;
            option.textContent = newSize;
            e.target.insertBefore(option, e.target.lastElementChild);
            // Select new option
            e.target.value = newSize;
            // Add to sizes array if not exists
            if (!SIZES.includes(newSize)) {
                SIZES.push(newSize);
            }
        } else {
            e.target.value = ''; // Reset to "Select Size" if cancelled
        }
    }
});

// Handle color selection
document.getElementById('color').addEventListener('change', function(e) {
    if (e.target.value === 'add_new') {
        const newColor = prompt('Enter new color name:');
        if (newColor) {
            // Add new option
            const option = document.createElement('option');
            option.value = newColor;
            option.textContent = newColor;
            e.target.insertBefore(option, e.target.lastElementChild);
            // Select new option
            e.target.value = newColor;
            // Add to colors array if not exists
            if (!COLORS.includes(newColor)) {
                COLORS.push(newColor);
            }
        } else {
            e.target.value = ''; // Reset to "Select Color" if cancelled
        }
    }
});

// Add new uniform
document.getElementById('addUniformForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const formData = new FormData(e.target);
        const uniformData = Object.fromEntries(formData.entries());
        const type = (uniformData.type || '').trim();
        const size = (uniformData.size || '').trim();
        const color = (uniformData.color || '').trim();
        const updatedBy = (uniformData.updatedBy || '').trim();
        const vessel = (uniformData.vessel || DEFAULT_VESSEL).trim().toLowerCase();
        const storageLocation = (uniformData.storage_location || '').trim();
        const currentStock = Number.parseInt(String(uniformData.current_stock), 10);
        const reason = 'New uniform added';

        if (!type || !size || !color) {
            throw new Error('Please fill in all fields');
        }

        if (!updatedBy) {
            throw new Error('Please enter who is adding this uniform.');
        }
        if (!storageLocation) {
            throw new Error('Please enter the storage location.');
        }
        if (!['yin', 'yang'].includes(vessel)) {
            throw new Error('Please select Yin or Yang.');
        }

        if (!Number.isInteger(currentStock) || currentStock < 0) {
            throw new Error('Please enter a valid initial stock.');
        }

        const payload = {
            type,
            size,
            color,
            current_stock: currentStock,
            vessel,
            storage_location: storageLocation,
            updatedBy,
            reason
        };

        window.localStorage?.setItem('lastStockUpdatedBy', updatedBy);

        // Check if uniform exists
        const response = await fetch(UNIFORMS_API);
        if (!response.ok) {
            throw new Error('Failed to check existing uniforms');
        }
        const uniforms = await response.json();
        const existingUniform = uniforms.find(u => 
            u.type === payload.type && 
            u.size === payload.size && 
            u.color === payload.color
        );

        if (existingUniform) {
            showFlashMessage('This uniform already exists. Use "Update Stock" to adjust the quantity.', 'info');
            bootstrap.Modal.getInstance(document.getElementById('addUniformModal')).hide();
            showUpdateStockModal(
                existingUniform.id,
                existingUniform.current_stock,
                encodeURIComponent(existingUniform.type),
                encodeURIComponent(existingUniform.size),
                encodeURIComponent(existingUniform.color)
            );
            return;
        }

        const responseAdd = await fetch(UNIFORMS_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!responseAdd.ok) {
            const payload = await responseAdd.json().catch(() => ({}));
            const errorMessage = payload.error || 'Failed to add uniform';
            throw new Error(errorMessage);
        }

        showFlashMessage('Uniform added successfully');
        bootstrap.Modal.getInstance(document.getElementById('addUniformModal')).hide();
        e.target.reset();
        loadStockList();
    } catch (error) {
        showFlashMessage(error.message, 'danger');
    }
});

// Update stock
document.getElementById('updateStockForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        if (!updateUniformIdInput || !newStockInput || !currentStockHiddenInput || !updateReasonSelect || !updatePerformedByInput) {
            throw new Error('Update form is not ready. Please reload the page.');
        }

        const uniformId = updateUniformIdInput.value;
        const newStock = Number.parseInt(newStockInput.value, 10);
        const currentStock = Number.parseInt(currentStockHiddenInput.value, 10);
        const updatedBy = (updatePerformedByInput.value || '').trim();
        const vessel = (updateVesselSelect?.value || DEFAULT_VESSEL).trim().toLowerCase();
        const storageLocation = (updateStorageLocationInput?.value || '').trim();
        const reason = updateReasonSelect.value;
        const reasonDetail = updateReasonDetailInput ? (updateReasonDetailInput.value || '').trim() : '';

        if (!Number.isInteger(newStock) || newStock < 0) {
            throw new Error('Please enter a valid stock quantity.');
        }
        if (!updatedBy) {
            throw new Error('Please enter who performed the update.');
        }
        if (!storageLocation) {
            throw new Error('Please enter the storage location.');
        }
        if (!['yin', 'yang'].includes(vessel)) {
            throw new Error('Please select Yin or Yang.');
        }
        if (!reason) {
            throw new Error('Please select a reason for this update.');
        }
        const trimmedReasonDetail = reasonDetail.trim();

        if (reason === 'Other' && !trimmedReasonDetail) {
            throw new Error('Please specify the reason for this update.');
        }

        const resolvedReason = reason === 'Other' ? trimmedReasonDetail : reason;
        const comment = '';

        const response = await fetch(`${UNIFORMS_API}/${uniformId}/stock`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                newQuantity: newStock,
                vessel,
                storage_location: storageLocation,
                reason: resolvedReason,
                updatedBy,
                comment
            })
        });

        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            const errorMessage = payload.error || 'Failed to update stock';
            throw new Error(errorMessage);
        }

        window.localStorage?.setItem('lastStockUpdatedBy', updatedBy);

        showFlashMessage('Stock updated successfully');
        bootstrap.Modal.getInstance(document.getElementById('updateStockModal')).hide();
        document.getElementById('updateStockForm').reset();
        if (updateReasonDetailWrapper) updateReasonDetailWrapper.classList.add('d-none');
        loadStockList();
    } catch (error) {
        showFlashMessage(error.message, 'danger');
    }
});

// Delete uniform
async function deleteUniform(uniformId) {
    if (confirm('Are you sure you want to delete this uniform?')) {
        try {
            const response = await fetch(`${UNIFORMS_API}/${uniformId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(error || 'Failed to delete uniform');
            }

            showFlashMessage('Uniform deleted successfully');
            loadStockList();
        } catch (error) {
            showFlashMessage(error.message, 'danger');
        }
    }
}

// Export to CSV
document.getElementById('exportCsvBtn').addEventListener('click', async () => {
    try {
        const response = await fetch(`${UNIFORMS_API}/export`);
        if (!response.ok) {
            throw new Error('Failed to export data');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = typeof getCsvFilename === 'function'
            ? getCsvFilename('stock_management')
            : 'stock_management.csv';
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
    loadStockList();
    
    // Add event listener for the Add New Uniform button
    document.getElementById('addNewUniformBtn').addEventListener('click', () => {
        showAddUniformModal();
    });

    stockLocationsModalTitle = document.getElementById('stockLocationsModalLabel');
    stockLocationsModalBody = document.getElementById('stockLocationsModalBody');
    const stockLocationsModalElement = document.getElementById('stockLocationsModal');
    if (stockLocationsModalElement) {
        stockLocationsModal = new bootstrap.Modal(stockLocationsModalElement);
        stockLocationsModalElement.addEventListener('hidden.bs.modal', () => {
            activeLocationsUniformId = null;
            if (stockLocationsModalBody) {
                stockLocationsModalBody.innerHTML = '<p class="text-muted mb-0">No stock locations recorded.</p>';
            }
        });
    }

    assignedModalTitle = document.getElementById('assignedUniformModalLabel');
    assignedModalBody = document.getElementById('assignedUniformModalBody');
    const modalElement = document.getElementById('assignedUniformModal');
    if (modalElement) {
        assignedDetailsModal = new bootstrap.Modal(modalElement);
        modalElement.addEventListener('hidden.bs.modal', () => {
            if (assignedModalBody) {
                assignedModalBody.innerHTML = '<p class="text-muted mb-0">No active assignments for this uniform.</p>';
            }
        });
    }

    const stockList = document.getElementById('stockList');
    if (stockList) {
        stockList.addEventListener('click', handleAssignedCountClick);
    }

    if (updateVesselSelect) {
        updateVesselSelect.addEventListener('change', () => {
            const uniform = updateUniformIdInput?.value ? lastUniformsById[updateUniformIdInput.value] : null;
            populateStorageLocationSelect(updateStorageLocationInput, { uniform, vessel: updateVesselSelect.value, selected: DEFAULT_STORAGE_LOCATION, includeQuantities: true });
            refreshUpdateLocationStock({ syncNewStock: true });
        });
    }
    if (updateStorageLocationInput) {
        updateStorageLocationInput.addEventListener('change', () => {
            const uniform = updateUniformIdInput?.value ? lastUniformsById[updateUniformIdInput.value] : null;
            const added = handleStorageLocationSelectChange(updateStorageLocationInput, { uniform, vessel: updateVesselSelect?.value || DEFAULT_VESSEL, selected: DEFAULT_STORAGE_LOCATION, includeQuantities: true });
            refreshUpdateLocationStock({ syncNewStock: added });
        });
    }

    if (updateReasonSelect) {
        updateReasonSelect.addEventListener('change', () => {
            if (updateReasonSelect.value === 'Other') {
                updateReasonDetailWrapper?.classList.remove('d-none');
                updateReasonDetailInput?.focus();
            } else {
                updateReasonDetailWrapper?.classList.add('d-none');
                if (updateReasonDetailInput) {
                    updateReasonDetailInput.value = '';
                }
            }
        });
    }

    if (addStorageLocationInput) {
        addStorageLocationInput.addEventListener('change', () => {
            handleStorageLocationSelectChange(addStorageLocationInput, { selected: DEFAULT_STORAGE_LOCATION });
        });
    }
    if (openTransferStockBtn) {
        openTransferStockBtn.addEventListener('click', () => openTransferStockModal(activeLocationsUniformId));
    }
    if (transferFromLocationSelect) {
        transferFromLocationSelect.addEventListener('change', updateTransferQuantityLimit);
    }
    if (transferToVesselSelect) {
        transferToVesselSelect.addEventListener('change', () => {
            const uniform = transferUniformIdInput?.value ? lastUniformsById[transferUniformIdInput.value] : null;
            populateStorageLocationSelect(transferToStorageLocationInput, { uniform, vessel: transferToVesselSelect.value, selected: DEFAULT_STORAGE_LOCATION, includeQuantities: true });
        });
    }
    if (transferToStorageLocationInput) {
        transferToStorageLocationInput.addEventListener('change', () => {
            const uniform = transferUniformIdInput?.value ? lastUniformsById[transferUniformIdInput.value] : null;
            handleStorageLocationSelectChange(transferToStorageLocationInput, { uniform, vessel: transferToVesselSelect?.value || DEFAULT_VESSEL, selected: DEFAULT_STORAGE_LOCATION, includeQuantities: true });
        });
    }
    if (transferStockForm) {
        transferStockForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            try {
                const uniformId = transferUniformIdInput?.value;
                const from = getSelectedTransferFromLocation();
                const toVessel = (transferToVesselSelect?.value || DEFAULT_VESSEL).trim().toLowerCase();
                const toStorageLocation = (transferToStorageLocationInput?.value || '').trim();
                const quantity = Number.parseInt(transferQuantityInput?.value || '0', 10);
                const updatedBy = (transferUpdatedByInput?.value || '').trim();
                const comment = (transferCommentInput?.value || '').trim();
                if (!uniformId || !from) throw new Error('Please select a source location.');
                if (!toStorageLocation) throw new Error('Please enter the destination storage location.');
                if (!Number.isInteger(quantity) || quantity < 1) throw new Error('Please enter a valid transfer quantity.');
                if (quantity > from.quantity) throw new Error('Transfer quantity cannot exceed the source location stock.');
                if (!updatedBy) throw new Error('Please enter who performed the transfer.');
                const response = await fetch(UNIFORMS_API + '/' + uniformId + '/transfer', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ quantity, updatedBy, comment, from, to: { vessel: toVessel, storage_location: toStorageLocation } })
                });
                if (!response.ok) {
                    const payload = await response.json().catch(() => ({}));
                    throw new Error(payload.error || 'Failed to transfer stock');
                }
                window.localStorage?.setItem('lastStockUpdatedBy', updatedBy);
                showFlashMessage('Stock transferred successfully');
                bootstrap.Modal.getInstance(document.getElementById('transferStockModal'))?.hide();
                transferStockForm.reset();
                loadStockList();
            } catch (error) {
                showFlashMessage(error.message, 'danger');
            }
        });
    }
    if (updatePerformedByInput) {
        const storedName = window.localStorage?.getItem('lastStockUpdatedBy');
        if (storedName) {
            updatePerformedByInput.value = storedName;
        }
    }

}); 
