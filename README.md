# Canteen Management System (Firebase Firestore Backend)

A no-backend web app to streamline canteen orders with Firebase Firestore for data persistence:
- Students: browse, add to cart, place orders, generate payment codes, view/cancel orders.
- Admin: login, verify payment codes, block/unblock students, edit menu, cancel/delete/fulfill orders.

Data is stored in Firebase Firestore for cross-device synchronization. No frameworks, no servers.

## Features

Student (index.html)
- No login required. PID is entered at checkout or when viewing orders.
- Mobile-first UI.
- Menu browsing with images, prices, and availability.
- Cart & checkout (cart persists per PID in Firestore).
- Payment flow generating a unique payment code per order.
- View and cancel orders.
- Automatic blocking on excessive cancellations (default: >3 in 24 hours).

Admin (admin.html)
- Password-protected (default: `admin123`).
- Dashboard of all orders with filter/search.
- Verify payment code, mark orders fulfilled, cancel/delete orders.
- Manage students: block/unblock, view status.
- Manage menu: add/edit/delete, mark available/unavailable, update prices.
- Settings: change password, tune cancellation threshold.

## Setup Instructions

### 1. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select an existing one
3. Enable Firestore Database:
   - Go to Firestore Database
   - Click "Create database"
   - Choose "Start in test mode" for development
4. Get your web app configuration:
   - Go to Project Settings → General
   - Scroll to "Your apps" section
   - Click "Web" to add a web app or copy config from existing web app
   - Copy the Firebase configuration object

### 2. Application Setup

1. Copy `js/firebase-init.sample.js` to `js/firebase-init.js`
2. Open `js/firebase-init.js` and replace the placeholder config with your actual Firebase configuration
3. Open `index.html` for Student UI or `admin.html` for Admin UI

### 3. Firestore Security Rules (Example)

For development/testing, use permissive rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write access to all documents for testing
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

**⚠️ Important**: Harden these rules for production! Example production rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Settings and menu are readable by all, writable by admins only
    match /settings/{document} {
      allow read: if true;
      allow write: if false; // Configure admin authentication
    }
    match /menu/{document} {
      allow read: if true;
      allow write: if false; // Configure admin authentication
    }
    
    // Students can read/write their own data
    match /students/{studentId} {
      allow read, write: if true; // Add user authentication
    }
    
    // Orders are readable by all, writable with validation
    match /orders/{document} {
      allow read: if true;
      allow create: if true; // Add validation
      allow update, delete: if false; // Configure admin authentication
    }
  }
}
```

## Technical Notes

### Data Structure (Firestore)

- `settings/main` (document)
  - `adminPasswordHash`: string (SHA-256 hash)
  - `cancelThreshold24h`: number
- `menu` (collection)
  - Documents with: `{name, price, imageUrl, available, createdAt, updatedAt}`
- `students` (collection, document ID = PID)
  - Documents with: `{blocked, blockReason?, cancels: [ISO timestamps]}`
- `students/{pid}/cart/items` (document)
  - `{items: [{ itemId, name, price, qty }], updatedAt}`
- `orders` (collection)
  - Documents with: `{pid, items, status, total, paymentCode?, createdAt (serverTimestamp), ...}`

### Order Statuses
- `PENDING_PAYMENT` → created
- `PAID_UNVERIFIED` → student generated payment code
- `VERIFIED` → admin verified code
- `FULFILLED` → order delivered
- `CANCELLED` → cancelled by student/admin

### Changes from localStorage Version

- **No localStorage usage**: Cart and PID are not stored locally
- **Per-PID cart**: Each student's cart is stored in Firestore and persists across devices
- **Cross-device sync**: All data syncs across devices using the same Firebase project
- **Async operations**: All storage operations are now asynchronous
- **No export/import**: Use Firebase Console for data management

## Running

- Open `index.html` for Student UI
- Open `admin.html` for Admin UI (default password: `admin123`)
- Ensure Firebase is properly configured in `js/firebase-init.js`

## Notes on Security

- This is a front-end-only demo suitable for kiosk or LAN use with Firebase backend
- For production: implement proper authentication, secure Firestore rules, and server-side validation
- Admin password is stored as SHA-256 hash in Firestore
- Consider implementing Firebase Authentication for better security
