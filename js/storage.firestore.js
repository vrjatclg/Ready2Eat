// storage.firestore.js - Firestore-backed data layer 
import { 
  doc, getDoc, setDoc, updateDoc, addDoc, getDocs, deleteDoc, 
  query, where, collection, orderBy, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { uuid, nowISO, sha256, hoursAgo } from "./utils.js";

// Default menu items for first-time initialization
const DEFAULT_MENU_ITEMS = [
  { name: "Samosa", price: 20, imageUrl: "", available: true },
  { name: "Tea", price: 12, imageUrl: "", available: true },
  { name: "Veg Puff", price: 25, imageUrl: "", available: true },
  { name: "Coffee", price: 18, imageUrl: "", available: true },
];

// Initialize Firestore with default data if needed
export async function ensureInit() {
  try {
    // Check if settings exist, create if not
    const settingsRef = doc(db, 'settings', 'main');
    const settingsSnap = await getDoc(settingsRef);
    
    if (!settingsSnap.exists()) {
      // Create default settings with admin password hash
      const adminPasswordHash = await sha256("admin123");
      await setDoc(settingsRef, {
        adminPasswordHash,
        cancelThreshold24h: 3,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    // Check if menu exists, seed with defaults if empty
    const menuRef = collection(db, 'menu');
    const menuSnap = await getDocs(menuRef);
    
    if (menuSnap.empty) {
      // Create default menu items
      for (const item of DEFAULT_MENU_ITEMS) {
        await addDoc(menuRef, {
          ...item,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    }

    return true;
  } catch (error) {
    console.error("Error initializing Firestore:", error);
    throw error;
  }
}

// Settings
export async function getSettings() {
  const settingsRef = doc(db, 'settings', 'main');
  const settingsSnap = await getDoc(settingsRef);
  
  if (!settingsSnap.exists()) {
    throw new Error("Settings not initialized");
  }
  
  return settingsSnap.data();
}

export async function setAdminPassword(newPassword) {
  const hash = await sha256(newPassword);
  const settingsRef = doc(db, 'settings', 'main');
  await updateDoc(settingsRef, {
    adminPasswordHash: hash,
    updatedAt: serverTimestamp()
  });
}

export async function getCancelThreshold() {
  const settings = await getSettings();
  return settings.cancelThreshold24h ?? 3;
}

export async function setCancelThreshold(n) {
  const threshold = Math.max(1, Math.min(10, Number(n) || 3));
  const settingsRef = doc(db, 'settings', 'main');
  await updateDoc(settingsRef, {
    cancelThreshold24h: threshold,
    updatedAt: serverTimestamp()
  });
}

// Auth
export async function checkAdminPassword(pass) {
  const hash = await sha256(pass);
  const settings = await getSettings();
  return hash === settings.adminPasswordHash;
}

// Menu
export async function listMenu() {
  const menuRef = collection(db, 'menu');
  const menuSnap = await getDocs(menuRef);
  
  return menuSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || nowISO(),
    updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || nowISO()
  }));
}

export async function getMenuItem(id) {
  const menuItemRef = doc(db, 'menu', id);
  const menuItemSnap = await getDoc(menuItemRef);
  
  if (!menuItemSnap.exists()) {
    return null;
  }
  
  return {
    id: menuItemSnap.id,
    ...menuItemSnap.data(),
    createdAt: menuItemSnap.data().createdAt?.toDate?.()?.toISOString() || nowISO(),
    updatedAt: menuItemSnap.data().updatedAt?.toDate?.()?.toISOString() || nowISO()
  };
}

export async function upsertMenuItem(item) {
  if (item.id) {
    // Update existing item
    const menuItemRef = doc(db, 'menu', item.id);
    const updateData = { ...item };
    delete updateData.id;
    updateData.updatedAt = serverTimestamp();
    await updateDoc(menuItemRef, updateData);
  } else {
    // Create new item
    const menuRef = collection(db, 'menu');
    await addDoc(menuRef, {
      ...item,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
}

export async function updateMenuAvailability(id, available) {
  const menuItemRef = doc(db, 'menu', id);
  await updateDoc(menuItemRef, {
    available: !!available,
    updatedAt: serverTimestamp()
  });
}

export async function deleteMenuItem(id) {
  const menuItemRef = doc(db, 'menu', id);
  await deleteDoc(menuItemRef);
}

// Students
export async function getStudent(pid) {
  const key = String(pid || "").trim().toUpperCase();
  const studentRef = doc(db, 'students', key);
  const studentSnap = await getDoc(studentRef);
  
  if (!studentSnap.exists()) {
    return null;
  }
  
  const data = studentSnap.data();
  return {
    pid: key,
    ...data,
    cancels: data.cancels || [], // Ensure cancels array exists
    createdAt: data.createdAt?.toDate?.()?.toISOString() || nowISO(),
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() || nowISO()
  };
}

export async function ensureStudent(pid) {
  const key = String(pid || "").trim().toUpperCase();
  const studentRef = doc(db, 'students', key);
  const studentSnap = await getDoc(studentRef);
  
  if (!studentSnap.exists()) {
    await setDoc(studentRef, {
      blocked: false,
      cancels: [],
      blockReason: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
  
  return await getStudent(key);
}

export async function setStudentBlocked(pid, blocked, reason = "") {
  const key = String(pid || "").trim().toUpperCase();
  const studentRef = doc(db, 'students', key);
  const studentSnap = await getDoc(studentRef);
  
  if (!studentSnap.exists()) {
    await setDoc(studentRef, {
      blocked: false,
      cancels: [],
      blockReason: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
  
  await updateDoc(studentRef, {
    blocked: !!blocked,
    blockReason: blocked ? (reason || "Blocked by admin") : "",
    updatedAt: serverTimestamp()
  });
  
  return await getStudent(key);
}

export async function recordCancellation(pid) {
  const key = String(pid || "").trim().toUpperCase();
  const student = await ensureStudent(key);
  const cancels = [...(student.cancels || []), nowISO()];
  
  const studentRef = doc(db, 'students', key);
  await updateDoc(studentRef, {
    cancels,
    updatedAt: serverTimestamp()
  });
}

export async function getRecentCancellationCount(pid, hours = 24) {
  const student = await getStudent(pid);
  if (!student || !student.cancels) return 0;
  
  const since = hoursAgo(hours);
  return student.cancels.filter(ts => new Date(ts) > since).length;
}

// Orders
export async function listOrders() {
  const ordersRef = collection(db, 'orders');
  const q = query(ordersRef, orderBy('createdAt', 'desc'));
  const ordersSnap = await getDocs(q);
  
  return ordersSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || nowISO(),
    updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || nowISO(),
    verifiedAt: doc.data().verifiedAt?.toDate?.()?.toISOString() || "",
    fulfilledAt: doc.data().fulfilledAt?.toDate?.()?.toISOString() || "",
    cancelledAt: doc.data().cancelledAt?.toDate?.()?.toISOString() || ""
  }));
}

export async function listOrdersByPid(pid) {
  const key = String(pid || "").trim().toUpperCase();
  const ordersRef = collection(db, 'orders');
  const q = query(ordersRef, where('pid', '==', key), orderBy('createdAt', 'desc'));
  const ordersSnap = await getDocs(q);
  
  return ordersSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || nowISO(),
    updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || nowISO(),
    verifiedAt: doc.data().verifiedAt?.toDate?.()?.toISOString() || "",
    fulfilledAt: doc.data().fulfilledAt?.toDate?.()?.toISOString() || "",
    cancelledAt: doc.data().cancelledAt?.toDate?.()?.toISOString() || ""
  }));
}

export async function getOrderById(id) {
  const orderRef = doc(db, 'orders', id);
  const orderSnap = await getDoc(orderRef);
  
  if (!orderSnap.exists()) {
    return null;
  }
  
  return {
    id: orderSnap.id,
    ...orderSnap.data(),
    createdAt: orderSnap.data().createdAt?.toDate?.()?.toISOString() || nowISO(),
    updatedAt: orderSnap.data().updatedAt?.toDate?.()?.toISOString() || nowISO(),
    verifiedAt: orderSnap.data().verifiedAt?.toDate?.()?.toISOString() || "",
    fulfilledAt: orderSnap.data().fulfilledAt?.toDate?.()?.toISOString() || "",
    cancelledAt: orderSnap.data().cancelledAt?.toDate?.()?.toISOString() || ""
  };
}

export async function getOrderByPaymentCode(code) {
  const c = String(code || "").trim().toUpperCase();
  const ordersRef = collection(db, 'orders');
  const q = query(ordersRef, where('paymentCode', '==', c));
  const ordersSnap = await getDocs(q);
  
  if (ordersSnap.empty) {
    return null;
  }
  
  const doc = ordersSnap.docs[0];
  return {
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || nowISO(),
    updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || nowISO(),
    verifiedAt: doc.data().verifiedAt?.toDate?.()?.toISOString() || "",
    fulfilledAt: doc.data().fulfilledAt?.toDate?.()?.toISOString() || "",
    cancelledAt: doc.data().cancelledAt?.toDate?.()?.toISOString() || ""
  };
}

export async function createOrder({ pid, items, total }) {
  const order = {
    pid: String(pid).trim().toUpperCase(),
    items: items.map(it => ({ itemId: it.itemId, name: it.name, qty: it.qty, price: it.price })),
    total,
    status: "PENDING_PAYMENT",
    paymentCode: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    verifiedAt: null,
    fulfilledAt: null,
    cancelledAt: null
  };
  
  const ordersRef = collection(db, 'orders');
  const docRef = await addDoc(ordersRef, order);
  
  return await getOrderById(docRef.id);
}

export async function setOrderPaymentCode(orderId, code) {
  const orderRef = doc(db, 'orders', orderId);
  await updateDoc(orderRef, {
    paymentCode: String(code).toUpperCase(),
    status: "PAID_UNVERIFIED",
    updatedAt: serverTimestamp()
  });
}

export async function verifyPaymentCode(code) {
  const order = await getOrderByPaymentCode(code);
  if (!order) return null;
  
  const orderRef = doc(db, 'orders', order.id);
  await updateDoc(orderRef, {
    status: "VERIFIED",
    verifiedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  
  return await getOrderById(order.id);
}

export async function fulfillOrder(orderId) {
  const orderRef = doc(db, 'orders', orderId);
  await updateDoc(orderRef, {
    status: "FULFILLED",
    fulfilledAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function cancelOrder(orderId, by = "student") {
  const order = await getOrderById(orderId);
  if (!order || order.status === "FULFILLED" || order.status === "CANCELLED") {
    return order;
  }
  
  const orderRef = doc(db, 'orders', orderId);
  await updateDoc(orderRef, {
    status: "CANCELLED",
    cancelledAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  
  return await getOrderById(orderId);
}

export async function deleteOrder(orderId) {
  const orderRef = doc(db, 'orders', orderId);
  await deleteDoc(orderRef);
}

// Data management
export async function exportData() {
  try {
    const [settings, menu, orders, students] = await Promise.all([
      getSettings(),
      listMenu(),
      listOrders(),
      getAllStudents()
    ]);
    
    const data = {
      settings,
      menu,
      orders,
      students: students.reduce((acc, student) => {
        acc[student.pid] = { ...student };
        delete acc[student.pid].pid;
        return acc;
      }, {})
    };
    
    return JSON.stringify(data, null, 2);
  } catch (error) {
    console.error("Error exporting data:", error);
    throw error;
  }
}

async function getAllStudents() {
  const studentsRef = collection(db, 'students');
  const studentsSnap = await getDocs(studentsRef);
  
  return studentsSnap.docs.map(doc => ({
    pid: doc.id,
    ...doc.data(),
    cancels: doc.data().cancels || [],
    createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || nowISO(),
    updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || nowISO()
  }));
}

export async function importDataFromJSON(json) {
  try {
    const data = JSON.parse(json);
    if (!data || typeof data !== "object") {
      throw new Error("Invalid data format");
    }
    
    // Import settings
    if (data.settings) {
      const settingsRef = doc(db, 'settings', 'main');
      await setDoc(settingsRef, {
        ...data.settings,
        updatedAt: serverTimestamp()
      });
    }
    
    // Clear and import menu
    if (data.menu && Array.isArray(data.menu)) {
      const menuRef = collection(db, 'menu');
      const menuSnap = await getDocs(menuRef);
      
      // Delete existing menu items
      const deletePromises = menuSnap.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      // Add new menu items
      const addPromises = data.menu.map(item => 
        addDoc(menuRef, {
          ...item,
          createdAt: item.createdAt ? new Date(item.createdAt) : serverTimestamp(),
          updatedAt: serverTimestamp()
        })
      );
      await Promise.all(addPromises);
    }
    
    // Clear and import orders
    if (data.orders && Array.isArray(data.orders)) {
      const ordersRef = collection(db, 'orders');
      const ordersSnap = await getDocs(ordersRef);
      
      // Delete existing orders
      const deletePromises = ordersSnap.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      // Add new orders
      const addPromises = data.orders.map(order => 
        addDoc(ordersRef, {
          ...order,
          createdAt: order.createdAt ? new Date(order.createdAt) : serverTimestamp(),
          updatedAt: serverTimestamp(),
          verifiedAt: order.verifiedAt ? new Date(order.verifiedAt) : null,
          fulfilledAt: order.fulfilledAt ? new Date(order.fulfilledAt) : null,
          cancelledAt: order.cancelledAt ? new Date(order.cancelledAt) : null
        })
      );
      await Promise.all(addPromises);
    }
    
    // Clear and import students
    if (data.students && typeof data.students === "object") {
      const studentsRef = collection(db, 'students');
      const studentsSnap = await getDocs(studentsRef);
      
      // Delete existing students
      const deletePromises = studentsSnap.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      // Add new students
      const addPromises = Object.entries(data.students).map(([pid, studentData]) =>
        setDoc(doc(db, 'students', pid), {
          ...studentData,
          cancels: studentData.cancellations || studentData.cancels || [],
          createdAt: studentData.createdAt ? new Date(studentData.createdAt) : serverTimestamp(),
          updatedAt: serverTimestamp()
        })
      );
      await Promise.all(addPromises);
    }
    
  } catch (error) {
    console.error("Error importing data:", error);
    throw error;
  }
}

export async function factoryReset() {
  // This is a dangerous operation, so for now we'll just log a warning
  // In production, you might want to implement proper confirmation
  console.warn("Factory reset requested - this would clear all Firestore data");
  console.warn("For safety, this operation is not implemented. Use Firebase Console to clear data manually.");
  
  // Uncomment the following if you want to implement actual reset:
  /*
  try {
    const collections = ['settings', 'menu', 'orders', 'students'];
    
    for (const collectionName of collections) {
      const collectionRef = collection(db, collectionName);
      const snapshot = await getDocs(collectionRef);
      
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
    }
    
    // Re-initialize with defaults
    await ensureInit();
    
  } catch (error) {
    console.error("Error during factory reset:", error);
    throw error;
  }
  */
}