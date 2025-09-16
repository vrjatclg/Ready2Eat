// storage.firestore.js - Firestore-backed data layer
import { db } from "./firebase-init.js";
import { 
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, addDoc 
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import { uuid, nowISO, sha256, hoursAgo } from "./utils.js";

// Default data initialization
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
  ]
};

// Initialization
export async function ensureInit() {
  try {
    // Check if settings exist
    const settingsDoc = await getDoc(doc(db, "settings", "main"));
    if (!settingsDoc.exists()) {
      // Initialize with defaults
      const defaultAdminHash = await sha256("admin123");
      await setDoc(doc(db, "settings", "main"), {
        adminPasswordHash: defaultAdminHash,
        cancelThreshold24h: 3
      });
      
      // Initialize default menu items
      for (const item of DEFAULTS.menu) {
        await setDoc(doc(db, "menu", item.id), item);
      }
    }
    return true;
  } catch (error) {
    console.error("Firebase initialization error:", error);
    throw new Error("Failed to initialize Firestore");
  }
}

// Settings
export async function getSettings() {
  const settingsDoc = await getDoc(doc(db, "settings", "main"));
  return settingsDoc.exists() ? settingsDoc.data() : DEFAULTS.settings;
}

export async function setAdminPassword(newPassword) {
  const hash = await sha256(newPassword);
  await updateDoc(doc(db, "settings", "main"), { adminPasswordHash: hash });
}

export async function getCancelThreshold() {
  const settings = await getSettings();
  return settings.cancelThreshold24h ?? 3;
}

export async function setCancelThreshold(n) {
  const threshold = Math.max(1, Math.min(10, Number(n) || 3));
  await updateDoc(doc(db, "settings", "main"), { cancelThreshold24h: threshold });
}

// Auth
export async function checkAdminPassword(pass) {
  const hash = await sha256(pass);
  const settings = await getSettings();
  return hash === settings.adminPasswordHash;
}

// Menu
export async function listMenu() {
  const menuSnapshot = await getDocs(collection(db, "menu"));
  return menuSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getMenuItem(id) {
  const menuDoc = await getDoc(doc(db, "menu", id));
  return menuDoc.exists() ? { id: menuDoc.id, ...menuDoc.data() } : null;
}

export async function upsertMenuItem(item) {
  const id = item.id || uuid();
  const now = nowISO();
  const docRef = doc(db, "menu", id);
  
  if (item.id) {
    // Update existing
    const existing = await getDoc(docRef);
    if (existing.exists()) {
      await updateDoc(docRef, { ...item, updatedAt: now });
    } else {
      await setDoc(docRef, { ...item, id, createdAt: now, updatedAt: now });
    }
  } else {
    // Create new
    await setDoc(docRef, { ...item, id, createdAt: now, updatedAt: now });
  }
}

export async function updateMenuAvailability(id, available) {
  await updateDoc(doc(db, "menu", id), { 
    available: !!available, 
    updatedAt: nowISO() 
  });
}

export async function deleteMenuItem(id) {
  await deleteDoc(doc(db, "menu", id));
}

// Students
export async function getStudent(pid) {
  const key = String(pid || "").trim().toUpperCase();
  const studentDoc = await getDoc(doc(db, "students", key));
  if (!studentDoc.exists()) return null;
  return { pid: key, ...studentDoc.data() };
}

export async function ensureStudent(pid) {
  const key = String(pid || "").trim().toUpperCase();
  const studentDoc = await getDoc(doc(db, "students", key));
  
  if (!studentDoc.exists()) {
    const newStudent = {
      blocked: false,
      cancellations: [],
      createdAt: nowISO(),
      updatedAt: nowISO(),
      blockReason: ""
    };
    await setDoc(doc(db, "students", key), newStudent);
    return { pid: key, ...newStudent };
  }
  
  return { pid: key, ...studentDoc.data() };
}

export async function setStudentBlocked(pid, blocked, reason = "") {
  const key = String(pid || "").trim().toUpperCase();
  const now = nowISO();
  
  await ensureStudent(key); // Ensure student exists
  
  await updateDoc(doc(db, "students", key), {
    blocked: !!blocked,
    blockReason: blocked ? (reason || "Blocked by admin") : "",
    updatedAt: now
  });
  
  return await getStudent(key);
}

export async function recordCancellation(pid, timestamp) {
  const key = String(pid || "").trim().toUpperCase();
  const ts = timestamp || nowISO();
  
  await ensureStudent(key); // Ensure student exists
  
  const studentDoc = await getDoc(doc(db, "students", key));
  const student = studentDoc.data();
  
  await updateDoc(doc(db, "students", key), {
    cancellations: [...(student.cancellations || []), ts],
    updatedAt: nowISO()
  });
}

export async function getRecentCancellationCount(pid, hours = 24) {
  const key = String(pid || "").trim().toUpperCase();
  const student = await getStudent(key);
  if (!student) return 0;
  
  const since = hoursAgo(hours);
  return (student.cancellations || []).filter(ts => new Date(ts) > since).length;
}

// Orders
export async function listOrders() {
  const ordersSnapshot = await getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc")));
  return ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function listOrdersByPid(pid) {
  const key = String(pid || "").trim().toUpperCase();
  const ordersSnapshot = await getDocs(
    query(collection(db, "orders"), where("pid", "==", key), orderBy("createdAt", "desc"))
  );
  return ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getOrderById(id) {
  const orderDoc = await getDoc(doc(db, "orders", id));
  return orderDoc.exists() ? { id: orderDoc.id, ...orderDoc.data() } : null;
}

export async function getOrderByPaymentCode(code) {
  const c = String(code || "").trim().toUpperCase();
  const ordersSnapshot = await getDocs(
    query(collection(db, "orders"), where("paymentCode", "==", c))
  );
  if (ordersSnapshot.empty) return null;
  const doc = ordersSnapshot.docs[0];
  return { id: doc.id, ...doc.data() };
}

export async function createOrder({ pid, items, total }) {
  const id = uuid();
  const order = {
    pid: String(pid).trim().toUpperCase(),
    items: items.map(it => ({ itemId: it.itemId, name: it.name, qty: it.qty, price: it.price })),
    total,
    status: "PENDING_PAYMENT",
    paymentCode: "",
    createdAt: serverTimestamp(),
    updatedAt: nowISO(),
    verifiedAt: "",
    fulfilledAt: "",
    cancelledAt: ""
  };
  
  await setDoc(doc(db, "orders", id), order);
  return { id, ...order, createdAt: nowISO() }; // Return with local timestamp for immediate use
}

export async function setOrderPaymentCode(orderId, code) {
  await updateDoc(doc(db, "orders", orderId), {
    paymentCode: String(code).toUpperCase(),
    status: "PAID_UNVERIFIED",
    updatedAt: nowISO()
  });
}

export async function verifyPaymentCode(code) {
  const order = await getOrderByPaymentCode(code);
  if (!order) return null;
  
  await updateDoc(doc(db, "orders", order.id), {
    status: "VERIFIED",
    verifiedAt: nowISO(),
    updatedAt: nowISO()
  });
  
  return await getOrderById(order.id);
}

export async function fulfillOrder(orderId) {
  await updateDoc(doc(db, "orders", orderId), {
    status: "FULFILLED",
    fulfilledAt: nowISO(),
    updatedAt: nowISO()
  });
}

export async function cancelOrder(orderId, by = "student") {
  const order = await getOrderById(orderId);
  if (order && order.status !== "FULFILLED" && order.status !== "CANCELLED") {
    await updateDoc(doc(db, "orders", orderId), {
      status: "CANCELLED",
      cancelledAt: nowISO(),
      updatedAt: nowISO()
    });
  }
  return await getOrderById(orderId);
}

export async function deleteOrder(orderId) {
  await deleteDoc(doc(db, "orders", orderId));
}

// Cart operations
export async function getCart(pid) {
  const key = String(pid || "").trim().toUpperCase();
  const cartDoc = await getDoc(doc(db, "students", key, "cart", "items"));
  if (!cartDoc.exists()) return [];
  return cartDoc.data().items || [];
}

export async function setCart(pid, items) {
  const key = String(pid || "").trim().toUpperCase();
  await ensureStudent(key); // Ensure student exists
  
  await setDoc(doc(db, "students", key, "cart", "items"), {
    items: items,
    updatedAt: nowISO()
  });
}

export async function addToCart(pid, itemId, qty) {
  const cart = await getCart(pid);
  const existingIndex = cart.findIndex(item => item.itemId === itemId);
  
  if (existingIndex >= 0) {
    cart[existingIndex].qty += qty;
  } else {
    const menuItem = await getMenuItem(itemId);
    if (menuItem) {
      cart.push({
        itemId: itemId,
        name: menuItem.name,
        price: menuItem.price,
        qty: qty,
        imageUrl: menuItem.imageUrl || ""
      });
    }
  }
  
  await setCart(pid, cart);
  return cart;
}

export async function clearCart(pid) {
  await setCart(pid, []);
}

// Data export/import for admin functionality
export async function exportData() {
  const settings = await getSettings();
  const menu = await listMenu();
  const orders = await listOrders();
  
  // Get all students
  const studentsSnapshot = await getDocs(collection(db, "students"));
  const students = {};
  studentsSnapshot.docs.forEach(doc => {
    students[doc.id] = doc.data();
  });
  
  return JSON.stringify({ settings, menu, orders, students }, null, 2);
}

export async function importDataFromJSON(jsonStr) {
  const data = JSON.parse(jsonStr);
  if (!data || typeof data !== "object") throw new Error("Invalid data");
  
  // Import settings
  if (data.settings) {
    await setDoc(doc(db, "settings", "main"), data.settings);
  }
  
  // Import menu
  if (data.menu && Array.isArray(data.menu)) {
    for (const item of data.menu) {
      await setDoc(doc(db, "menu", item.id), item);
    }
  }
  
  // Import orders 
  if (data.orders && Array.isArray(data.orders)) {
    for (const order of data.orders) {
      await setDoc(doc(db, "orders", order.id), order);
    }
  }
  
  // Import students
  if (data.students && typeof data.students === "object") {
    for (const [pid, student] of Object.entries(data.students)) {
      await setDoc(doc(db, "students", pid), student);
    }
  }
}

export async function factoryReset() {
  // This is a destructive operation - clear all collections
  
  // Clear settings
  await setDoc(doc(db, "settings", "main"), {
    adminPasswordHash: await sha256("admin123"),
    cancelThreshold24h: 3
  });
  
  // Clear and recreate menu with defaults
  const menuSnapshot = await getDocs(collection(db, "menu"));
  for (const doc of menuSnapshot.docs) {
    await deleteDoc(doc.ref);
  }
  
  for (const item of DEFAULTS.menu) {
    await setDoc(doc(db, "menu", item.id), item);
  }
  
  // Clear orders
  const ordersSnapshot = await getDocs(collection(db, "orders"));
  for (const doc of ordersSnapshot.docs) {
    await deleteDoc(doc.ref);
  }
  
  // Clear students 
  const studentsSnapshot = await getDocs(collection(db, "students"));
  for (const doc of studentsSnapshot.docs) {
    await deleteDoc(doc.ref);
  }
  
  // Dispatch storage updated event
  window.dispatchEvent(new CustomEvent("cms:storage-updated"));
}