// Promotions Management Script

document.addEventListener('DOMContentLoaded', function() {
    loadYears();
    loadPromotions();
});

function loadYears() {
    const currentYear = new Date().getFullYear();
    const yearFilter = document.getElementById('yearFilter');

    for (let year = currentYear - 2; year <= currentYear + 5; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === currentYear) option.selected = true;
        yearFilter.appendChild(option);
    }

    document.getElementById('year').value = currentYear;
}

async function loadPromotions() {
    try {
        const year = document.getElementById('yearFilter').value;
        const url = year ? `/api/promotions?year=${year}` : '/api/promotions';

        const response = await fetch(url);
        const promotions = await response.json();
        const tbody = document.getElementById('promotionsTable');

        if (promotions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center">No promotions found</td></tr>';
            return;
        }

        tbody.innerHTML = promotions.map(p => `
            <tr>
                <td>${p.promotion_name}</td>
                <td><span class="badge badge-info">${p.promotion_type || '-'}</span></td>
                <td>${p.year}</td>
                <td>${new Date(p.start_date).toLocaleDateString()}</td>
                <td>${new Date(p.end_date).toLocaleDateString()}</td>
                <td>${p.discount_percentage ? p.discount_percentage + '%' : '-'}</td>
                <td>${p.expected_uplift}x</td>
                <td><span class="badge ${p.is_active ? 'badge-success' : 'badge-danger'}">${p.is_active ? 'Active' : 'Inactive'}</span></td>
                <td class="table-actions">
                    <button class="btn btn-primary" onclick="editPromotion(${p.id})">Edit</button>
                    <button class="btn btn-danger" onclick="deletePromotion(${p.id})">Delete</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Failed to load promotions:', error);
        showMessage('Failed to load promotions', 'error');
    }
}

function openModal() {
    document.getElementById('modalTitle').textContent = 'Add Promotion';
    document.getElementById('promotionForm').reset();
    document.getElementById('promotionId').value = '';
    document.getElementById('isActive').checked = true;
    document.getElementById('modal').classList.add('active');
}

function closeModal() {
    document.getElementById('modal').classList.remove('active');
}

async function editPromotion(id) {
    try {
        const response = await fetch(`/api/promotions/${id}`);
        const promo = await response.json();

        document.getElementById('modalTitle').textContent = 'Edit Promotion';
        document.getElementById('promotionId').value = id;
        document.getElementById('promotionName').value = promo.promotion_name;
        document.getElementById('promotionType').value = promo.promotion_type || 'other';
        document.getElementById('year').value = promo.year;
        document.getElementById('startDate').value = new Date(promo.start_date).toISOString().split('T')[0];
        document.getElementById('endDate').value = new Date(promo.end_date).toISOString().split('T')[0];
        document.getElementById('discountPercentage').value = promo.discount_percentage || '';
        document.getElementById('expectedUplift').value = promo.expected_uplift;
        document.getElementById('description').value = promo.description || '';
        document.getElementById('isActive').checked = promo.is_active;

        document.getElementById('modal').classList.add('active');
    } catch (error) {
        console.error('Failed to load promotion:', error);
        showMessage('Failed to load promotion', 'error');
    }
}

async function savePromotion(event) {
    event.preventDefault();

    const id = document.getElementById('promotionId').value;
    const data = {
        promotion_name: document.getElementById('promotionName').value,
        promotion_type: document.getElementById('promotionType').value,
        year: parseInt(document.getElementById('year').value),
        start_date: document.getElementById('startDate').value,
        end_date: document.getElementById('endDate').value,
        discount_percentage: parseFloat(document.getElementById('discountPercentage').value) || null,
        expected_uplift: parseFloat(document.getElementById('expectedUplift').value),
        description: document.getElementById('description').value,
        is_active: document.getElementById('isActive').checked
    };

    try {
        const url = id ? `/api/promotions/${id}` : '/api/promotions';
        const method = id ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            showMessage(`Promotion ${id ? 'updated' : 'created'} successfully`, 'success');
            closeModal();
            loadPromotions();
        } else {
            throw new Error('Failed to save promotion');
        }
    } catch (error) {
        console.error('Failed to save promotion:', error);
        showMessage('Failed to save promotion', 'error');
    }
}

async function deletePromotion(id) {
    if (!confirm('Are you sure you want to delete this promotion?')) return;

    try {
        const response = await fetch(`/api/promotions/${id}`, { method: 'DELETE' });
        if (response.ok) {
            showMessage('Promotion deleted successfully', 'success');
            loadPromotions();
        } else {
            throw new Error('Failed to delete promotion');
        }
    } catch (error) {
        console.error('Failed to delete promotion:', error);
        showMessage('Failed to delete promotion', 'error');
    }
}

function showMessage(message, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.innerHTML = `<div class="${type}">${message}</div>`;
    setTimeout(() => { messageDiv.innerHTML = ''; }, 5000);
}
