// storage.js - Firebase Firestore-backed data layer
import { uuid, nowISO, sha256, hoursAgo } from "./utils.js";

// Firebase configuration - use exactly as provided
const firebaseConfig = {
  apiKey: "AIzaSyDUYtoPn2MM6rAkcjk1il5baoRG6vegibA",
  authDomain: "ready2eat-ef71f.firebaseapp.com",
  projectId: "ready2eat-ef71f",
  storageBucket: "ready2eat-ef71f.firebasestorage.app",
  messagingSenderId: "374606696659",
  appId: "1:374606696659:web:3dbf508a2ae2f1a6044426",
  measurementId: "G-W8Q1L1DB8P"
};

// Initialize Firebase
let app, db, demoMode = false;
try {
  if (typeof firebase !== 'undefined') {
    app = firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    console.log("Firebase initialized successfully");
  } else {
    console.warn("Firebase not loaded - enabling demo mode");
    demoMode = true;
  }
} catch (error) {
  console.error("Firebase initialization failed, enabling demo mode:", error);
  demoMode = true;
}

// Demo mode - simulate Firestore with localStorage for testing
let demoData = {};
if (demoMode) {
  const DEMO_KEY = "firebase_demo_data";
  const loadDemoData = () => {
    const raw = localStorage.getItem(DEMO_KEY);
    return raw ? JSON.parse(raw) : {};
  };
  const saveDemoData = () => {
    localStorage.setItem(DEMO_KEY, JSON.stringify(demoData));
  };
  demoData = loadDemoData();
  
  // Demo Firestore simulation
  db = {
    collection: (name) => ({
      doc: (id) => ({
        get: async () => {
          const exists = demoData[name] && demoData[name][id];
          return {
            exists,
            id,
            data: () => exists ? demoData[name][id] : undefined
          };
        },
        set: async (data, options = {}) => {
          if (!demoData[name]) demoData[name] = {};
          if (options.merge) {
            demoData[name][id] = { ...demoData[name][id], ...data };
          } else {
            demoData[name][id] = data;
          }
          saveDemoData();
        },
        update: async (data) => {
          if (!demoData[name]) demoData[name] = {};
          demoData[name][id] = { ...demoData[name][id], ...data };
          saveDemoData();
        },
        delete: async () => {
          if (demoData[name] && demoData[name][id]) {
            delete demoData[name][id];
            saveDemoData();
          }
        }
      }),
      get: async () => {
        const docs = demoData[name] ? Object.entries(demoData[name]).map(([id, data]) => ({
          id,
          data: () => data
        })) : [];
        return { docs };
      },
      where: (field, op, value) => ({
        orderBy: (field, dir = 'asc') => ({
          get: async () => {
            let docs = demoData[name] ? Object.entries(demoData[name])
              .filter(([id, data]) => {
                if (op === '==') return data[field] === value;
                return true;
              })
              .map(([id, data]) => ({ id, data: () => data })) : [];
            
            if (field === 'createdAt') {
              docs.sort((a, b) => {
                const aDate = new Date(a.data().createdAt);
                const bDate = new Date(b.data().createdAt);
                return dir === 'desc' ? bDate - aDate : aDate - bDate;
              });
            }
            return { docs };
          }
        }),
        limit: (num) => ({
          get: async () => {
            let docs = demoData[name] ? Object.entries(demoData[name])
              .filter(([id, data]) => {
                if (op === '==') return data[field] === value;
                return true;
              })
              .map(([id, data]) => ({ id, data: () => data }))
              .slice(0, num) : [];
            return { docs, empty: docs.length === 0 };
          }
        }),
        get: async () => {
          let docs = demoData[name] ? Object.entries(demoData[name])
            .filter(([id, data]) => {
              if (op === '==') return data[field] === value;
              return true;
            })
            .map(([id, data]) => ({ id, data: () => data })) : [];
          return { docs, empty: docs.length === 0 };
        }
      }),
      orderBy: (field, dir = 'asc') => ({
        get: async () => {
          let docs = demoData[name] ? Object.entries(demoData[name])
            .map(([id, data]) => ({ id, data: () => data })) : [];
          
          if (field === 'createdAt') {
            docs.sort((a, b) => {
              const aDate = new Date(a.data().createdAt);
              const bDate = new Date(b.data().createdAt);
              return dir === 'desc' ? bDate - aDate : aDate - bDate;
            });
          }
          return { docs };
        }
      })
    }),
    batch: () => {
      const operations = [];
      return {
        set: (ref, data) => operations.push({ type: 'set', ref, data }),
        delete: (ref) => operations.push({ type: 'delete', ref }),
        commit: async () => {
          // Simulate batch operations
          for (const op of operations) {
            if (op.type === 'set') {
              await op.ref.set(op.data);
            } else if (op.type === 'delete') {
              await op.ref.delete();
            }
          }
        }
      };
    }
  };
}

// Default menu items for seeding
const DEFAULT_MENU_ITEMS = [
  { id: uuid(), name: "Samosa", price: 20, imageUrl: "", available: true, createdAt: nowISO(), updatedAt: nowISO() },
  { id: uuid(), name: "Tea", price: 12, imageUrl: "", available: true, createdAt: nowISO(), updatedAt: nowISO() },
  { id: uuid(), name: "Veg Puff", price: 25, imageUrl: "", available: true, createdAt: nowISO(), updatedAt: nowISO() },
  { id: uuid(), name: "Coffee", price: 18, imageUrl: "", available: true, createdAt: nowISO(), updatedAt: nowISO() },
];

// Helper to dispatch storage update events
function notifyStorageUpdate() {
  window.dispatchEvent(new CustomEvent("cms:storage-updated"));
}

// Initialize Firestore with default data if needed
export async function ensureInit() {
  if (!db) {
    console.warn("Firestore not available - this would normally initialize Firebase");
    return true;
  }
  
  const settingsRef = db.collection('settings').doc('main');
  const settingsDoc = await settingsRef.get();
  
  if (!settingsDoc.exists) {
    // First time setup - create settings and seed menu
    const batch = db.batch();
    
    // Create settings document
    const defaultSettings = {
      adminPasswordHash: await sha256("admin123"),
      cancelThreshold24h: 3,
      createdAt: nowISO(),
      updatedAt: nowISO()
    };
    batch.set(settingsRef, defaultSettings);
    
    // Seed default menu items
    DEFAULT_MENU_ITEMS.forEach(item => {
      const menuRef = db.collection('menu').doc(item.id);
      batch.set(menuRef, item);
    });
    
    await batch.commit();
  }
  
  return true;
}

// Settings functions
export async function getSettings() {
  const settingsDoc = await db.collection('settings').doc('main').get();
  if (!settingsDoc.exists) throw new Error("Storage not initialized");
  return settingsDoc.data();
}

export async function setAdminPassword(newPassword) {
  const hash = await sha256(newPassword);
  await db.collection('settings').doc('main').update({
    adminPasswordHash: hash,
    updatedAt: nowISO()
  });
  notifyStorageUpdate();
}

export async function getCancelThreshold() {
  const settings = await getSettings();
  return settings.cancelThreshold24h ?? 3;
}

export async function setCancelThreshold(n) {
  const threshold = Math.max(1, Math.min(10, Number(n)||3));
  await db.collection('settings').doc('main').update({
    cancelThreshold24h: threshold,
    updatedAt: nowISO()
  });
  notifyStorageUpdate();
}

// Auth functions
export async function checkAdminPassword(pass) {
  const hash = await sha256(pass);
  const settings = await getSettings();
  return hash === settings.adminPasswordHash;
}

// Menu functions
export async function listMenu() {
  const menuSnapshot = await db.collection('menu').get();
  return menuSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getMenuItem(id) {
  const menuDoc = await db.collection('menu').doc(id).get();
  if (!menuDoc.exists) return null;
  return { id: menuDoc.id, ...menuDoc.data() };
}

export async function upsertMenuItem(item) {
  const id = item.id || uuid();
  const menuRef = db.collection('menu').doc(id);
  
  if (item.id) {
    // Update existing item
    await menuRef.update({
      ...item,
      updatedAt: nowISO()
    });
  } else {
    // Create new item
    await menuRef.set({
      ...item,
      id,
      createdAt: nowISO(),
      updatedAt: nowISO()
    });
  }
  notifyStorageUpdate();
}

export async function updateMenuAvailability(id, available) {
  await db.collection('menu').doc(id).update({
    available: !!available,
    updatedAt: nowISO()
  });
  notifyStorageUpdate();
}

export async function deleteMenuItem(id) {
  await db.collection('menu').doc(id).delete();
  notifyStorageUpdate();
}

// Student functions
export async function getStudent(pid) {
  const key = String(pid || "").trim().toUpperCase();
  const studentDoc = await db.collection('students').doc(key).get();
  if (!studentDoc.exists) return null;
  return { pid: key, ...studentDoc.data() };
}

export async function ensureStudent(pid) {
  const key = String(pid || "").trim().toUpperCase();
  const studentRef = db.collection('students').doc(key);
  const studentDoc = await studentRef.get();
  
  if (!studentDoc.exists) {
    const studentData = {
      blocked: false,
      cancellations: [],
      createdAt: nowISO(),
      updatedAt: nowISO(),
      blockReason: ""
    };
    await studentRef.set(studentData);
    return { pid: key, ...studentData };
  }
  
  return { pid: key, ...studentDoc.data() };
}

export async function setStudentBlocked(pid, blocked, reason = "") {
  const key = String(pid || "").trim().toUpperCase();
  const studentRef = db.collection('students').doc(key);
  
  const updateData = {
    blocked: !!blocked,
    blockReason: blocked ? (reason || "Blocked by admin") : "",
    updatedAt: nowISO()
  };
  
  // Use set with merge to create if doesn't exist
  await studentRef.set({
    ...updateData,
    cancellations: [],
    createdAt: nowISO()
  }, { merge: true });
  
  notifyStorageUpdate();
  return await getStudent(key);
}

export async function recordCancellation(pid) {
  const key = String(pid || "").trim().toUpperCase();
  const studentRef = db.collection('students').doc(key);
  
  const studentDoc = await studentRef.get();
  const cancellations = studentDoc.exists ? (studentDoc.data().cancellations || []) : [];
  cancellations.push(nowISO());
  
  await studentRef.set({
    blocked: false,
    cancellations,
    createdAt: studentDoc.exists ? studentDoc.data().createdAt : nowISO(),
    updatedAt: nowISO(),
    blockReason: studentDoc.exists ? (studentDoc.data().blockReason || "") : ""
  }, { merge: true });
  
  notifyStorageUpdate();
}

export async function getRecentCancellationCount(pid, hours = 24) {
  const key = String(pid || "").trim().toUpperCase();
  const student = await getStudent(key);
  if (!student) return 0;
  
  const since = hoursAgo(hours);
  return student.cancellations.filter(ts => new Date(ts) > since).length;
}

// Order functions
export async function listOrders() {
  const ordersSnapshot = await db.collection('orders').orderBy('createdAt', 'desc').get();
  return ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function listOrdersByPid(pid) {
  const key = String(pid || "").trim().toUpperCase();
  const ordersSnapshot = await db.collection('orders')
    .where('pid', '==', key)
    .orderBy('createdAt', 'desc')
    .get();
  return ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getOrderById(id) {
  const orderDoc = await db.collection('orders').doc(id).get();
  if (!orderDoc.exists) return null;
  return { id: orderDoc.id, ...orderDoc.data() };
}

export async function getOrderByPaymentCode(code) {
  const c = String(code || "").trim().toUpperCase();
  const ordersSnapshot = await db.collection('orders')
    .where('paymentCode', '==', c)
    .limit(1)
    .get();
  
  if (ordersSnapshot.empty) return null;
  const doc = ordersSnapshot.docs[0];
  return { id: doc.id, ...doc.data() };
}

export async function createOrder({ pid, items, total }) {
  const id = uuid();
  const order = {
    id,
    pid: String(pid).trim().toUpperCase(),
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
  
  await db.collection('orders').doc(id).set(order);
  notifyStorageUpdate();
  return order;
}

export async function setOrderPaymentCode(orderId, code) {
  await db.collection('orders').doc(orderId).update({
    paymentCode: String(code).toUpperCase(),
    status: "PAID_UNVERIFIED",
    updatedAt: nowISO()
  });
  notifyStorageUpdate();
}

export async function verifyPaymentCode(code) {
  const order = await getOrderByPaymentCode(code);
  if (!order) return null;
  
  await db.collection('orders').doc(order.id).update({
    status: "VERIFIED",
    verifiedAt: nowISO(),
    updatedAt: nowISO()
  });
  
  notifyStorageUpdate();
  return await getOrderById(order.id);
}

export async function fulfillOrder(orderId) {
  await db.collection('orders').doc(orderId).update({
    status: "FULFILLED",
    fulfilledAt: nowISO(),
    updatedAt: nowISO()
  });
  notifyStorageUpdate();
}

export async function cancelOrder(orderId, by = "student") {
  const order = await getOrderById(orderId);
  if (!order || order.status === "FULFILLED" || order.status === "CANCELLED") {
    return order;
  }
  
  await db.collection('orders').doc(orderId).update({
    status: "CANCELLED",
    cancelledAt: nowISO(),
    updatedAt: nowISO()
  });
  
  notifyStorageUpdate();
  return await getOrderById(orderId);
}

export async function deleteOrder(orderId) {
  await db.collection('orders').doc(orderId).delete();
  notifyStorageUpdate();
}

// Data lifecycle functions
export async function exportData() {
  const [settingsDoc, menuSnapshot, ordersSnapshot, studentsSnapshot] = await Promise.all([
    db.collection('settings').doc('main').get(),
    db.collection('menu').get(),
    db.collection('orders').get(),
    db.collection('students').get()
  ]);
  
  const data = {
    settings: settingsDoc.exists ? settingsDoc.data() : {
      adminPasswordHash: await sha256("admin123"),
      cancelThreshold24h: 3
    },
    menu: menuSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    orders: ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    students: {}
  };
  
  // Convert students collection to object format matching original localStorage structure
  studentsSnapshot.docs.forEach(doc => {
    data.students[doc.id] = doc.data();
  });
  
  return JSON.stringify(data, null, 2);
}

export async function importDataFromJSON(json) {
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== "object") throw new Error("Invalid data");
  
  const batch = db.batch();
  
  // Import settings
  if (parsed.settings) {
    const settingsRef = db.collection('settings').doc('main');
    batch.set(settingsRef, {
      ...parsed.settings,
      updatedAt: nowISO()
    });
  }
  
  // Clear and import menu
  const menuSnapshot = await db.collection('menu').get();
  menuSnapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  if (parsed.menu && Array.isArray(parsed.menu)) {
    parsed.menu.forEach(item => {
      const menuRef = db.collection('menu').doc(item.id || uuid());
      batch.set(menuRef, {
        ...item,
        updatedAt: nowISO()
      });
    });
  }
  
  // Clear and import orders
  const ordersSnapshot = await db.collection('orders').get();
  ordersSnapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  if (parsed.orders && Array.isArray(parsed.orders)) {
    parsed.orders.forEach(order => {
      const orderRef = db.collection('orders').doc(order.id || uuid());
      batch.set(orderRef, {
        ...order,
        updatedAt: nowISO()
      });
    });
  }
  
  // Clear and import students
  const studentsSnapshot = await db.collection('students').get();
  studentsSnapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  if (parsed.students && typeof parsed.students === 'object') {
    Object.entries(parsed.students).forEach(([pid, studentData]) => {
      const studentRef = db.collection('students').doc(pid);
      batch.set(studentRef, {
        ...studentData,
        updatedAt: nowISO()
      });
    });
  }
  
  await batch.commit();
  notifyStorageUpdate();
}

export async function factoryReset() {
  const batch = db.batch();
  
  // Delete all documents from all collections
  const [settingsSnapshot, menuSnapshot, ordersSnapshot, studentsSnapshot] = await Promise.all([
    db.collection('settings').get(),
    db.collection('menu').get(),
    db.collection('orders').get(),
    db.collection('students').get()
  ]);
  
  [...settingsSnapshot.docs, ...menuSnapshot.docs, ...ordersSnapshot.docs, ...studentsSnapshot.docs]
    .forEach(doc => {
      batch.delete(doc.ref);
    });
  
  await batch.commit();
  notifyStorageUpdate();
}

/*
  Production Security Note:
  This app uses the provided Firebase configuration for development/testing.
  In production, ensure Firestore security rules are properly configured to:
  - Restrict read/write access to authenticated users only
  - Validate data structure and user permissions
  - Prevent unauthorized access to sensitive data like admin passwords
  
  Example security rules for production:
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /{document=**} {
        allow read, write: if request.auth != null;
      }
    }
  }
*/
