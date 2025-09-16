// student.js
import {
  ensureInit, listMenu, getStudent, ensureStudent, getRecentCancellationCount, getCancelThreshold,
  createOrder, setOrderPaymentCode, listOrdersByPid, cancelOrder, recordCancellation, setStudentBlocked
} from "./storage.js";
import { debounce, money, generatePaymentCode } from "./utils.js";

const menuGrid = document.getElementById("menuGrid");
const searchInput = document.getElementById("searchInput");
const showUnavailable = document.getElementById("showUnavailable");
const cartBtn = document.getElementById("cartBtn");
const cartCountEl = document.getElementById("cartCount");
const cartDrawer = document.getElementById("cartDrawer");
const scrim = document.getElementById("scrim");
const closeCartBtn = document.getElementById("closeCartBtn");
const cartItemsEl = document.getElementById("cartItems");
const subtotalEl = document.getElementById("subtotal");
const checkoutBtn = document.getElementById("checkoutBtn");
const pidDialog = document.getElementById("pidDialog");
const pidForm = document.getElementById("pidForm");
const pidInput = document.getElementById("pidInput");
const pidWarnings = document.getElementById("pidWarnings");
const cancelPid = document.getElementById("cancelPid");
const paymentDialog = document.getElementById("paymentDialog");
const paymentTotalEl = document.getElementById("paymentTotal");
const generatePaymentCodeBtn = document.getElementById("generatePaymentCodeBtn");
const paymentCodeBlock = document.getElementById("paymentCodeBlock");
const paymentCodeText = document.getElementById("paymentCodeText");
const copyPayCodeBtn = document.getElementById("copyPayCodeBtn");
const cancelPaymentBtn = document.getElementById("cancelPaymentBtn");
const viewOrdersBtn = document.getElementById("viewOrdersBtn");
const ordersDialog = document.getElementById("ordersDialog");
const ordersForm = document.getElementById("ordersForm");
const ordersPidInput = document.getElementById("ordersPidInput");
const ordersList = document.getElementById("ordersList");
const studentNotice = document.getElementById("studentNotice");

let cart = []; // [{itemId,name,price,qty,imageUrl}]
let menu = [];

async function init() {
  await ensureInit();
  menu = await listMenu();
  renderMenu();
  restoreCart();
  bindEvents();
}
init();

function bindEvents(){
  searchInput.addEventListener("input", debounce(renderMenu, 200));
  showUnavailable.addEventListener("change", renderMenu);
  cartBtn.addEventListener("click", () => openDrawer(true));
  closeCartBtn.addEventListener("click", () => openDrawer(false));
  scrim.addEventListener("click", () => openDrawer(false));
  checkoutBtn.addEventListener("click", onCheckout);

  pidForm.addEventListener("submit", onConfirmPid);
  cancelPid.addEventListener("click", ()=> pidDialog.close());
  cancelPaymentBtn.addEventListener("click", ()=> paymentDialog.close());
  generatePaymentCodeBtn.addEventListener("click", onGeneratePaymentCode);
  copyPayCodeBtn.addEventListener("click", async ()=>{
    await navigator.clipboard.writeText(paymentCodeText.textContent || "");
    copyPayCodeBtn.textContent = "Copied!";
    setTimeout(()=> copyPayCodeBtn.textContent = "Copy Code", 1200);
  });

  viewOrdersBtn.addEventListener("click", ()=>{
    ordersPidInput.value = localStorage.getItem("cms_last_pid") || "";
    ordersList.innerHTML = "";
    ordersDialog.showModal();
  });
  ordersForm.addEventListener("submit", onViewOrdersSubmit);

  window.addEventListener("cms:storage-updated", async ()=> {
    menu = await listMenu();
    renderMenu();
  });
}

function renderMenu(){
  const q = (searchInput.value || "").toLowerCase().trim();
  const showAll = showUnavailable.checked;
  const items = menu.filter(m => (showAll || m.available) && (!q || m.name.toLowerCase().includes(q)));
  menuGrid.innerHTML = "";
  if (items.length === 0) {
    menuGrid.innerHTML = `<div class="muted">No menu items found.</div>`;
    return;
  }
  for (const it of items) {
    const card = document.createElement("div");
    card.className = "card menu-card";
    const url = it.imageUrl || "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?q=80&w=400&auto=format&fit=crop";
    card.innerHTML = `
      <img class="menu-img" alt="${it.name}" src="${url}">
      <div class="menu-title-row">
        <h3 class="menu-title">${it.name}</h3>
      </div>
      <div class="menu-sub">
        <div>₹ ${money(it.price)}</div>
        ${it.available ? `<div class="qty-row">
            <input type="number" min="1" step="1" value="1" id="qty-${it.id}">
            <button class="btn" data-add="${it.id}">Add</button>
          </div>` : `<span class="status CANCELLED">Unavailable</span>`}
      </div>
    `;
    menuGrid.appendChild(card);
    if (it.available) {
      card.querySelector(`[data-add="${it.id}"]`).addEventListener("click", ()=>{
        const qtyInput = card.querySelector(`#qty-${it.id}`);
        const qty = Math.max(1, parseInt(qtyInput.value || "1", 10));
        addToCart({ itemId: it.id, name: it.name, price: it.price, imageUrl: url, qty });
      });
    }
  }
}

function addToCart(item){
  const idx = cart.findIndex(c => c.itemId === item.itemId);
  if (idx >= 0) cart[idx].qty += item.qty;
  else cart.push(item);
  persistCart();
  updateCartBadge();
  openDrawer(true);
  renderCart();
}

function persistCart(){
  localStorage.setItem("cms_cart", JSON.stringify(cart));
}
function restoreCart(){
  try { cart = JSON.parse(localStorage.getItem("cms_cart")||"[]") || []; } catch { cart = []; }
  updateCartBadge();
  renderCart();
}

function updateCartBadge(){
  const count = cart.reduce((n,c)=> n + c.qty, 0);
  cartCountEl.textContent = count;
}

function renderCart(){
  cartItemsEl.innerHTML = "";
  if (cart.length === 0) {
    cartItemsEl.innerHTML = `<div class="muted">Your cart is empty.</div>`;
    subtotalEl.textContent = "0";
    return;
  }
  let subtotal = 0;
  for (const it of cart) {
    subtotal += it.qty * it.price;
    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <img src="${it.imageUrl}" alt="">
      <div class="grow">
        <div class="row">
          <strong>${it.name}</strong>
          <span>₹ ${money(it.price)}</span>
        </div>
        <div class="row gap">
          <div class="qty-row">
            <input type="number" min="1" value="${it.qty}" id="cartqty-${it.itemId}">
          </div>
          <button class="btn ghost" data-remove="${it.itemId}">Remove</button>
        </div>
      </div>
    `;
    cartItemsEl.appendChild(row);
    row.querySelector(`#cartqty-${it.itemId}`).addEventListener("change", e=>{
      const val = Math.max(1, parseInt(e.target.value || "1", 10));
      it.qty = val;
      persistCart();
      updateCartBadge();
      renderCart();
    });
    row.querySelector(`[data-remove="${it.itemId}"]`).addEventListener("click", ()=>{
      cart = cart.filter(c => c.itemId !== it.itemId);
      persistCart();
      updateCartBadge();
      renderCart();
    });
  }
  subtotalEl.textContent = money(subtotal);
}

function openDrawer(open){
  cartDrawer.classList.toggle("open", open);
  scrim.classList.toggle("open", open);
}

async function onCheckout(){
  if (cart.length === 0) return;
  // Prompt for PID
  pidWarnings.textContent = "";
  pidInput.value = localStorage.getItem("cms_last_pid") || "";
  await ensureInit();
  pidDialog.showModal();
}

function setNotice(msg, type=""){
  if (!msg) { studentNotice.hidden = true; studentNotice.textContent = ""; return; }
  studentNotice.hidden = false;
  studentNotice.textContent = msg;
  studentNotice.className = "notice " + (type||"");
}

async function onConfirmPid(e){
  e.preventDefault();
  const pid = (pidInput.value || "").trim().toUpperCase();
  if (pid.length < 3) { pidWarnings.textContent = "Please enter a valid PID"; return; }
  localStorage.setItem("cms_last_pid", pid);

  const student = await ensureStudent(pid);
  if (student.blocked) {
    setNotice(`Your account (PID ${pid}) is blocked. Reason: ${student.blockReason || "Policy violation"}`, "error");
    pidDialog.close();
    return;
  }
  const recent = await getRecentCancellationCount(pid, 24);
  const threshold = await getCancelThreshold();
  if (recent >= threshold - 1) {
    pidWarnings.textContent = `Warning: You have ${recent} cancellations in the last 24h. ${threshold - recent} more will result in an automatic block.`;
  } else pidWarnings.textContent = "";

  // Create order
  const items = cart.map(c => ({ itemId: c.itemId, name: c.name, qty: c.qty, price: c.price }));
  const total = cart.reduce((n,c)=> n + c.qty*c.price, 0);
  const order = await createOrder({ pid, items, total });

  // Show payment flow
  paymentTotalEl.textContent = money(total);
  paymentCodeBlock.hidden = true;
  paymentCodeText.textContent = "";
  paymentDialog.showModal();
  // store current pending order id in memory
  pidDialog.close();
  currentPendingOrderId = order.id;
}

let currentPendingOrderId = null;

async function onGeneratePaymentCode(){
  if (!currentPendingOrderId) return;
  const orders = await listOrdersByPid(localStorage.getItem("cms_last_pid") || "");
  const existingCodes = new Set(orders.map(o => (o.paymentCode||"").toUpperCase()).filter(Boolean));
  const code = generatePaymentCode(existingCodes);
  await setOrderPaymentCode(currentPendingOrderId, code);
  paymentCodeText.textContent = code;
  paymentCodeBlock.hidden = false;
  // Clear cart after payment code generation to prevent duplicates
  cart = [];
  persistCart();
  updateCartBadge();
  renderCart();
}

async function renderOrdersList(pid){
  const orders = await listOrdersByPid(pid);
  if (orders.length === 0) {
    ordersList.innerHTML = `<div class="muted small">No orders found for PID ${pid}.</div>`;
    return;
  }
  ordersList.innerHTML = "";
  for (const o of orders) {
    const canCancel = (o.status === "PENDING_PAYMENT" || o.status === "PAID_UNVERIFIED");
    const card = document.createElement("div");
    card.className = "order-card";
    card.innerHTML = `
      <div class="row">
        <div><strong>#${o.id.slice(0,8)}</strong></div>
        <div class="status ${o.status}">${o.status.replace("_"," ")}</div>
      </div>
      <div class="order-items">
        ${o.items.map(it => `<div class="order-item"><span>${it.qty} × ${it.name}</span><span>₹ ${money(it.qty*it.price)}</span></div>`).join("")}
      </div>
      <div class="row">
        <div>Total: <strong>₹ ${money(o.total)}</strong></div>
        ${o.paymentCode ? `<div class="small muted">Code: ${o.paymentCode}</div>` : ""}
      </div>
      <div class="row gap">
        ${canCancel ? `<button class="btn ghost" data-cancel="${o.id}">Cancel</button>` : ""}
      </div>
    `;
    ordersList.appendChild(card);
    if (canCancel) {
      card.querySelector(`[data-cancel="${o.id}"]`).addEventListener("click", async ()=>{
        const updated = await cancelOrder(o.id, "student");
        await recordCancellation(o.pid);
        const cancels = await getRecentCancellationCount(o.pid, 24);
        const threshold = await getCancelThreshold();
        if (cancels >= threshold) {
          await setStudentBlocked(o.pid, true, `Auto-blocked due to ${cancels} cancellations in last 24h`);
        }
        await renderOrdersList(o.pid);
      });
    }
  }
}

function onViewOrdersSubmit(e){
  e.preventDefault();
  const pid = (ordersPidInput.value || "").trim().toUpperCase();
  if (!pid) return;
  localStorage.setItem("cms_last_pid", pid);
  renderOrdersList(pid);
}
