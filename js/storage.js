// storage.js - simple localStorage-backed data layer
import { uuid, nowISO, sha256, hoursAgo } from "./utils.js";

const NAMESPACE = "cms_v1";

const DEFAULTS = {
  settings: {
    adminPasswordHash: "", // set on init
    cancelThreshold24h: 3
  },
  menu: [
    { id: uuid(), name: "Samosa", price: 20, imageUrl: "", available: true, createdAt: nowISO(), updatedAt: nowISO() },
    { id: uuid(), name: "Tea", price: 12, imageUrl: "", available: true, createdAt: nowISO(), updatedAt: nowISO() },
    { id: uuid(), name: "Veg Puff", price: 25, imageUrl: "", available: true, createdAt: nowISO(), updatedAt: nowISO() },
    { id: uuid(), name: "Coffee", price: 18, imageUrl: "", available: true, createdAt: nowISO(), updatedAt: nowISO() },
  ],
  orders: [],
  students: {}
};

function readAll() {
  const raw = localStorage.getItem(NAMESPACE);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function writeAll(obj) {
  localStorage.setItem(NAMESPACE, JSON.stringify(obj));
  window.dispatchEvent(new CustomEvent("cms:storage-updated"));
}

export async function ensureInit() {
  let data = readAll();
  if (!data) {
    data = structuredClone(DEFAULTS);
    // set default admin password: admin123
    data.settings.adminPasswordHash = await sha256("admin123");
    writeAll(data);
  }
  return true;
}

export function exportData() {
  const data = readAll() || structuredClone(DEFAULTS);
  return JSON.stringify(data, null, 2);
}

export function importDataFromJSON(json) {
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== "object") throw new Error("Invalid data");
  writeAll(parsed);
}

export function factoryReset() {
  localStorage.removeItem(NAMESPACE);
  window.dispatchEvent(new CustomEvent("cms:storage-updated"));
}

function getData() {
  const d = readAll();
  if (!d) throw new Error("Storage not initialized");
  return d;
}

function saveData(mutator) {
  const d = getData();
  mutator(d);
  writeAll(d);
}

// Settings
export function getSettings() { return getData().settings; }
export async function setAdminPassword(newPassword) {
  const hash = await sha256(newPassword);
  saveData(d => { d.settings.adminPasswordHash = hash; });
}
export function getCancelThreshold() { return getData().settings.cancelThreshold24h ?? 3; }
export function setCancelThreshold(n) { saveData(d => { d.settings.cancelThreshold24h = Math.max(1, Math.min(10, Number(n)||3)); }); }

// Auth
export async function checkAdminPassword(pass) {
  const hash = await sha256(pass);
  return hash === getData().settings.adminPasswordHash;
}

// Menu
export function listMenu() { return getData().menu; }
export function getMenuItem(id) { return getData().menu.find(m => m.id === id); }
export function upsertMenuItem(item) {
  saveData(d => {
    const i = d.menu.findIndex(m => m.id === item.id);
    if (i >= 0) {
      d.menu[i] = { ...d.menu[i], ...item, updatedAt: nowISO() };
    } else {
      d.menu.push({ ...item, id: uuid(), createdAt: nowISO(), updatedAt: nowISO() });
    }
  });
}
export function updateMenuAvailability(id, available) {
  saveData(d => {
    const it = d.menu.find(m => m.id === id);
    if (it) { it.available = !!available; it.updatedAt = nowISO(); }
  });
}
export function deleteMenuItem(id) {
  saveData(d => { d.menu = d.menu.filter(m => m.id !== id); });
}

// Students
export function getStudent(pid) {
  const key = String(pid || "").trim().toUpperCase();
  const s = getData().students[key];
  if (!s) return null;
  return { pid: key, ...s };
}
export function ensureStudent(pid) {
  const key = String(pid || "").trim().toUpperCase();
  saveData(d => {
    if (!d.students[key]) {
      d.students[key] = { blocked: false, cancellations: [], createdAt: nowISO(), updatedAt: nowISO(), blockReason: "" };
    }
  });
  return getStudent(key);
}
export function setStudentBlocked(pid, blocked, reason = "") {
  const key = String(pid || "").trim().toUpperCase();
  saveData(d => {
    if (!d.students[key]) d.students[key] = { blocked: false, cancellations: [], createdAt: nowISO(), updatedAt: nowISO(), blockReason: "" };
    d.students[key].blocked = !!blocked;
    d.students[key].blockReason = blocked ? (reason || "Blocked by admin") : "";
    d.students[key].updatedAt = nowISO();
  });
  return getStudent(key);
}
export function recordCancellation(pid) {
  const key = String(pid || "").trim().toUpperCase();
  saveData(d => {
    if (!d.students[key]) d.students[key] = { blocked: false, cancellations: [], createdAt: nowISO(), updatedAt: nowISO(), blockReason: "" };
    d.students[key].cancellations.push(nowISO());
    d.students[key].updatedAt = nowISO();
  });
}
export function getRecentCancellationCount(pid, hours = 24) {
  const key = String(pid || "").trim().toUpperCase();
  const s = getData().students[key];
  if (!s) return 0;
  const since = hoursAgo(hours);
  return s.cancellations.filter(ts => new Date(ts) > since).length;
}

// Orders
export function listOrders() { return getData().orders; }
export function listOrdersByPid(pid) {
  const key = String(pid || "").trim().toUpperCase();
  return getData().orders.filter(o => o.pid === key).sort((a,b)=> new Date(b.createdAt)-new Date(a.createdAt));
}
export function getOrderById(id) { return getData().orders.find(o => o.id === id); }
export function getOrderByPaymentCode(code) {
  const c = String(code || "").trim().toUpperCase();
  return getData().orders.find(o => (o.paymentCode || "").toUpperCase() === c);
}
export function createOrder({ pid, items, total }) {
  const id = uuid();
  const order = {
    id, pid: String(pid).trim().toUpperCase(),
    items: items.map(it => ({ itemId: it.itemId, name: it.name, qty: it.qty, price: it.price })),
    total,
    status: "PENDING_PAYMENT",
    paymentCode: "",
    createdAt: nowISO(),
    updatedAt: nowISO(),
    verifiedAt: "",
    fulfilledAt: "",
    cancelledAt: ""
  };
  saveData(d => { d.orders.unshift(order); });
  return order;
}
export function setOrderPaymentCode(orderId, code) {
  saveData(d => {
    const o = d.orders.find(o => o.id === orderId);
    if (o) { o.paymentCode = String(code).toUpperCase(); o.status = "PAID_UNVERIFIED"; o.updatedAt = nowISO(); }
  });
}
export function verifyPaymentCode(code) {
  const o = getOrderByPaymentCode(code);
  if (!o) return null;
  saveData(d => {
    const ref = d.orders.find(x => x.id === o.id);
    if (ref) { ref.status = "VERIFIED"; ref.verifiedAt = nowISO(); ref.updatedAt = nowISO(); }
  });
  return getOrderById(o.id);
}
export function fulfillOrder(orderId) {
  saveData(d => {
    const o = d.orders.find(o => o.id === orderId);
    if (o) { o.status = "FULFILLED"; o.fulfilledAt = nowISO(); o.updatedAt = nowISO(); }
  });
}
export function cancelOrder(orderId, by = "student") {
  saveData(d => {
    const o = d.orders.find(o => o.id === orderId);
    if (o && o.status !== "FULFILLED" && o.status !== "CANCELLED") {
      o.status = "CANCELLED";
      o.cancelledAt = nowISO();
      o.updatedAt = nowISO();
    }
  });
  return getOrderById(orderId);
}
export function deleteOrder(orderId) {
  saveData(d => { d.orders = d.orders.filter(o => o.id !== orderId); });
}
