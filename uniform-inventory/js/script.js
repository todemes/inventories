// API endpoints
const UNIFORMS_API = '/api/uniforms';
const ASSIGNMENTS_API = '/api/staff/assignments';

// Constants
const SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'No Size'];
const COLORS = ['Black', 'Blue', 'Navy', 'White'];

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
        const assignedCounts = assignments
            .filter(assignment => assignment.status === 'assigned')
            .reduce((acc, assignment) => {
                const key = `${assignment.uniform_type}-${assignment.uniform_size}-${assignment.uniform_color}`;
                acc[key] = (acc[key] || 0) + 1;
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

        const stockList = document.getElementById('stockList');
        stockList.innerHTML = '';

        // Create sections for each uniform type
        for (const [type, items] of Object.entries(groupedUniforms)) {
            const section = document.createElement('div');
            section.className = 'card mb-4';
            section.innerHTML = `
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h5 class="mb-0">${type}</h5>
                    <button class="btn btn-stock-action btn-sm" onclick="showAddUniformModal('${type}')" title="Add ${type}">
                        <i class="bi bi-plus-lg"></i>
                    </button>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-hover">
                            <colgroup>
                                <col style="width: 20%">
                                <col style="width: 20%">
                                <col style="width: 20%">
                                <col style="width: 20%">
                                <col style="width: 20%">
                            </colgroup>
                            <thead>
                                <tr>
                                    <th>Size</th>
                                    <th>Color</th>
                                    <th>Current Stock</th>
                                    <th>Assigned</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${items.map(item => {
                                    const key = `${item.type}-${item.size}-${item.color}`;
                                    const assignedCount = assignedCounts[key] || 0;
                                    return `
                                        <tr>
                                            <td>${item.size}</td>
                                            <td>${item.color}</td>
                                            <td>${item.current_stock}</td>
                                            <td>${assignedCount}</td>
                                            <td>
                                                <button class="btn btn-stock-action btn-sm" 
                                                        onclick="showUpdateStockModal(${item.id}, ${item.current_stock})"
                                                        title="Update Stock">
                                                    <i class="bi bi-arrow-repeat"></i>
                                                </button>
                                                <button class="btn btn-stock-action btn-sm" 
                                                        onclick="deleteUniform(${item.id})"
                                                        title="Delete">
                                                    <i class="bi bi-trash"></i>
                                                </button>
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

    } catch (error) {
        showFlashMessage(error.message, 'danger');
    }
}

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
function showUpdateStockModal(uniformId, currentStock) {
    const modal = document.getElementById('updateStockModal');
    const form = document.getElementById('updateStockForm');
    document.getElementById('updateUniformId').value = uniformId;
    document.getElementById('currentStock').value = currentStock;
    document.getElementById('newStock').value = currentStock;
    document.getElementById('newStock').min = 0;
    
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

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
        uniformData.current_stock = parseInt(uniformData.current_stock);

        // Validate form
        if (!uniformData.type || !uniformData.size || !uniformData.color || !uniformData.current_stock) {
            throw new Error('Please fill in all fields');
        }

        // Check if uniform exists
        const response = await fetch(UNIFORMS_API);
        const uniforms = await response.json();
        const existingUniform = uniforms.find(u => 
            u.type === uniformData.type && 
            u.size === uniformData.size && 
            u.color === uniformData.color
        );

        if (existingUniform) {
            if (confirm('This item already exists. Do you want to update the quantity?')) {
                const newQuantity = existingUniform.current_stock + uniformData.current_stock;
                const response = await fetch(`${UNIFORMS_API}/${existingUniform.id}/stock`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newQuantity })
                });

                if (!response.ok) {
                    throw new Error('Failed to update stock');
                }

                showFlashMessage('Stock updated successfully');
            }
        } else {
            const response = await fetch(UNIFORMS_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(uniformData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                if (errorData.error.includes('read-only')) {
                    throw new Error('This is a demo version. Database modifications are disabled in production. Please use the development version for full functionality.');
                }
                throw new Error(errorData.error || 'Failed to add uniform');
            }

            showFlashMessage('Uniform added successfully');
        }

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
        const uniformId = document.getElementById('updateUniformId').value;
        const newStock = parseInt(document.getElementById('newStock').value);
        
        const response = await fetch(`${UNIFORMS_API}/${uniformId}/stock`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newQuantity: newStock })
        });

        if (!response.ok) {
            throw new Error('Failed to update stock');
        }

        showFlashMessage('Stock updated successfully');
        bootstrap.Modal.getInstance(document.getElementById('updateStockModal')).hide();
        document.getElementById('updateStockForm').reset();
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
        a.download = 'uniform_inventory.csv';
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
}); 