/**
 * Admin dashboard: analytics summary, vendor creation/status management
 * (the ONLY way a vendor account gets created — see adminService.js),
 * and user suspend/reactivate.
 */
(function () {
  const alertBox = document.getElementById('alertBox');
  const logoutBtn = document.getElementById('logoutBtn');

  function showAlert(message, type = 'danger') {
    alertBox.textContent = message;
    alertBox.className = `alert alert-${type} shadow-sm`;
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

  // ---------- Analytics ----------

  async function loadAnalytics() {
    try {
      const { data } = await window.GSUApi.apiRequest('/admin/analytics/summary');

      document.getElementById('statTotalOrders').textContent = data.totalOrders;
      document.getElementById('statTotalRevenue').textContent = currency(data.totalRevenue);

      const statusBody = document.getElementById('statusTableBody');
      statusBody.innerHTML = data.ordersByStatus
        .map(row => `<tr><td class="px-4 py-3 fw-medium text-capitalize">${escapeHtml(row.status.replace('_', ' '))}</td><td class="py-3">${row.count}</td></tr>`)
        .join('');

      const vendorBody = document.getElementById('vendorRevenueTableBody');
      vendorBody.innerHTML = data.revenueByVendor
        .map(row => `<tr><td class="px-4 py-3 fw-medium">${escapeHtml(row.business_name)}</td><td class="py-3">${row.order_count}</td><td class="py-3 text-success fw-medium">${currency(row.revenue)}</td></tr>`)
        .join('');

      const dailyBody = document.getElementById('dailyOrdersTableBody');
      dailyBody.innerHTML = data.ordersByDay
        .map(row => `<tr><td class="px-4 py-3">${row.day}</td><td class="py-3">${row.count}</td></tr>`)
        .join('') || '<tr><td colspan="2" class="text-muted px-4 py-3 text-center">No orders in this window.</td></tr>';
    } catch (err) {
      showAlert(err.message || 'Failed to load analytics.');
    }
  }

  // ---------- Vendors ----------

  const vendorsList = document.getElementById('vendorsList');
  const vendorsEmpty = document.getElementById('vendorsEmpty');
  const vendorStatusFilter = document.getElementById('vendorStatusFilter');
  const vendorModalEl = document.getElementById('vendorModal');
  const vendorModal = new bootstrap.Modal(vendorModalEl);
  const saveVendorBtn = document.getElementById('saveVendorBtn');
  const vendorFormError = document.getElementById('vendorFormError');

  async function loadVendors() {
    const params = new URLSearchParams({ limit: '50' });
    if (vendorStatusFilter.value) params.set('status', vendorStatusFilter.value);

    try {
      const { data } = await window.GSUApi.apiRequest(`/admin/vendors?${params.toString()}`);
      vendorsList.innerHTML = '';
      if (data.vendors.length === 0) {
        vendorsEmpty.classList.remove('d-none');
        return;
      }
      vendorsEmpty.classList.add('d-none');
      data.vendors.forEach(vendor => vendorsList.appendChild(vendorCard(vendor)));
    } catch (err) {
      showAlert(err.message || 'Failed to load vendors.');
    }
  }

  function vendorCard(vendor) {
    const div = document.createElement('div');
    div.className = 'card border-0 shadow-sm';
    div.style.borderRadius = '12px';
    
    // Status badge colors
    let badgeColor = 'bg-secondary';
    if (vendor.status === 'active') badgeColor = 'bg-success';
    if (vendor.status === 'suspended') badgeColor = 'bg-danger';

    const statusOptions = ['active', 'pending', 'suspended']
      .map(s => `<option value="${s}" ${s === vendor.status ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`)
      .join('');

    div.innerHTML = `
      <div class="card-body p-4 d-flex justify-content-between align-items-center flex-wrap gap-3">
        <div>
          <div class="d-flex align-items-center gap-2 mb-1">
            <h5 class="mb-0 fw-bold text-white">${escapeHtml(vendor.business_name)}</h5>
            <span class="badge ${badgeColor} status-badge">${escapeHtml(vendor.status)}</span>
          </div>
          <p class="small text-muted mb-0">${escapeHtml(vendor.owner_name)} &middot; ${escapeHtml(vendor.owner_email)}</p>
        </div>
        <div class="d-flex align-items-center gap-2">
          <label class="small text-muted mb-0 fw-medium">Update Status:</label>
          <select class="form-select form-select-sm bg-dark border-secondary text-white shadow-none status-select" style="border-radius: 6px; width: 130px;">
            ${statusOptions}
          </select>
        </div>
      </div>
    `;
    div.querySelector('.status-select').addEventListener('change', (e) => setVendorStatus(vendor.id, e.target.value));
    return div;
  }

  async function setVendorStatus(vendorId, status) {
    try {
      await window.GSUApi.apiRequest(`/admin/vendors/${vendorId}/status`, {
        method: 'PATCH',
        body: { status },
      });
      showAlert('Vendor status updated successfully.', 'success');
      loadVendors();
    } catch (err) {
      showAlert(err.message || 'Could not update vendor status.');
      loadVendors();
    }
  }

  async function createVendor() {
    const payload = {
      fullName: document.getElementById('vFullName').value.trim(),
      email: document.getElementById('vEmail').value.trim(),
      phone: document.getElementById('vPhone').value.trim(),
      password: document.getElementById('vPassword').value,
      businessName: document.getElementById('vBusinessName').value.trim(),
      description: document.getElementById('vDescription').value.trim() || null,
    };

    saveVendorBtn.disabled = true;
    vendorFormError.classList.add('d-none');

    try {
      await window.GSUApi.apiRequest('/admin/vendors', { method: 'POST', body: payload });
      vendorModal.hide();
      document.getElementById('vendorForm').reset();
      showAlert('Vendor created successfully.', 'success');
      loadVendors();
    } catch (err) {
      vendorFormError.textContent = err.message || 'Could not create vendor.';
      vendorFormError.classList.remove('d-none');
    } finally {
      saveVendorBtn.disabled = false;
    }
  }

  // ---------- Users ----------

  const usersList = document.getElementById('usersList');
  const usersEmpty = document.getElementById('usersEmpty');
  const userRoleFilter = document.getElementById('userRoleFilter');

  async function loadUsers() {
    const params = new URLSearchParams({ limit: '50' });
    if (userRoleFilter.value) params.set('role', userRoleFilter.value);

    try {
      const { data } = await window.GSUApi.apiRequest(`/admin/users?${params.toString()}`);
      usersList.innerHTML = '';
      if (data.users.length === 0) {
        usersEmpty.classList.remove('d-none');
        return;
      }
      usersEmpty.classList.add('d-none');
      data.users.forEach(user => usersList.appendChild(userCard(user)));
    } catch (err) {
      showAlert(err.message || 'Failed to load users.');
    }
  }

  function userCard(user) {
    const div = document.createElement('div');
    div.className = 'card border-0 shadow-sm';
    div.style.borderRadius = '12px';
    
    // Dim inactive users slightly for visual feedback
    if (!user.is_active) {
      div.style.opacity = '0.7';
    }

    div.innerHTML = `
      <div class="card-body p-4 d-flex justify-content-between align-items-center flex-wrap gap-3">
        <div>
          <div class="d-flex align-items-center gap-2 mb-1">
            <h5 class="mb-0 fw-bold ${user.is_active ? 'text-white' : 'text-danger text-decoration-line-through'}">${escapeHtml(user.full_name)}</h5>
            <span class="badge ${user.role === 'admin' ? 'bg-danger' : 'bg-secondary'} status-badge">${escapeHtml(user.role)}</span>
          </div>
          <p class="small text-muted mb-0">${escapeHtml(user.email)} &middot; ${escapeHtml(user.phone)}</p>
        </div>
        <button class="btn btn-sm ${user.is_active ? 'btn-outline-danger' : 'btn-outline-success'} fw-medium toggle-active-btn" style="border-radius: 6px; width: 100px;">
          ${user.is_active ? 'Suspend' : 'Reactivate'}
        </button>
      </div>
    `;
    div.querySelector('.toggle-active-btn').addEventListener('click', () => toggleActive(user));
    return div;
  }

  async function toggleActive(user) {
    try {
      await window.GSUApi.apiRequest(`/admin/users/${user.id}/active`, {
        method: 'PATCH',
        body: { isActive: !user.is_active },
      });
      showAlert(`User account has been ${user.is_active ? 'suspended' : 'reactivated'}.`, 'success');
      loadUsers();
    } catch (err) {
      showAlert(err.message || 'Could not update user.');
    }
  }

  // ---------- Withdrawals (admin) ----------

  const withdrawalsAdminList = document.getElementById('withdrawalsAdminList');
  const withdrawalsAdminEmpty = document.getElementById('withdrawalsAdminEmpty');
  const withdrawalStatusFilter = document.getElementById('withdrawalStatusFilter');

  const WITHDRAWAL_STATUS_LABELS = {
    pending: { text: 'Pending', color: 'bg-warning text-dark' },
    approved: { text: 'Approved', color: 'bg-info text-dark' },
    paid: { text: 'Paid', color: 'bg-success' },
    rejected: { text: 'Rejected', color: 'bg-danger' },
  };

  async function loadWithdrawalsAdmin() {
    const params = new URLSearchParams({ limit: '50' });
    if (withdrawalStatusFilter.value) params.set('status', withdrawalStatusFilter.value);

    try {
      const { data } = await window.GSUApi.apiRequest(`/financial/admin/withdrawals?${params.toString()}`);
      withdrawalsAdminList.innerHTML = '';
      if (data.withdrawals.length === 0) {
        withdrawalsAdminEmpty.classList.remove('d-none');
        return;
      }
      withdrawalsAdminEmpty.classList.add('d-none');
      data.withdrawals.forEach(w => withdrawalsAdminList.appendChild(withdrawalAdminCard(w)));
    } catch (err) {
      showAlert(err.message || 'Failed to load withdrawals.');
    }
  }

  function withdrawalAdminCard(w) {
    const div = document.createElement('div');
    div.className = 'card border-0 shadow-sm';
    div.style.borderRadius = '12px';

    const statusObj = WITHDRAWAL_STATUS_LABELS[w.status] || { text: w.status, color: 'bg-secondary' };
    const requestedAt = new Date(w.created_at).toLocaleString();

    let actions = '';
    if (w.status === 'pending') {
      actions = `
        <button class="btn btn-sm btn-success fw-medium approve-btn" style="border-radius: 6px;">Approve</button>
        <button class="btn btn-sm btn-outline-danger fw-medium reject-btn" style="border-radius: 6px;">Reject</button>
      `;
    } else if (w.status === 'approved') {
      actions = `<button class="btn btn-sm btn-gsu-primary fw-medium pay-btn" style="border-radius: 6px;">Mark Paid</button>`;
    }

    div.innerHTML = `
      <div class="card-body p-4">
        <div class="d-flex justify-content-between align-items-start mb-2 flex-wrap gap-2">
          <div>
            <h5 class="mb-0 fw-bold text-white">${escapeHtml(w.business_name)}</h5>
            <p class="small text-muted mb-0">${escapeHtml(w.owner_name)}</p>
          </div>
          <span class="badge status-badge ${statusObj.color}" style="border-radius: 6px;">${statusObj.text}</span>
        </div>
        <p class="h5 fw-bold text-success mb-2">${currency(w.amount)}</p>
        <p class="small text-secondary mb-1"><i class="bi bi-bank"></i> ${escapeHtml(w.bank_name)} &middot; ${escapeHtml(w.account_number)} (${escapeHtml(w.account_name)})</p>
        <p class="small text-muted mb-2"><i class="bi bi-clock"></i> Requested ${requestedAt}</p>
        ${w.admin_notes ? `<div class="bg-dark p-2 rounded small text-muted mb-2"><i class="bi bi-chat-left-text"></i> ${escapeHtml(w.admin_notes)}</div>` : ''}
        ${actions ? `<div class="d-flex gap-2 mt-3 pt-3 border-top border-secondary border-opacity-50">${actions}</div>` : ''}
      </div>
    `;

    const approveBtn = div.querySelector('.approve-btn');
    if (approveBtn) approveBtn.addEventListener('click', () => setWithdrawalStatus(w.id, 'approved'));
    const payBtn = div.querySelector('.pay-btn');
    if (payBtn) payBtn.addEventListener('click', () => setWithdrawalStatus(w.id, 'paid'));
    const rejectBtn = div.querySelector('.reject-btn');
    if (rejectBtn) rejectBtn.addEventListener('click', () => {
      const adminNotes = prompt('Reason for rejecting this withdrawal (optional):') || undefined;
      setWithdrawalStatus(w.id, 'rejected', adminNotes);
    });

    return div;
  }

  async function setWithdrawalStatus(id, status, adminNotes) {
    try {
      await window.GSUApi.apiRequest(`/financial/admin/withdrawals/${id}/status`, {
        method: 'PATCH',
        body: { status, adminNotes },
      });
      showAlert(`Withdrawal marked as ${status}.`, 'success');
      loadWithdrawalsAdmin();
    } catch (err) {
      showAlert(err.message || 'Could not update withdrawal.');
    }
  }

  // ---------- Refunds (admin) ----------

  const refundsList = document.getElementById('refundsList');
  const refundsEmpty = document.getElementById('refundsEmpty');

  async function loadRefunds() {
    try {
      const { data } = await window.GSUApi.apiRequest('/financial/admin/refunds/pending?limit=50');
      refundsList.innerHTML = '';
      if (data.refunds.length === 0) {
        refundsEmpty.classList.remove('d-none');
        return;
      }
      refundsEmpty.classList.add('d-none');
      data.refunds.forEach(r => refundsList.appendChild(refundCard(r)));
    } catch (err) {
      showAlert(err.message || 'Failed to load refunds.');
    }
  }

  function refundCard(r) {
    const div = document.createElement('div');
    div.className = 'card border-0 shadow-sm';
    div.style.borderRadius = '12px';

    const requestedAt = new Date(r.created_at).toLocaleString();

    div.innerHTML = `
      <div class="card-body p-4 d-flex justify-content-between align-items-center flex-wrap gap-3">
        <div>
          <h5 class="mb-1 fw-bold text-white">Order #${r.order_id} &middot; ${currency(r.amount)}</h5>
          <p class="small text-muted mb-0">${escapeHtml(r.customer_name)} (${escapeHtml(r.customer_email)}) &middot; requested ${requestedAt}</p>
        </div>
        <button class="btn btn-sm btn-gsu-primary fw-medium process-btn" style="border-radius: 6px;">Process Refund</button>
      </div>
    `;
    div.querySelector('.process-btn').addEventListener('click', () => {
      const adminNotes = prompt('Notes for this refund (optional):') || undefined;
      processRefund(r.id, adminNotes);
    });
    return div;
  }

  async function processRefund(id, adminNotes) {
    try {
      await window.GSUApi.apiRequest(`/financial/admin/refunds/${id}/process`, {
        method: 'PATCH',
        body: { adminNotes },
      });
      showAlert('Refund marked as processed.', 'success');
      loadRefunds();
    } catch (err) {
      showAlert(err.message || 'Could not process refund.');
    }
  }

  // ---------- Wiring ----------

  vendorStatusFilter.addEventListener('change', loadVendors);
  userRoleFilter.addEventListener('change', loadUsers);
  saveVendorBtn.addEventListener('click', createVendor);
  document.getElementById('vendorsTabBtn').addEventListener('click', loadVendors);
  document.getElementById('usersTabBtn').addEventListener('click', loadUsers);
  document.getElementById('analyticsTabBtn').addEventListener('click', loadAnalytics);
  document.getElementById('withdrawalsTabBtn').addEventListener('click', loadWithdrawalsAdmin);
  document.getElementById('refundsTabBtn').addEventListener('click', loadRefunds);
  withdrawalStatusFilter.addEventListener('change', loadWithdrawalsAdmin);

  logoutBtn.addEventListener('click', () => {
    window.GSUApi.clearToken();
    window.location.href = '/shared/login.html';
  });

  // Initialize data on load
  loadAnalytics();
})();