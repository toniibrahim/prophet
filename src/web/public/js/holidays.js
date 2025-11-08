// Holidays Management Script

let editingId = null;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    loadYears();
    loadHolidays();
});

// Load years for filter
function loadYears() {
    const currentYear = new Date().getFullYear();
    const yearFilter = document.getElementById('yearFilter');

    for (let year = currentYear - 5; year <= currentYear + 10; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === currentYear) {
            option.selected = true;
        }
        yearFilter.appendChild(option);
    }

    // Set default year in form
    document.getElementById('year').value = currentYear;
}

// Load holidays
async function loadHolidays() {
    try {
        const year = document.getElementById('yearFilter').value;
        const url = year ? `/api/holidays?year=${year}` : '/api/holidays';

        const response = await fetch(url);
        const holidays = await response.json();

        const tbody = document.getElementById('holidaysTable');

        if (holidays.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">No holidays found</td></tr>';
            return;
        }

        tbody.innerHTML = holidays.map(holiday => `
            <tr>
                <td>${holiday.holiday_name}</td>
                <td><span class="badge badge-info">${holiday.holiday_type}</span></td>
                <td>${holiday.year}</td>
                <td>${formatDate(holiday.start_date)}</td>
                <td>${formatDate(holiday.end_date)}</td>
                <td>${holiday.impact_multiplier}x</td>
                <td>
                    <span class="badge ${holiday.is_active ? 'badge-success' : 'badge-danger'}">
                        ${holiday.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td class="table-actions">
                    <button class="btn btn-primary" onclick="editHoliday(${holiday.id})">Edit</button>
                    <button class="btn btn-danger" onclick="deleteHoliday(${holiday.id})">Delete</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Failed to load holidays:', error);
        showMessage('Failed to load holidays', 'error');
    }
}

// Open modal
function openModal() {
    editingId = null;
    document.getElementById('modalTitle').textContent = 'Add Holiday';
    document.getElementById('holidayForm').reset();
    document.getElementById('holidayId').value = '';
    document.getElementById('isActive').checked = true;
    document.getElementById('modal').classList.add('active');
}

// Close modal
function closeModal() {
    document.getElementById('modal').classList.remove('active');
}

// Edit holiday
async function editHoliday(id) {
    try {
        const response = await fetch(`/api/holidays/${id}`);
        const holiday = await response.json();

        editingId = id;
        document.getElementById('modalTitle').textContent = 'Edit Holiday';
        document.getElementById('holidayId').value = id;
        document.getElementById('holidayName').value = holiday.holiday_name;
        document.getElementById('holidayType').value = holiday.holiday_type;
        document.getElementById('year').value = holiday.year;
        document.getElementById('startDate').value = formatDateForInput(holiday.start_date);
        document.getElementById('endDate').value = formatDateForInput(holiday.end_date);
        document.getElementById('impactMultiplier').value = holiday.impact_multiplier;
        document.getElementById('description').value = holiday.description || '';
        document.getElementById('isActive').checked = holiday.is_active;

        document.getElementById('modal').classList.add('active');
    } catch (error) {
        console.error('Failed to load holiday:', error);
        showMessage('Failed to load holiday', 'error');
    }
}

// Save holiday
async function saveHoliday(event) {
    event.preventDefault();

    const id = document.getElementById('holidayId').value;
    const data = {
        holiday_name: document.getElementById('holidayName').value,
        holiday_type: document.getElementById('holidayType').value,
        year: parseInt(document.getElementById('year').value),
        start_date: document.getElementById('startDate').value,
        end_date: document.getElementById('endDate').value,
        impact_multiplier: parseFloat(document.getElementById('impactMultiplier').value),
        description: document.getElementById('description').value,
        is_active: document.getElementById('isActive').checked
    };

    try {
        const url = id ? `/api/holidays/${id}` : '/api/holidays';
        const method = id ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            showMessage(`Holiday ${id ? 'updated' : 'created'} successfully`, 'success');
            closeModal();
            loadHolidays();
        } else {
            throw new Error('Failed to save holiday');
        }
    } catch (error) {
        console.error('Failed to save holiday:', error);
        showMessage('Failed to save holiday', 'error');
    }
}

// Delete holiday
async function deleteHoliday(id) {
    if (!confirm('Are you sure you want to delete this holiday?')) {
        return;
    }

    try {
        const response = await fetch(`/api/holidays/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showMessage('Holiday deleted successfully', 'success');
            loadHolidays();
        } else {
            throw new Error('Failed to delete holiday');
        }
    } catch (error) {
        console.error('Failed to delete holiday:', error);
        showMessage('Failed to delete holiday', 'error');
    }
}

// Utilities
function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString();
}

function formatDateForInput(dateStr) {
    const date = new Date(dateStr);
    return date.toISOString().split('T')[0];
}

function showMessage(message, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.innerHTML = `<div class="${type}">${message}</div>`;
    setTimeout(() => {
        messageDiv.innerHTML = '';
    }, 5000);
}
