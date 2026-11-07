/**
 * Vendor menu management and active order polling.
 */
(function () {
  const menuListEl = document.getElementById('menuList');
  const emptyStateEl = document.getElementById('emptyState');
  const alertBox = document.getElementById('alertBox');
  const itemModalEl = document.getElementById('itemModal');
  const itemModal = new bootstrap.Modal(itemModalEl);
  const itemModalTitle = document.getElementById('itemModalTitle');
  const itemForm = document.getElementById('itemForm');
  const formError = document.getElementById('formError');
  const saveItemBtn = document.getElementById('saveItemBtn');
  const addItemBtn = document.getElementById('addItemBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  // Notification Toast elements
  const orderToastEl = document.getElementById('orderToast');
  const orderToast = new bootstrap.Toast(orderToastEl, { delay: 6000 });

  const itemIdField = document.getElementById('itemId');
  const nameField = document.getElementById('itemName');
  const categoryField = document.getElementById('itemCategory');
  const priceField = document.getElementById('itemPrice');
  const descriptionField = document.getElementById('itemDescription');

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

  function itemCard(item) {
    const col = document.createElement('div');
    col.className = 'col-12 col-md-6 col-lg-4';
    
    col.innerHTML = `
      <div class="card h-100 border-0 shadow-sm ${item.available ? '' : 'opacity-50'}" style="border-radius: 12px; background-color: rgba(255,255,255,0.03);">
        <div class="card-body p-4 d-flex flex-column justify-content-between">
          <div>
            <div class="d-flex justify-content-between align-items-start mb-2">
              <h5 class="card-title mb-0 fw-bold text-white">${escapeHtml(item.name)}</h5>
              <span class="badge status-badge ${item.available ? 'bg-success' : 'bg-secondary'}">
                ${item.available ? 'Available' : 'Hidden'}
              </span>
            </div>
            <p class="small text-secondary mb-2"><i class="bi bi-tag"></i> ${item.category_name ? escapeHtml(item.category_name) : 'Uncategorised'}</p>
            <p class="h5 fw-bold text-success mb-3">${currency(item.price)}</p>
            <p class="card-text small text-muted mb-4">${item.description ? escapeHtml(item.description) : 'No description provided.'}</p>
          </div>
          
          <div class="d-flex gap-2 pt-3 border-top border-secondary border-opacity-50">
            <button class="btn btn-sm btn-outline-light flex-grow-1 edit-btn" style="border-radius: 6px;"><i class="bi bi-pencil"></i> Edit</button>
            <button class="btn btn-sm btn-outline-warning flex-grow-1 toggle-btn" style="border-radius: 6px;"><i class="bi ${item.available ? 'bi-eye-slash' : 'bi-eye'}"></i> ${item.available ? 'Hide' : 'Unhide'}</button>
            <button class="btn btn-sm btn-outline-danger flex-grow-1 delete-btn" style="border-radius: 6px;"><i class="bi bi-trash"></i></button>
          </div>
        </div>
      </div>
    `;
    col.querySelector('.edit-btn').addEventListener('click', () => openEditModal(item));
    col.querySelector('.toggle-btn').addEventListener('click', () => toggleAvailability(item));
    col.querySelector('.delete-btn').addEventListener('click', () => deleteItem(item));
    return col;
  }

  async function loadCategories() {
    try {
      const { data } = await window.GSUApi.apiRequest('/menu/categories', { auth: false });
      data.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = cat.name;
        categoryField.appendChild(opt);
      });
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  }

  async function loadMenu() {
    try {
      const { data } = await window.GSUApi.apiRequest('/menu/mine');
      menuListEl.innerHTML = '';
      if (data.items.length === 0) {
        emptyStateEl.classList.remove('d-none');
      } else {
        emptyStateEl.classList.add('d-none');
        data.items.forEach(item => menuListEl.appendChild(itemCard(item)));
      }
    } catch (err) {
      showAlert(err.message || 'Failed to load your menu.');
    }
  }

  function openAddModal() {
    itemModalTitle.textContent = 'Add Menu Item';
    itemForm.reset();
    itemIdField.value = '';
    formError.classList.add('d-none');
  }

  function openEditModal(item) {
    itemModalTitle.textContent = 'Edit Menu Item';
    itemIdField.value = item.id;
    nameField.value = item.name;
    categoryField.value = item.category_id || '';
    priceField.value = item.price;
    descriptionField.value = item.description || '';
    formError.classList.add('d-none');
    itemModal.show();
  }

  async function saveItem() {
    const id = itemIdField.value;
    const payload = {
      name: nameField.value.trim(),
      categoryId: categoryField.value ? Number(categoryField.value) : null,
      price: Number(priceField.value),
      description: descriptionField.value.trim() || null,
    };

    saveItemBtn.disabled = true;
    formError.classList.add('d-none');

    try {
      if (id) {
        await window.GSUApi.apiRequest(`/menu/${id}`, { method: 'PUT', body: payload });
      } else {
        await window.GSUApi.apiRequest('/menu', { method: 'POST', body: payload });
      }
      itemModal.hide();
      showAlert(id ? 'Item updated successfully.' : 'Item added successfully.', 'success');
      loadMenu();
    } catch (err) {
      formError.textContent = err.message || 'Could not save item.';
      formError.classList.remove('d-none');
    } finally {
      saveItemBtn.disabled = false;
    }
  }

  async function toggleAvailability(item) {
    try {
      await window.GSUApi.apiRequest(`/menu/${item.id}/availability`, {
        method: 'PATCH',
        body: { available: !item.available },
      });
      loadMenu();
    } catch (err) {
      showAlert(err.message || 'Could not update availability.');
    }
  }

  async function deleteItem(item) {
    if (!confirm(`Delete "${item.name}"? This can't be undone.`)) return;
    try {
      await window.GSUApi.apiRequest(`/menu/${item.id}`, { method: 'DELETE' });
      showAlert('Item deleted successfully.', 'success');
      loadMenu();
    } catch (err) {
      showAlert(err.message || 'Could not delete item.');
    }
  }

  addItemBtn.addEventListener('click', openAddModal);
  saveItemBtn.addEventListener('click', saveItem);
  logoutBtn.addEventListener('click', () => {
    window.GSUApi.clearToken();
    window.location.href = '/shared/login.html';
  });

  // ---------- Incoming Orders + lifecycle actions ----------

  const ordersList = document.getElementById('ordersList');
  const ordersEmpty = document.getElementById('ordersEmpty');
  const orderStatusFilter = document.getElementById('orderStatusFilter');
  const ordersTabBtn = document.getElementById('ordersTabBtn');

  const STATUS_LABELS = {
    pending: { text: 'Pending Payment', color: 'bg-warning text-dark' },
    payment_failed: { text: 'Payment Failed', color: 'bg-danger' },
    confirmed: { text: 'Confirmed', color: 'bg-info text-dark' },
    preparing: { text: 'Preparing', color: 'bg-primary' },
    ready: { text: 'Ready', color: 'bg-success' },
    out_for_delivery: { text: 'Out for Delivery', color: 'bg-primary' },
    delivered: { text: 'Delivered', color: 'bg-success' },
    cancelled: { text: 'Cancelled', color: 'bg-secondary' },
  };

  async function loadOrders() {
    const params = new URLSearchParams({ limit: '50' });
    if (orderStatusFilter.value) params.set('status', orderStatusFilter.value);

    try {
      const { data } = await window.GSUApi.apiRequest(`/orders/vendor?${params.toString()}`);
      ordersList.innerHTML = '';
      if (data.orders.length === 0) {
        ordersEmpty.classList.remove('d-none');
        return;
      }
      ordersEmpty.classList.add('d-none');
      data.orders.forEach(order => ordersList.appendChild(vendorOrderCard(order)));
    } catch (err) {
      showAlert(err.message || 'Failed to load orders.');
    }
  }

  function vendorOrderCard(order) {
    const div = document.createElement('div');
    div.className = 'card border-0 shadow-sm mb-2';
    div.style.borderRadius = '12px';
    div.style.backgroundColor = 'rgba(255,255,255,0.03)';
    
    const placedAt = new Date(order.created_at).toLocaleString();
    let actionBtn = '';
    if (order.status === 'confirmed') {
      actionBtn = '<button class="btn btn-sm btn-gsu-primary prepare-btn fw-medium px-4 w-100" style="border-radius: 8px;"><i class="bi bi-fire"></i> Start Preparing</button>';
    } else if (order.status === 'preparing') {
      actionBtn = '<button class="btn btn-sm btn-success ready-btn fw-medium px-4 w-100" style="border-radius: 8px;"><i class="bi bi-bag-check"></i> Mark Ready</button>';
    }
    
    const statusObj = STATUS_LABELS[order.status] || { text: order.status, color: 'bg-secondary' };

    div.innerHTML = `
      <div class="card-body p-4">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <strong class="text-white fs-6">Order #${order.id}</strong>
          <span class="badge status-badge ${statusObj.color}" style="border-radius: 6px;">${statusObj.text}</span>
        </div>
        <div class="d-flex justify-content-between align-items-end mb-3">
          <div>
            <p class="small text-secondary mb-1"><i class="bi bi-person"></i> Customer: <span class="text-white">${escapeHtml(order.customer_name)}</span></p>
            <p class="small text-muted mb-0"><i class="bi bi-clock"></i> ${placedAt}</p>
          </div>
          <p class="h6 fw-bold text-success mb-0">${currency(order.total_amount)}</p>
        </div>
        
        ${order.rider_name ? `<div class="bg-dark p-2 rounded small text-muted mb-2"><i class="bi bi-bicycle"></i> Rider: <span class="text-white">${escapeHtml(order.rider_name)}</span> (${escapeHtml(order.delivery_status || '')})</div>` : ''}
        ${order.review_rating != null ? `<div class="bg-dark p-2 rounded small text-warning mb-2"><i class="bi bi-star-fill"></i> ${'\u2605'.repeat(order.review_rating)}${'\u2606'.repeat(5 - order.review_rating)} ${order.review_comment ? '— <span class="text-white opacity-75">' + escapeHtml(order.review_comment) + '</span>' : ''}</div>` : ''}
        
        ${actionBtn ? `<div class="mt-3 pt-3 border-top border-secondary border-opacity-50">${actionBtn}</div>` : ''}
      </div>
    `;
    
    const prepareBtn = div.querySelector('.prepare-btn');
    if (prepareBtn) prepareBtn.addEventListener('click', () => advanceOrder(order.id, 'prepare'));
    const readyBtn = div.querySelector('.ready-btn');
    if (readyBtn) readyBtn.addEventListener('click', () => advanceOrder(order.id, 'ready'));
    return div;
  }

  async function advanceOrder(orderId, action) {
    try {
      await window.GSUApi.apiRequest(`/orders/${orderId}/${action}`, { method: 'PATCH' });
      showAlert(action === 'prepare' ? 'Order marked as preparing.' : 'Order marked ready for pickup.', 'success');
      loadOrders();
    } catch (err) {
      showAlert(err.message || 'Could not update order.');
    }
  }

  orderStatusFilter.addEventListener('change', loadOrders);
  ordersTabBtn.addEventListener('click', loadOrders);

  // ---------- Wallet & Withdrawals ----------

  const walletAvailableBalanceEl = document.getElementById('walletAvailableBalance');
  const walletTotalEarnedEl = document.getElementById('walletTotalEarned');
  const withdrawalAvailableBalanceEl = document.getElementById('withdrawalAvailableBalance');
  const withdrawalsListEl = document.getElementById('withdrawalsList');
  const withdrawalsEmptyEl = document.getElementById('withdrawalsEmpty');
  const walletTxTableBody = document.getElementById('walletTxTableBody');
  const walletTabBtn = document.getElementById('walletTabBtn');

  const withdrawalModalEl = document.getElementById('withdrawalModal');
  const withdrawalModal = new bootstrap.Modal(withdrawalModalEl);
  const withdrawalForm = document.getElementById('withdrawalForm');
  const withdrawalFormError = document.getElementById('withdrawalFormError');
  const submitWithdrawalBtn = document.getElementById('submitWithdrawalBtn');

  const WITHDRAWAL_STATUS_LABELS = {
    pending: { text: 'Pending', color: 'bg-warning text-dark' },
    approved: { text: 'Approved', color: 'bg-info text-dark' },
    paid: { text: 'Paid', color: 'bg-success' },
    rejected: { text: 'Rejected', color: 'bg-danger' },
  };

  async function loadWallet() {
    try {
      const { data } = await window.GSUApi.apiRequest('/financial/wallet');
      walletAvailableBalanceEl.textContent = currency(data.available_balance);
      walletTotalEarnedEl.textContent = currency(data.total_earned);
      withdrawalAvailableBalanceEl.textContent = currency(data.available_balance);
    } catch (err) {
      showAlert(err.message || 'Failed to load wallet.');
    }
  }

  async function loadWithdrawals() {
    try {
      const { data } = await window.GSUApi.apiRequest('/financial/withdrawals?limit=50');
      withdrawalsListEl.innerHTML = '';
      if (data.withdrawals.length === 0) {
        withdrawalsEmptyEl.classList.remove('d-none');
        return;
      }
      withdrawalsEmptyEl.classList.add('d-none');
      data.withdrawals.forEach(w => withdrawalsListEl.appendChild(withdrawalCard(w)));
    } catch (err) {
      showAlert(err.message || 'Failed to load withdrawals.');
    }
  }

  function withdrawalCard(w) {
    const div = document.createElement('div');
    div.className = 'card border-0 shadow-sm';
    div.style.borderRadius = '12px';
    div.style.backgroundColor = 'rgba(255,255,255,0.03)';

    const statusObj = WITHDRAWAL_STATUS_LABELS[w.status] || { text: w.status, color: 'bg-secondary' };
    const requestedAt = new Date(w.created_at).toLocaleString();

    div.innerHTML = `
      <div class="card-body p-4">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <strong class="text-white fs-6">${currency(w.amount)}</strong>
          <span class="badge status-badge ${statusObj.color}" style="border-radius: 6px;">${statusObj.text}</span>
        </div>
        <p class="small text-secondary mb-1"><i class="bi bi-bank"></i> ${escapeHtml(w.bank_name)} &middot; ${escapeHtml(w.account_number)} (${escapeHtml(w.account_name)})</p>
        <p class="small text-muted mb-0"><i class="bi bi-clock"></i> Requested ${requestedAt}</p>
        ${w.admin_notes ? `<div class="bg-dark p-2 rounded small text-muted mt-2"><i class="bi bi-chat-left-text"></i> ${escapeHtml(w.admin_notes)}</div>` : ''}
      </div>
    `;
    return div;
  }

  async function loadWalletTransactions() {
    try {
      const { data } = await window.GSUApi.apiRequest('/financial/wallet/transactions?limit=20');
      walletTxTableBody.innerHTML = data.transactions
        .map(tx => `
          <tr>
            <td class="px-4 py-3">${new Date(tx.created_at).toLocaleDateString()}</td>
            <td class="py-3"><span class="badge ${tx.type === 'credit' ? 'bg-success' : 'bg-secondary'}">${tx.type}</span></td>
            <td class="py-3 ${tx.type === 'credit' ? 'text-success' : 'text-danger'} fw-medium">${tx.type === 'credit' ? '+' : '-'}${currency(tx.amount)}</td>
            <td class="py-3 text-muted small">${escapeHtml(tx.reference)}</td>
          </tr>
        `).join('') || '<tr><td colspan="4" class="text-muted px-4 py-3 text-center">No wallet activity yet.</td></tr>';
    } catch (err) {
      showAlert(err.message || 'Failed to load wallet activity.');
    }
  }

  async function submitWithdrawal() {
    const payload = {
      amount: Number(document.getElementById('wAmount').value),
      bankName: document.getElementById('wBankName').value.trim(),
      accountNumber: document.getElementById('wAccountNumber').value.trim(),
      accountName: document.getElementById('wAccountName').value.trim(),
    };

    submitWithdrawalBtn.disabled = true;
    withdrawalFormError.classList.add('d-none');

    try {
      await window.GSUApi.apiRequest('/financial/withdrawals', { method: 'POST', body: payload });
      withdrawalModal.hide();
      withdrawalForm.reset();
      showAlert('Withdrawal request submitted.', 'success');
      loadWallet();
      loadWithdrawals();
      loadWalletTransactions();
    } catch (err) {
      withdrawalFormError.textContent = err.message || 'Could not submit withdrawal request.';
      withdrawalFormError.classList.remove('d-none');
    } finally {
      submitWithdrawalBtn.disabled = false;
    }
  }

  submitWithdrawalBtn.addEventListener('click', submitWithdrawal);
  walletTabBtn.addEventListener('click', () => {
    loadWallet();
    loadWithdrawals();
    loadWalletTransactions();
  });
  withdrawalModalEl.addEventListener('show.bs.modal', loadWallet);

  // ---------- Background Polling (FR5 Notification Engine) ----------
  
  let knownConfirmedOrderIds = new Set();
  let isFirstLoad = true;

  async function pollForNewOrders() {
    try {
      // Check silently in the background for confirmed orders
      const { data } = await window.GSUApi.apiRequest('/orders/vendor?status=confirmed&limit=50', { method: 'GET' });
      const currentConfirmedIds = new Set(data.orders.map(o => o.id));

      if (!isFirstLoad) {
        let hasNewOrder = false;
        currentConfirmedIds.forEach(id => {
          if (!knownConfirmedOrderIds.has(id)) {
            hasNewOrder = true; // We found an ID that wasn't in our previous check
          }
        });

        if (hasNewOrder) {
          // Trigger the Toast UI
          orderToast.show();
          
          // Refresh the visible list only if they are actively on the Orders tab
          // (or just always refresh it so it's ready when they switch tabs)
          loadOrders(); 
        }
      }

      knownConfirmedOrderIds = currentConfirmedIds;
      isFirstLoad = false;
    } catch (err) {
      // Fail silently to avoid spamming the user with error banners if the network drops temporarily
      console.log('Polling check skipped due to network or auth state.');
    }
  }

  // Initialize data on load
  loadCategories();
  loadMenu();
  
  // Start the polling engine (checks every 15 seconds)
  setInterval(pollForNewOrders, 15000);
  pollForNewOrders(); // Initial baseline check
})();