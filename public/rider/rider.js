/**
 * Rider flow: browse the shared pool of unclaimed deliveries, accept one
 * (self-claim, first to tap wins — server enforces this atomically, see
 * deliveryRepository.claim), then move it through picked_up -> delivered.
 */
(function () {
  const alertBox = document.getElementById('alertBox');
  const availableList = document.getElementById('availableList');
  const availableEmpty = document.getElementById('availableEmpty');
  const mineList = document.getElementById('mineList');
  const mineEmpty = document.getElementById('mineEmpty');
  const availableTabBtn = document.getElementById('availableTabBtn');
  const mineTabBtn = document.getElementById('mineTabBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  function showAlert(message, type = 'danger') {
    const icon = type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill';
    alertBox.innerHTML = `<div class="d-flex align-items-center gap-2"><i class="bi ${icon}"></i> ${message}</div>`;
    alertBox.className = `alert alert-${type} shadow-sm border-0`;
    alertBox.classList.remove('d-none');
    setTimeout(() => alertBox.classList.add('d-none'), 4000);
  }

  function currency(amount) {
    return `\u20a6${Number(amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  const STATUS_LABELS = {
    awaiting_rider: { text: 'Awaiting Rider', color: 'bg-warning text-dark' },
    assigned: { text: 'Assigned to You', color: 'bg-info text-dark' },
    picked_up: { text: 'Picked Up', color: 'bg-primary' },
    delivered: { text: 'Delivered', color: 'bg-success' },
  };

  async function loadAvailable() {
    try {
      const { data } = await window.GSUApi.apiRequest('/deliveries/available');
      availableList.innerHTML = '';
      if (data.length === 0) {
        availableEmpty.classList.remove('d-none');
        return;
      }
      availableEmpty.classList.add('d-none');
      data.forEach(delivery => availableList.appendChild(availableCard(delivery)));
    } catch (err) {
      showAlert(err.message || 'Failed to load available deliveries.');
    }
  }

  function availableCard(delivery) {
    const div = document.createElement('div');
    div.className = 'card border-0 shadow-sm';
    div.style.borderRadius = '16px';
    div.style.backgroundColor = 'var(--gsu-surface)';
    
    div.innerHTML = `
      <div class="card-body p-4">
        <div class="d-flex justify-content-between align-items-start mb-3">
          <div>
            <span class="badge ${STATUS_LABELS.awaiting_rider.color} mb-2" style="border-radius: 6px;">${STATUS_LABELS.awaiting_rider.text}</span>
            <h5 class="fw-bold text-white mb-0">Order #${delivery.order_id}</h5>
          </div>
          <span class="h5 fw-bold text-success mb-0">${currency(delivery.total_amount)}</span>
        </div>
        
        <div class="mb-4 p-3 bg-dark border border-secondary border-opacity-50" style="border-radius: 12px;">
          <div class="d-flex align-items-center gap-2">
            <i class="bi bi-shop text-muted fs-5"></i>
            <span class="text-white fw-medium">${escapeHtml(delivery.vendor_name)}</span>
          </div>
        </div>
        
        <button class="btn btn-gsu-primary w-100 thumb-btn accept-btn d-flex justify-content-center align-items-center gap-2">
          <i class="bi bi-check2-circle fs-5"></i> Accept Delivery
        </button>
      </div>
    `;
    div.querySelector('.accept-btn').addEventListener('click', () => acceptDelivery(delivery.id));
    return div;
  }

  async function acceptDelivery(deliveryId) {
    try {
      await window.GSUApi.apiRequest(`/deliveries/${deliveryId}/accept`, { method: 'PATCH' });
      showAlert('Delivery accepted! Check "My Deliveries" to proceed.', 'success');
      loadAvailable();
      // Auto-switch to the "Mine" tab after claiming
      const mineTabInstance = new bootstrap.Tab(mineTabBtn);
      mineTabInstance.show();
      loadMine();
    } catch (err) {
      showAlert(err.message || 'Could not accept delivery. Another rider may have claimed it.');
      loadAvailable();
    }
  }

  async function loadMine() {
    try {
      const { data } = await window.GSUApi.apiRequest('/deliveries/mine');
      mineList.innerHTML = '';
      if (data.length === 0) {
        mineEmpty.classList.remove('d-none');
        return;
      }
      mineEmpty.classList.add('d-none');
      data.forEach(delivery => mineList.appendChild(mineCard(delivery)));
    } catch (err) {
      showAlert(err.message || 'Failed to load your deliveries.');
    }
  }

  function mineCard(delivery) {
    const div = document.createElement('div');
    div.className = 'card border-0 shadow-sm';
    div.style.borderRadius = '16px';
    div.style.backgroundColor = 'var(--gsu-surface)';
    
    let actionBtn = '';
    const statusConfig = STATUS_LABELS[delivery.status] || { text: delivery.status, color: 'bg-secondary' };

    if (delivery.status === 'assigned') {
      actionBtn = `<button class="btn btn-info w-100 thumb-btn pickup-btn d-flex justify-content-center align-items-center gap-2 text-dark"><i class="bi bi-box-seam fs-5"></i> Mark Picked Up</button>`;
    } else if (delivery.status === 'picked_up') {
      actionBtn = `<button class="btn btn-gsu-primary w-100 thumb-btn deliver-btn d-flex justify-content-center align-items-center gap-2"><i class="bi bi-house-check fs-5"></i> Mark Delivered</button>`;
    } else if (delivery.status === 'delivered') {
      actionBtn = `<button class="btn btn-success w-100 thumb-btn disabled d-flex justify-content-center align-items-center gap-2"><i class="bi bi-check-all fs-5"></i> Delivery Complete</button>`;
    }

    div.innerHTML = `
      <div class="card-body p-4">
        <div class="d-flex justify-content-between align-items-start mb-3">
          <div>
            <span class="badge ${statusConfig.color} mb-2" style="border-radius: 6px;">${statusConfig.text}</span>
            <h5 class="fw-bold text-white mb-0">Order #${delivery.order_id}</h5>
          </div>
          <span class="h5 fw-bold text-success mb-0">${currency(delivery.total_amount)}</span>
        </div>
        
        <div class="mb-4 p-3 bg-dark border border-secondary border-opacity-50" style="border-radius: 12px; position: relative;">
          <!-- Tracking Timeline Line -->
          <div style="position: absolute; left: 24px; top: 38px; bottom: 38px; width: 2px; background-color: var(--gsu-border);"></div>
          
          <div class="d-flex align-items-start gap-3 mb-3 position-relative">
            <div class="bg-secondary rounded-circle d-flex align-items-center justify-content-center z-1" style="width: 26px; height: 26px; border: 3px solid var(--gsu-surface);">
              <i class="bi bi-shop text-white" style="font-size: 0.7rem;"></i>
            </div>
            <div>
              <small class="text-muted d-block lh-sm text-uppercase fw-semibold" style="font-size: 0.7rem;">Pickup From</small>
              <span class="text-white fw-medium">${escapeHtml(delivery.vendor_name)}</span>
            </div>
          </div>
          
          <div class="d-flex align-items-start gap-3 position-relative">
            <div class="bg-primary rounded-circle d-flex align-items-center justify-content-center z-1" style="width: 26px; height: 26px; border: 3px solid var(--gsu-surface);">
              <i class="bi bi-person-fill text-white" style="font-size: 0.7rem;"></i>
            </div>
            <div>
              <small class="text-muted d-block lh-sm text-uppercase fw-semibold" style="font-size: 0.7rem;">Deliver To</small>
              <span class="text-white fw-medium">${escapeHtml(delivery.customer_name)}</span>
            </div>
          </div>
        </div>
        
        ${actionBtn}
      </div>
    `;
    
    const pickupBtn = div.querySelector('.pickup-btn');
    if (pickupBtn) pickupBtn.addEventListener('click', () => markPickedUp(delivery.id));
    
    const deliverBtn = div.querySelector('.deliver-btn');
    if (deliverBtn) deliverBtn.addEventListener('click', () => markDelivered(delivery.id));
    
    return div;
  }

  async function markPickedUp(deliveryId) {
    try {
      await window.GSUApi.apiRequest(`/deliveries/${deliveryId}/pickup`, { method: 'PATCH' });
      showAlert('Marked as picked up. Head to the customer!', 'success');
      loadMine();
    } catch (err) {
      showAlert(err.message || 'Could not update delivery.');
    }
  }

  async function markDelivered(deliveryId) {
    if (!confirm('Confirm this order has been handed to the customer?')) return;
    try {
      await window.GSUApi.apiRequest(`/deliveries/${deliveryId}/deliver`, { method: 'PATCH' });
      showAlert('Delivery completed. Nice work!', 'success');
      loadMine();
    } catch (err) {
      showAlert(err.message || 'Could not update delivery.');
    }
  }

  availableTabBtn.addEventListener('click', loadAvailable);
  mineTabBtn.addEventListener('click', loadMine);
  logoutBtn.addEventListener('click', () => {
    window.GSUApi.clearToken();
    window.location.href = '/shared/login.html';
  });

  // Initialize
  loadAvailable();
})();