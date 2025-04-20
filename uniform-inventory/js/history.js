// API endpoints
const HISTORY_API = '/api/uniforms/assignment-history';
const EXPORT_API = '/api/uniforms/assignment-history/export';

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

// Format date
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

// Load history
async function loadHistory() {
    try {
        const response = await fetch(HISTORY_API);
        if (!response.ok) {
            throw new Error('Failed to fetch history');
        }
        const history = await response.json();
        
        const historyList = document.getElementById('historyList');
        historyList.innerHTML = history.map(item => `
            <tr>
                <td>${formatDate(item.assigned_date)}</td>
                <td>${formatDate(item.returned_date)}</td>
                <td>${item.staff_name}</td>
                <td>${item.department}</td>
                <td>${item.uniform_type}</td>
                <td>${item.size}</td>
                <td>${item.color}</td>
                <td>
                    <span class="badge ${item.returned_date ? 'bg-warning' : 'bg-success'}">
                        ${item.returned_date ? 'Returned' : 'Assigned'}
                    </span>
                </td>
                <td>${item.notes || ''}</td>
            </tr>
        `).join('');

    } catch (error) {
        showFlashMessage(error.message, 'danger');
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
        a.download = 'uniform_assignments.csv';
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
    loadHistory();
}); 