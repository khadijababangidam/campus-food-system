/**
 * Student/staff ordering flow: browse menu -> single-vendor cart -> checkout -> POST /orders.
 */
(function () {
  const CART_KEY = 'gsu_food_cart';

  const menuGrid = document.getElementById('menuGrid');
  const emptyState = document.getElementById('emptyState');
  const alertBox = document.getElementById('alertBox');
  const vendorFilter = document.getElementById('vendorFilter');
  const categoryFilter = document.getElementById('categoryFilter');

  const cartItemsEl = document.getElementById('cartItems');
  const cartEmptyEl = document.getElementById('cartEmpty');
  const cartVendorNameEl = document.getElementById('cartVendorName');
  const cartTotalEl = document.getElementById('cartTotal');
  const checkoutBtn = document.getElementById('checkoutBtn');
  const checkoutError = document.getElementById('checkoutError');

  // Dual cart counts for desktop vs mobile nav
  const cartCountDesktop = document.getElementById('cartCountDesktop');
  const cartCountMobile = document.getElementById('cartCountMobile');

  const ordersList = document.getElementById('ordersList');
  const ordersEmpty = document.getElementById('ordersEmpty');
  const ordersPanel = document.getElementById('ordersPanel');

  // Dual logout buttons
  const logoutBtnDesktop = document.getElementById('logoutBtnDesktop');
  const logoutBtnMobile = document.getElementById('logoutBtnMobile');

  let cart = loadCart();
  let knownVendors = new Map();
  let vendorRatings = new Map();

  function loadCart() {
    try { return JSON.parse(sessionStorage.getItem(CART_KEY)) || { vendorId: null, vendorName: null, items: {} }; } 
    catch { return { vendorId: null, vendorName: null, items: {} }; }
  }

  function saveCart() { sessionStorage.setItem(CART_KEY, JSON.stringify(cart)); }

  function showAlert(message, type = 'danger') {
    alertBox.innerHTML = `<div class="d-flex align-items-center gap-2"><i class="bi bi-info-circle-fill"></i> ${message}</div>`;
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

  // ---------- Menu browsing ----------

  async function loadCategories() {
    try {
      const { data } = await window.GSUApi.apiRequest('/menu/categories', { auth: false });
      data.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.id; opt.textContent = cat.name;
        categoryFilter.appendChild(opt);
      });
    } catch (err) { console.error('Failed to load categories', err); }
  }

  async function loadMenu() {
    const params = new URLSearchParams({ limit: '100' });
    if (vendorFilter.value) params.set('vendorId', vendorFilter.value);
    if (categoryFilter.value) params.set('categoryId', categoryFilter.value);

    try {
      const { data } = await window.GSUApi.apiRequest(`/menu?${params.toString()}`, { auth: false });
      menuGrid.innerHTML = '';

      if (data.items.length === 0) {
        emptyState.classList.remove('d-none');
      } else {
        emptyState.classList.add('d-none');
        data.items.forEach(item => {
          knownVendors.set(item.vendor_id, item.vendor_name);
          menuGrid.appendChild(menuCard(item));
        });
        refreshVendorFilterOptions();
        loadVendorRatings();
      }
    } catch (err) { showAlert(err.message || 'Failed to load menu.'); }
  }

  async function loadVendorRatings() {
    const ids = [...knownVendors.keys()];
    if (ids.length === 0) return;
    try {
      const { data } = await window.GSUApi.apiRequest(`/reviews/vendor-summaries?vendorIds=${ids.join(',')}`, { auth: false });
      Object.entries(data).forEach(([vendorId, summary]) => vendorRatings.set(Number(vendorId), summary));
      document.querySelectorAll('[data-vendor-rating]').forEach(el => {
        const vendorId = Number(el.dataset.vendorRating);
        const summary = vendorRatings.get(vendorId);
        if (summary && summary.reviewCount > 0) {
          el.innerHTML = `<i class="bi bi-star-fill text-warning"></i> ${summary.averageRating.toFixed(1)}`;
          el.classList.remove('d-none');
        }
      });
    } catch (err) { console.error('Failed to load vendor ratings', err); }
  }

  function refreshVendorFilterOptions() {
    const currentValue = vendorFilter.value;
    const existingValues = new Set([...vendorFilter.options].map(o => o.value));
    knownVendors.forEach((name, id) => {
      if (!existingValues.has(String(id))) {
        const opt = document.createElement('option');
        opt.value = id; opt.textContent = name;
        vendorFilter.appendChild(opt);
      }
    });
    vendorFilter.value = currentValue;
  }

  function menuCard(item) {
    const col = document.createElement('div');
    col.className = 'col-12 col-md-6 col-lg-4';
    col.innerHTML = `
      <div class="card h-100 border-0 shadow-sm" style="border-radius: 16px; background-color: var(--gsu-surface); overflow: hidden;">
        <div class="food-gradient m-2 mb-0 position-relative">
          <i class="bi bi-basket2-fill fs-1 text-success opacity-50"></i>
          <span class="position-absolute top-0 end-0 badge bg-dark bg-opacity-75 m-2 d-none rounded-pill border border-secondary" data-vendor-rating="${item.vendor_id}"></span>
        </div>
        <div class="card-body p-3 d-flex flex-column justify-content-between">
          <div>
            <h5 class="card-title fw-bold text-white mb-1 lh-sm">${escapeHtml(item.name)}</h5>
            <p class="text-secondary small fw-medium mb-2 d-flex align-items-center gap-1">
              <i class="bi bi-shop"></i> ${escapeHtml(item.vendor_name)}
            </p>
            <p class="card-text small text-muted mb-3 line-clamp-2">${item.description ? escapeHtml(item.description) : ''}</p>
          </div>
          <div class="d-flex justify-content-between align-items-center mt-auto pt-2">
            <span class="fs-5 fw-bold text-success">${currency(item.price)}</span>
            <button class="btn btn-gsu-primary rounded-pill add-btn px-4 fw-medium shadow-sm d-flex align-items-center gap-2">
              <i class="bi bi-plus-lg"></i> Add
            </button>
          </div>
        </div>
      </div>
    `;
    col.querySelector('.add-btn').addEventListener('click', () => addToCart(item));
    return col;
  }

  // ---------- Cart ----------

  function addToCart(item) {
    if (cart.vendorId && cart.vendorId !== item.vendor_id && Object.keys(cart.items).length > 0) {
      if (!confirm(`Your cart has items from ${cart.vendorName}. Start a new order with ${item.vendor_name}?`)) return;
      cart = { vendorId: null, vendorName: null, items: {} };
    }
    cart.vendorId = item.vendor_id;
    cart.vendorName = item.vendor_name;
    const existing = cart.items[item.id];
    cart.items[item.id] = { name: item.name, price: Number(item.price), quantity: existing ? existing.quantity + 1 : 1 };
    saveCart(); renderCart();
    showAlert(`Added to cart.`, 'success');
  }

  function changeQuantity(itemId, delta) {
    const line = cart.items[itemId];
    if (!line) return;
    line.quantity += delta;
    if (line.quantity <= 0) delete cart.items[itemId];
    if (Object.keys(cart.items).length === 0) { cart.vendorId = null; cart.vendorName = null; }
    saveCart(); renderCart();
  }

  function renderCart() {
    const entries = Object.entries(cart.items);
    cartItemsEl.innerHTML = '';
    checkoutError.classList.add('d-none');

    let total = 0; let count = 0;

    if (entries.length === 0) {
      cartEmptyEl.classList.remove('d-none');
      cartVendorNameEl.textContent = '';
      cartTotalEl.textContent = currency(0);
      checkoutBtn.disabled = true;
    } else {
      cartEmptyEl.classList.add('d-none');
      cartVendorNameEl.textContent = `Ordering from: ${cart.vendorName}`;
      checkoutBtn.disabled = false;

      entries.forEach(([itemId, line]) => {
        total += line.price * line.quantity; count += line.quantity;
        const row = document.createElement('div');
        row.className = 'd-flex justify-content-between align-items-center mb-3 p-3 bg-dark bg-opacity-50 border border-secondary border-opacity-25';
        row.style.borderRadius = '12px';
        row.innerHTML = `
          <div class="pe-3">
            <div class="fw-semibold text-white mb-1 lh-sm">${escapeHtml(line.name)}</div>
            <small class="text-success fw-medium">${currency(line.price)}</small>
          </div>
          <div class="d-flex align-items-center bg-dark rounded-pill border border-secondary border-opacity-50 p-1">
            <button class="btn btn-sm btn-link text-white minus-btn border-0 rounded-circle p-0" style="width: 28px; height: 28px;"><i class="bi bi-dash"></i></button>
            <span class="fw-bold text-white px-2" style="min-width: 20px; text-align: center;">${line.quantity}</span>
            <button class="btn btn-sm btn-link text-success plus-btn border-0 rounded-circle p-0" style="width: 28px; height: 28px;"><i class="bi bi-plus-lg"></i></button>
          </div>
        `;
        row.querySelector('.minus-btn').addEventListener('click', () => changeQuantity(itemId, -1));
        row.querySelector('.plus-btn').addEventListener('click', () => changeQuantity(itemId, 1));
        cartItemsEl.appendChild(row);
      });
    }

    cartTotalEl.textContent = currency(total);
    // Sync counts to both UI locations
    [cartCountDesktop, cartCountMobile].forEach(el => {
      el.textContent = count;
      count > 0 ? el.classList.remove('d-none') : el.classList.add('d-none');
    });
  }

  async function checkout() {
    const items = Object.entries(cart.items).map(([itemId, line]) => ({ itemId: Number(itemId), quantity: line.quantity }));
    if (items.length === 0) return;

    checkoutBtn.disabled = true; checkoutError.classList.add('d-none');
    checkoutBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Processing...`;

    try {
      const { data: order } = await window.GSUApi.apiRequest('/orders', { method: 'POST', body: { vendorId: cart.vendorId, items } });
      cart = { vendorId: null, vendorName: null, items: {} }; saveCart(); renderCart();
      await payForOrder(order.id);
    } catch (err) {
      checkoutError.textContent = err.message || 'Checkout failed.';
      checkoutError.classList.remove('d-none');
      checkoutBtn.innerHTML = `<span>Checkout</span> <i class="bi bi-arrow-right-short fs-4"></i>`;
      checkoutBtn.disabled = false;
    }
  }

  async function payForOrder(orderId) {
    try {
      const { data } = await window.GSUApi.apiRequest('/payments/initialize', { method: 'POST', body: { orderId } });
      window.location.href = data.authorizationUrl;
    } catch (err) { showAlert(err.message || 'Could not start payment.'); }
  }

  // ---------- Orders ----------

  const STATUS_CONFIG = {
    pending: { label: 'Pending Payment', color: 'text-warning', icon: 'bi-hourglass-split' },
    payment_failed: { label: 'Payment Failed', color: 'text-danger', icon: 'bi-x-circle' },
    confirmed: { label: 'Confirmed', color: 'text-info', icon: 'bi-check-circle' },
    preparing: { label: 'Preparing', color: 'text-primary', icon: 'bi-fire' },
    ready: { label: 'Ready for Pickup', color: 'text-success', icon: 'bi-bag-check' },
    out_for_delivery: { label: 'Out for Delivery', color: 'text-primary', icon: 'bi-bicycle' },
    delivered: { label: 'Delivered', color: 'text-success', icon: 'bi-house-check' },
    cancelled: { label: 'Cancelled', color: 'text-secondary', icon: 'bi-slash-circle' }
  };

  async function loadOrders() {
    try {
      const { data } = await window.GSUApi.apiRequest('/orders/mine?limit=50');
      ordersList.innerHTML = '';
      if (data.orders.length === 0) {
        ordersEmpty.classList.remove('d-none'); return;
      }
      ordersEmpty.classList.add('d-none');
      data.orders.forEach(order => ordersList.appendChild(orderCard(order)));
    } catch (err) { showAlert(err.message || 'Failed to load orders.'); }
  }

  function orderCard(order) {
    const div = document.createElement('div');
    div.className = 'card border-0 shadow-sm p-3 mb-2';
    div.style.borderRadius = '16px';
    div.style.backgroundColor = 'rgba(255,255,255,0.03)';
    
    const conf = STATUS_CONFIG[order.status] || { label: order.status, color: 'text-secondary', icon: 'bi-dot' };
    const canCancel = order.status === 'pending' || order.status === 'payment_failed';
    const canRetry = order.status === 'payment_failed';
    const canReview = order.status === 'delivered' && order.review_rating == null;
    
    div.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div class="d-flex align-items-center gap-2 ${conf.color} fw-bold small text-uppercase" style="letter-spacing: 0.5px;">
          <i class="bi ${conf.icon} fs-5"></i> ${conf.label}
        </div>
        <strong class="text-white">#${order.id}</strong>
      </div>
      
      <div class="mb-3 ps-3 border-start border-2 border-secondary border-opacity-50">
        <h6 class="mb-1 text-white fw-bold">${escapeHtml(order.vendor_name)}</h6>
        <div class="d-flex justify-content-between align-items-end">
          <span class="text-muted small">${order.rider_name ? `<i class="bi bi-person-fill text-secondary"></i> Rider: ${escapeHtml(order.rider_name)}` : 'Waiting for vendor...'}</span>
          <span class="fs-5 fw-bold text-success">${currency(order.total_amount)}</span>
        </div>
      </div>
      
      ${order.review_rating != null ? `<div class="bg-dark bg-opacity-50 p-2 rounded-3 small text-warning mb-3 d-flex gap-2"><i class="bi bi-star-fill mt-1"></i> <div>${'\u2605'.repeat(order.review_rating)}${'\u2606'.repeat(5 - order.review_rating)}${order.review_comment ? '<br><span class="text-white opacity-75">' + escapeHtml(order.review_comment) + '</span>' : ''}</div></div>` : ''}
      
      <div class="d-flex gap-2 mt-auto">
        ${canRetry ? `<button class="btn btn-gsu-primary thumb-btn flex-grow-1 retry-btn">Retry Pay</button>` : ''}
        ${canCancel ? `<button class="btn btn-outline-danger thumb-btn flex-grow-1 cancel-btn">Cancel</button>` : ''}
        ${canReview ? `<button class="btn btn-outline-success thumb-btn flex-grow-1 review-btn"><i class="bi bi-star"></i> Review</button>` : ''}
      </div>
    `;
    const cancelBtn = div.querySelector('.cancel-btn'); if (cancelBtn) cancelBtn.addEventListener('click', () => cancelOrder(order.id));
    const retryBtn = div.querySelector('.retry-btn'); if (retryBtn) retryBtn.addEventListener('click', () => payForOrder(order.id));
    const reviewBtn = div.querySelector('.review-btn'); if (reviewBtn) reviewBtn.addEventListener('click', () => openReviewModal(order.id));
    return div;
  }

  async function cancelOrder(orderId) {
    if (!confirm('Cancel this order?')) return;
    try { await window.GSUApi.apiRequest(`/orders/${orderId}/cancel`, { method: 'PATCH' }); loadOrders(); } 
    catch (err) { showAlert(err.message || 'Could not cancel order.'); }
  }

  // ---------- Reviews ----------
  const reviewModalEl = document.getElementById('reviewModal');
  const reviewModal = new bootstrap.Modal(reviewModalEl);
  const reviewOrderIdField = document.getElementById('reviewOrderId');
  const reviewRatingField = document.getElementById('reviewRating');
  const reviewCommentField = document.getElementById('reviewComment');
  const reviewFormError = document.getElementById('reviewFormError');
  const submitReviewBtn = document.getElementById('submitReviewBtn');

  function openReviewModal(orderId) {
    reviewOrderIdField.value = orderId; reviewRatingField.value = '5'; reviewCommentField.value = '';
    reviewFormError.classList.add('d-none'); reviewModal.show();
  }

  async function submitReview() {
    const payload = { rating: Number(reviewRatingField.value), comment: reviewCommentField.value.trim() || null };
    submitReviewBtn.disabled = true; reviewFormError.classList.add('d-none');
    try {
      await window.GSUApi.apiRequest(`/reviews/order/${reviewOrderIdField.value}`, { method: 'POST', body: payload });
      reviewModal.hide(); showAlert('Thanks for your review!', 'success'); loadOrders();
    } catch (err) {
      reviewFormError.textContent = err.message || 'Could not submit review.';
      reviewFormError.classList.remove('d-none');
    } finally { submitReviewBtn.disabled = false; }
  }

  // ---------- Wiring ----------
  vendorFilter.addEventListener('change', loadMenu);
  categoryFilter.addEventListener('change', loadMenu);
  checkoutBtn.addEventListener('click', checkout);
  ordersPanel.addEventListener('show.bs.offcanvas', loadOrders);
  submitReviewBtn.addEventListener('click', submitReview);
  
  const handleLogout = () => { window.GSUApi.clearToken(); window.location.href = '/shared/login.html'; };
  logoutBtnDesktop.addEventListener('click', handleLogout);
  logoutBtnMobile.addEventListener('click', handleLogout);

  loadCategories(); loadMenu(); renderCart();
})();