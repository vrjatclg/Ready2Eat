// admin.js
import {
  ensureInit, checkAdminPassword, listOrders, verifyPaymentCode, fulfillOrder, deleteOrder, cancelOrder,
  listMenu, upsertMenuItem, updateMenuAvailability, deleteMenuItem,
  getStudent, setStudentBlocked, getCancelThreshold, setCancelThreshold,
  exportData, importDataFromJSON, factoryReset, setAdminPassword
} from "./storage.js";
import { money, debounce } from "./utils.js";

const loginView = document.getElementById("loginView");
const adminApp = document.getElementById("adminApp");
const adminPasswordInput = document.getElementById("adminPasswordInput");
const loginBtn = document.getElementById("loginBtn");
const loginError = document.getElementById("loginError");
const logoutBtn = document.getElementById("logoutBtn");

const ordersTable = document.getElementById("ordersTable");
const orderSearch = document.getElementById("orderSearch");
const statusFilter = document.getElementById("statusFilter");
const refreshOrders = document.getElementById("refreshOrders");
const verifyCodeInput = document.getElementById("verifyCodeInput");
const verifyCodeBtn = document.getElementById("verifyCodeBtn");
const verifyResult = document.getElementById("verifyResult");

const studentPidInput = document.getElementById("studentPidInput");
const checkStudentBtn = document.getElementById("checkStudentBtn");
const studentStatus = document.getElementById("studentStatus");
const blockStudentBtn = document.getElementById("blockStudentBtn");
const unblockStudentBtn = document.getElementById("unblockStudentBtn");

const menuTable = document.getElementById("menuTable");
const addMenuItemBtn = document.getElementById("addMenuItemBtn");
const menuModal = document.getElementById("menuModal");
const menuForm = document.getElementById("menuForm");
const menuModalTitle = document.getElementById("menuModalTitle");
const menuItemId = document.getElementById("menuItemId");
const menuName = document.getElementById("menuName");
const menuPrice = document.getElementById("menuPrice");
const menuImage = document.getElementById("menuImage");
const menuAvailable = document.getElementById("menuAvailable");
const menuCancelBtn = document.getElementById("menuCancelBtn");

const newPassword = document.getElementById("newPassword");
const changePasswordBtn = document.getElementById("changePasswordBtn");
const cancelThresholdDisplay = document.getElementById("cancelThresholdDisplay");
const incThreshold = document.getElementById("incThreshold");
const decThreshold = document.getElementById("decThreshold");
const exportDataBtn = document.getElementById("exportDataBtn");
const importDataBtn = document.getElementById("importDataBtn");
const importFile = document.getElementById("importFile");
const resetDataBtn = document.getElementById("resetDataBtn");

let isAuthed = false;

async function init(){
  await ensureInit();
  updateCancelThresholdUI();
  bindEvents();
}
init();

function bindEvents(){
  loginBtn.addEventListener("click", onLogin);
  logoutBtn.addEventListener("click", onLogout);

  refreshOrders.addEventListener("click", renderOrders);
  orderSearch.addEventListener("input", debounce(renderOrders, 200));
  statusFilter.addEventListener("change", renderOrders);

  verifyCodeBtn.addEventListener("click", onVerifyCode);

  checkStudentBtn.addEventListener("click", onCheckStudent);
  blockStudentBtn.addEventListener("click", ()=> onBlockToggle(true));
  unblockStudentBtn.addEventListener("click", ()=> onBlockToggle(false));

  addMenuItemBtn.addEventListener("click", ()=> openMenuModal());
  menuCancelBtn.addEventListener("click", ()=> menuModal.close());
  menuForm.addEventListener("submit", onMenuSave);

  changePasswordBtn.addEventListener("click", onChangePassword);
  incThreshold.addEventListener("click", async ()=> { 
    await setCancelThreshold((await getCancelThreshold())+1); 
    updateCancelThresholdUI(); 
  });
  decThreshold.addEventListener("click", async ()=> { 
    await setCancelThreshold((await getCancelThreshold())-1); 
    updateCancelThresholdUI(); 
  });

  exportDataBtn.addEventListener("click", onExport);
  importDataBtn.addEventListener("click", ()=> importFile.click());
  importFile.addEventListener("change", onImportFile);
  resetDataBtn.addEventListener("click", onReset);

  window.addEventListener("cms:storage-updated", async ()=>{
    if (isAuthed) {
      await renderOrders();
      await renderMenu();
    }
    updateCancelThresholdUI();
  });
}

function updateCancelThresholdUI(){
  getCancelThreshold().then(threshold => {
    cancelThresholdDisplay.textContent = threshold;
  });
}

async function onLogin(){
  const pass = adminPasswordInput.value || "";
  const ok = await checkAdminPassword(pass);
  if (!ok) {
    loginError.hidden = false;
    return;
  }
  isAuthed = true;
  loginError.hidden = true;
  loginView.hidden = true;
  adminApp.hidden = false;
  await renderOrders();
  await renderMenu();
}
function onLogout(){
  isAuthed = false;
  adminPasswordInput.value = "";
  loginView.hidden = false;
  adminApp.hidden = true;
}

async function renderOrders(){
  const q = (orderSearch.value || "").trim().toUpperCase();
  const status = (statusFilter.value || "").trim().toUpperCase();
  const orders = (await listOrders())
    .filter(o => (!status || o.status === status))
    .filter(o => {
      if (!q) return true;
      return o.pid.includes(q) || (o.paymentCode||"").toUpperCase().includes(q) || o.id.toUpperCase().includes(q);
    });

  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr>
        <th>Order</th>
        <th>PID</th>
        <th>Items</th>
        <th>Total</th>
        <th>Code</th>
        <th>Status</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      ${orders.map(o => `
        <tr>
          <td>#${o.id.slice(0,8)}<br><span class="small muted">${new Date(o.createdAt).toLocaleString()}</span></td>
          <td>${o.pid}</td>
          <td>${o.items.map(it => `${it.qty}× ${it.name}`).join(", ")}</td>
          <td>₹ ${money(o.total)}</td>
          <td>${o.paymentCode ? `<code>${o.paymentCode}</code>` : "-"}</td>
          <td><span class="status ${o.status}">${o.status.replace("_"," ")}</span></td>
          <td>
            ${o.status === "PAID_UNVERIFIED" ? `<button class="btn small" data-verify="${o.paymentCode}">Verify</button>` : ``}
            ${o.status === "VERIFIED" ? `<button class="btn small" data-fulfill="${o.id}">Fulfill</button>` : ``}
            ${o.status !== "CANCELLED" && o.status !== "FULFILLED" ? `<button class="btn ghost small" data-cancel="${o.id}">Cancel</button>` : ``}
            <button class="btn ghost small" data-delete="${o.id}">Delete</button>
          </td>
        </tr>
      `).join("")}
    </tbody>
  `;
  ordersTable.innerHTML = "";
  ordersTable.appendChild(table);

  ordersTable.querySelectorAll("[data-verify]").forEach(btn=>{
    btn.addEventListener("click", async ()=> {
      const code = btn.getAttribute("data-verify");
      const updated = await verifyPaymentCode(code);
      verifyResult.textContent = updated ? `Verified code for order #${updated.id.slice(0,8)}` : "Code not found";
      verifyResult.className = updated ? "success small" : "error small";
      await renderOrders();
    });
  });
  ordersTable.querySelectorAll("[data-fulfill]").forEach(btn=>{
    btn.addEventListener("click", async ()=> { 
      await fulfillOrder(btn.getAttribute("data-fulfill")); 
      await renderOrders(); 
    });
  });
  ordersTable.querySelectorAll("[data-cancel]").forEach(btn=>{
    btn.addEventListener("click", async ()=> { 
      await cancelOrder(btn.getAttribute("data-cancel"), "admin"); 
      await renderOrders(); 
    });
  });
  ordersTable.querySelectorAll("[data-delete]").forEach(btn=>{
    btn.addEventListener("click", async ()=> {
      const id = btn.getAttribute("data-delete");
      if (confirm("Delete this order permanently?")) { 
        await deleteOrder(id); 
        await renderOrders(); 
      }
    });
  });
}

async function renderMenu(){
  const items = await listMenu();
  const table = document.createElement("table");
  table.innerHTML = `
    <thead><tr><th>Item</th><th>Price</th><th>Available</th><th>Actions</th></tr></thead>
    <tbody>
      ${items.map(it => `
        <tr>
          <td><strong>${it.name}</strong><br><span class="small muted">${it.imageUrl ? "Has image" : "No image"}</span></td>
          <td>₹ ${money(it.price)}</td>
          <td>${it.available ? "Yes" : "No"}</td>
          <td>
            <button class="btn small" data-edit="${it.id}">Edit</button>
            <button class="btn ghost small" data-toggle="${it.id}">${it.available ? "Mark Unavailable" : "Mark Available"}</button>
            <button class="btn ghost small" data-delete="${it.id}">Delete</button>
          </td>
        </tr>
      `).join("")}
    </tbody>
  `;
  menuTable.innerHTML = "";
  menuTable.appendChild(table);

  menuTable.querySelectorAll("[data-edit]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.getAttribute("data-edit");
      const item = (await listMenu()).find(x => x.id === id);
      openMenuModal(item);
    });
  });
  menuTable.querySelectorAll("[data-toggle]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.getAttribute("data-toggle");
      const item = (await listMenu()).find(x => x.id === id);
      await updateMenuAvailability(id, !item.available);
      await renderMenu();
    });
  });
  menuTable.querySelectorAll("[data-delete]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.getAttribute("data-delete");
      if (confirm("Delete this menu item?")) {
        await deleteMenuItem(id);
        await renderMenu();
      }
    });
  });
}

async function onVerifyCode(){
  const code = (verifyCodeInput.value || "").trim();
  if (!code) return;
  const updated = await verifyPaymentCode(code);
  verifyResult.textContent = updated ? `Verified code for order #${updated.id.slice(0,8)} (PID ${updated.pid})` : "Code not found or already verified.";
  verifyResult.className = updated ? "success small" : "error small";
  await renderOrders();
}

async function onCheckStudent(){
  const pid = (studentPidInput.value || "").trim().toUpperCase();
  if (!pid) return;
  const s = await getStudent(pid);
  if (!s) {
    studentStatus.textContent = `No record yet. PID ${pid} not found.`;
    studentStatus.className = "muted small";
    blockStudentBtn.disabled = false; // can proactively block
    unblockStudentBtn.disabled = true;
    return;
  }
  const cancels = s.cancellations.length;
  studentStatus.innerHTML = `PID ${pid}: ${s.blocked ? "Blocked" : "Active"}${s.blockReason ? ` — ${s.blockReason}` : ""}. Total cancellations: ${cancels}`;
  blockStudentBtn.disabled = s.blocked;
  unblockStudentBtn.disabled = !s.blocked;
}

async function onBlockToggle(block){
  const pid = (studentPidInput.value || "").trim().toUpperCase();
  if (!pid) return;
  const updated = await setStudentBlocked(pid, block, block ? "Blocked by admin" : "");
  studentStatus.textContent = `PID ${pid}: ${updated.blocked ? "Blocked" : "Active"}.`;
  blockStudentBtn.disabled = updated.blocked;
  unblockStudentBtn.disabled = !updated.blocked;
}

function openMenuModal(item=null){
  if (item) {
    menuModalTitle.textContent = "Edit Menu Item";
    menuItemId.value = item.id;
    menuName.value = item.name;
    menuPrice.value = item.price;
    menuImage.value = item.imageUrl || "";
    menuAvailable.checked = !!item.available;
  } else {
    menuModalTitle.textContent = "Add Menu Item";
    menuItemId.value = "";
    menuName.value = "";
    menuPrice.value = 0;
    menuImage.value = "";
    menuAvailable.checked = true;
  }
  menuModal.showModal();
}

async function onMenuSave(e){
  e.preventDefault();
  const id = menuItemId.value || undefined;
  const name = menuName.value.trim();
  const price = Math.max(0, parseInt(menuPrice.value || "0", 10));
  const imageUrl = menuImage.value.trim();
  const available = menuAvailable.checked;
  if (!name) return;
  await upsertMenuItem({ id, name, price, imageUrl, available });
  menuModal.close();
  await renderMenu();
}

async function onChangePassword(){
  const np = newPassword.value || "";
  if (np.length < 6) {
    alert("Use at least 6 characters for the password.");
    return;
  }
  await setAdminPassword(np);
  newPassword.value = "";
  alert("Password updated.");
}

function onExport(){
  exportData().then(data => {
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `canteen-data-${new Date().toISOString().replace(/[:.]/g,"-")}.json`;
    a.click();
  });
}

function onImportFile(e){
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      await importDataFromJSON(reader.result);
      alert("Data imported.");
    } catch (err) {
      alert("Failed to import: " + err.message);
    }
  };
  reader.readAsText(file);
}

async function onReset(){
  if (!confirm("This will erase all data and reset to defaults. Continue?")) return;
  await factoryReset();
  alert("Reset complete. Reloading...");
  location.reload();
}
