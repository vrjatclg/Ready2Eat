// storage.firestore.js - Firebase Firestore-backed data layer
import { db } from "./firebase-init.js";
import { 
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, addDoc, 
  query, where, orderBy, limit, serverTimestamp, writeBatch 
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { uuid, nowISO, sha256, hoursAgo } from "./utils.js";

// Initialize with default data if needed
export async function ensureInit() {
  try {
    // Check if settings exist, if not create defaults
    const settingsRef = doc(db, 'settings', 'main');
    const settingsSnap = await getDoc(settingsRef);
    
    if (!settingsSnap.exists()) {
      // Create default settings
      await setDoc(settingsRef, {
        adminPasswordHash: await sha256("admin123"),
        cancelThreshold24h: 3
      });
      
      // Create default menu items
      const defaultMenu = [
        { name: "Samosa", price: 20, imageUrl: "", available: true },
        { name: "Tea", price: 12, imageUrl: "", available: true },
        { name: "Veg Puff", price: 25, imageUrl: "", available: true },
        { name: "Coffee", price: 18, imageUrl: "", available: true }
      ];
      
      const batch = writeBatch(db);
      defaultMenu.forEach(item => {
        const menuRef = doc(collection(db, 'menu'));
        batch.set(menuRef, {
          ...item,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });
      await batch.commit();
    }
    
    return true;
  } catch (error) {
    console.error("Firebase initialization error:", error);
    throw new Error("Failed to initialize Firebase storage");
  }
}

// Settings
export async function getCancelThreshold() {
  try {
    const settingsRef = doc(db, 'settings', 'main');
    const settingsSnap = await getDoc(settingsRef);
    if (settingsSnap.exists()) {
      return settingsSnap.data().cancelThreshold24h ?? 3;
    }
    return 3;
  } catch (error) {
    console.error("Error getting cancel threshold:", error);
    return 3;
  }
}

export async function setCancelThreshold(n) {
  try {
    const settingsRef = doc(db, 'settings', 'main');
    const value = Math.max(1, Math.min(10, Number(n) || 3));
    await updateDoc(settingsRef, {
      cancelThreshold24h: value
    });
  } catch (error) {
    console.error("Error setting cancel threshold:", error);
    throw error;
  }
}

export async function checkAdminPassword(input) {
  try {
    const hash = await sha256(input);
    const settingsRef = doc(db, 'settings', 'main');
    const settingsSnap = await getDoc(settingsRef);
    if (settingsSnap.exists()) {
      return hash === settingsSnap.data().adminPasswordHash;
    }
    return false;
  } catch (error) {
    console.error("Error checking admin password:", error);
    return false;
  }
}

export async function setAdminPassword(newPlaintext) {
  try {
    const hash = await sha256(newPlaintext);
    const settingsRef = doc(db, 'settings', 'main');
    await updateDoc(settingsRef, {
      adminPasswordHash: hash
    });
  } catch (error) {
    console.error("Error setting admin password:", error);
    throw error;
  }
}

// Menu
export async function listMenu() {
  try {
    const menuRef = collection(db, 'menu');
    const menuSnap = await getDocs(menuRef);
    return menuSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error listing menu:", error);
    return [];
  }
}

export async function upsertMenuItem(item) {
  try {
    if (item.id) {
      // Update existing item
      const menuRef = doc(db, 'menu', item.id);
      await updateDoc(menuRef, {
        ...item,
        updatedAt: serverTimestamp()
      });
    } else {
      // Create new item
      const menuRef = doc(collection(db, 'menu'));
      await setDoc(menuRef, {
        ...item,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.error("Error upserting menu item:", error);
    throw error;
  }
}

export async function updateMenuAvailability(id, available) {
  try {
    const menuRef = doc(db, 'menu', id);
    await updateDoc(menuRef, {
      available: !!available,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error updating menu availability:", error);
    throw error;
  }
}

export async function deleteMenuItem(id) {
  try {
    const menuRef = doc(db, 'menu', id);
    await deleteDoc(menuRef);
  } catch (error) {
    console.error("Error deleting menu item:", error);
    throw error;
  }
}

// Students
export async function getStudent(pid) {
  try {
    const key = String(pid || "").trim().toUpperCase();
    const studentRef = doc(db, 'students', key);
    const studentSnap = await getDoc(studentRef);
    if (studentSnap.exists()) {
      return { pid: key, ...studentSnap.data() };
    }
    return null;
  } catch (error) {
    console.error("Error getting student:", error);
    return null;
  }
}

export async function ensureStudent(pid) {
  try {
    const key = String(pid || "").trim().toUpperCase();
    const studentRef = doc(db, 'students', key);
    const studentSnap = await getDoc(studentRef);
    
    if (!studentSnap.exists()) {
      await setDoc(studentRef, {
        blocked: false,
        blockReason: "",
        cancels: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    
    return await getStudent(key);
  } catch (error) {
    console.error("Error ensuring student:", error);
    throw error;
  }
}

export async function setStudentBlocked(pid, blocked, reason = "") {
  try {
    const key = String(pid || "").trim().toUpperCase();
    const studentRef = doc(db, 'students', key);
    await updateDoc(studentRef, {
      blocked: !!blocked,
      blockReason: blocked ? (reason || "Blocked by admin") : "",
      updatedAt: serverTimestamp()
    });
    return await getStudent(key);
  } catch (error) {
    console.error("Error setting student blocked:", error);
    throw error;
  }
}

export async function recordCancellation(pid, ts = null) {
  try {
    const key = String(pid || "").trim().toUpperCase();
    const student = await getStudent(key) || await ensureStudent(key);
    const cancels = student.cancels || [];
    cancels.push(ts || nowISO());
    
    const studentRef = doc(db, 'students', key);
    await updateDoc(studentRef, {
      cancels: cancels,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error recording cancellation:", error);
    throw error;
  }
}

export async function getRecentCancellationCount(pid, windowHours = 24) {
  try {
    const student = await getStudent(pid);
    if (!student || !student.cancels) return 0;
    
    const since = hoursAgo(windowHours);
    return student.cancels.filter(ts => new Date(ts) > since).length;
  } catch (error) {
    console.error("Error getting recent cancellation count:", error);
    return 0;
  }
}

// Orders
export async function createOrder(order) {
  try {
    const orderRef = doc(collection(db, 'orders'));
    const orderData = {
      ...order,
      id: orderRef.id,
      pid: String(order.pid).trim().toUpperCase(),
      status: "PENDING_PAYMENT",
      paymentCode: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      verifiedAt: "",
      fulfilledAt: "",
      cancelledAt: ""
    };
    
    await setDoc(orderRef, orderData);
    return { ...orderData, id: orderRef.id };
  } catch (error) {
    console.error("Error creating order:", error);
    throw error;
  }
}

export async function listOrders() {
  try {
    const ordersRef = collection(db, 'orders');
    const ordersQuery = query(ordersRef, orderBy('createdAt', 'desc'));
    const ordersSnap = await getDocs(ordersQuery);
    return ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error listing orders:", error);
    return [];
  }
}

export async function listOrdersByPid(pid) {
  try {
    const key = String(pid || "").trim().toUpperCase();
    const ordersRef = collection(db, 'orders');
    const ordersQuery = query(
      ordersRef, 
      where('pid', '==', key),
      orderBy('createdAt', 'desc')
    );
    const ordersSnap = await getDocs(ordersQuery);
    return ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error listing orders by PID:", error);
    return [];
  }
}

export async function setOrderPaymentCode(orderId, code) {
  try {
    const orderRef = doc(db, 'orders', orderId);
    await updateDoc(orderRef, {
      paymentCode: String(code).toUpperCase(),
      status: "PAID_UNVERIFIED",
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error setting order payment code:", error);
    throw error;
  }
}

export async function verifyPaymentCode(code) {
  try {
    const codeUpper = String(code || "").trim().toUpperCase();
    const ordersRef = collection(db, 'orders');
    const ordersQuery = query(ordersRef, where('paymentCode', '==', codeUpper));
    const ordersSnap = await getDocs(ordersQuery);
    
    if (ordersSnap.empty) return null;
    
    const orderDoc = ordersSnap.docs[0];
    await updateDoc(orderDoc.ref, {
      status: "VERIFIED",
      verifiedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    // Return updated order
    const updatedSnap = await getDoc(orderDoc.ref);
    return { id: updatedSnap.id, ...updatedSnap.data() };
  } catch (error) {
    console.error("Error verifying payment code:", error);
    return null;
  }
}

export async function cancelOrder(orderId) {
  try {
    const orderRef = doc(db, 'orders', orderId);
    const orderSnap = await getDoc(orderRef);
    
    if (orderSnap.exists()) {
      const orderData = orderSnap.data();
      if (orderData.status !== "FULFILLED" && orderData.status !== "CANCELLED") {
        await updateDoc(orderRef, {
          status: "CANCELLED",
          cancelledAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    }
    
    // Return updated order
    const updatedSnap = await getDoc(orderRef);
    return updatedSnap.exists() ? { id: updatedSnap.id, ...updatedSnap.data() } : null;
  } catch (error) {
    console.error("Error cancelling order:", error);
    throw error;
  }
}

export async function fulfillOrder(orderId) {
  try {
    const orderRef = doc(db, 'orders', orderId);
    await updateDoc(orderRef, {
      status: "FULFILLED",
      fulfilledAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error fulfilling order:", error);
    throw error;
  }
}

export async function deleteOrder(orderId) {
  try {
    const orderRef = doc(db, 'orders', orderId);
    await deleteDoc(orderRef);
  } catch (error) {
    console.error("Error deleting order:", error);
    throw error;
  }
}

// Cart
export async function getCart(pid) {
  try {
    const key = String(pid || "").trim().toUpperCase();
    const cartRef = doc(db, 'students', key, 'cart', 'items');
    const cartSnap = await getDoc(cartRef);
    
    if (cartSnap.exists()) {
      return cartSnap.data().items || [];
    }
    return [];
  } catch (error) {
    console.error("Error getting cart:", error);
    return [];
  }
}

export async function setCart(pid, items) {
  try {
    const key = String(pid || "").trim().toUpperCase();
    const cartRef = doc(db, 'students', key, 'cart', 'items');
    
    if (items.length === 0) {
      await deleteDoc(cartRef);
    } else {
      await setDoc(cartRef, {
        items: items,
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.error("Error setting cart:", error);
    throw error;
  }
}

export async function addToCart(pid, itemId, qty) {
  try {
    const currentCart = await getCart(pid);
    const existingIndex = currentCart.findIndex(item => item.itemId === itemId);
    
    if (existingIndex >= 0) {
      currentCart[existingIndex].qty += qty;
    } else {
      // Get menu item details to add to cart
      const menuItems = await listMenu();
      const menuItem = menuItems.find(item => item.id === itemId);
      if (menuItem) {
        currentCart.push({
          itemId: itemId,
          name: menuItem.name,
          price: menuItem.price,
          qty: qty
        });
      }
    }
    
    await setCart(pid, currentCart);
    return currentCart;
  } catch (error) {
    console.error("Error adding to cart:", error);
    throw error;
  }
}

export async function clearCart(pid) {
  try {
    await setCart(pid, []);
  } catch (error) {
    console.error("Error clearing cart:", error);
    throw error;
  }
}