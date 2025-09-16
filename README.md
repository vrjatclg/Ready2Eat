# Canteen Management System (Firebase Firestore)

A no-backend web app to streamline canteen orders, now powered by Firebase Firestore for cross-device synchronization:
- Students: browse, add to cart, place orders, generate payment codes, view/cancel orders.
- Admin: login, verify payment codes, block/unblock students, edit menu, cancel/delete/fulfill orders, export/import data.

Data is stored in Firebase Firestore, allowing users to access their data across different devices.

## Setup

1. **Firebase Configuration**: 
   - Copy `js/firebase-init.sample.js` to `js/firebase-init.js`
   - Replace the placeholder config with your Firebase Web App configuration

2. **Firestore Security Rules** (for testing - make these more restrictive in production):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

## Features

Student (index.html)
- PID required on first use each session (no localStorage persistence).
- Mobile-first UI.
- Menu browsing with images, prices, and availability.
- Cart & checkout (cart stored per PID in Firestore).
- Payment flow generating a unique payment code per order.
- View and cancel orders.
- Automatic blocking on excessive cancellations (default: >3 in 24 hours).

Admin (admin.html)
- Password-protected (default: `admin123`).
- Dashboard of all orders with filter/search.
- Verify payment code, mark orders fulfilled, cancel/delete orders.
- Manage students: block/unblock, view status.
- Manage menu: add/edit/delete, mark available/unavailable, update prices.
- Settings: change password, tune cancellation threshold, export/import data, factory reset.

## Technical Notes

- All data stored in Firebase Firestore collections:
  - `settings/main` - admin password hash and cancellation threshold
  - `menu` - menu items collection
  - `students` - student records collection
  - `students/{pid}/cart/items` - individual student carts
  - `orders` - orders collection
- Orders statuses:
  - `PENDING_PAYMENT` → created
  - `PAID_UNVERIFIED` → student generated payment code
  - `VERIFIED` → admin verified code
  - `FULFILLED` → order delivered
  - `CANCELLED` → cancelled by student/admin
- Auto-block policy: if cancellations in the last 24 hours reach the threshold (default 3), student is auto-blocked. Admin can adjust threshold.
- Admin password is stored as SHA-256 hash in Firestore.
- **No localStorage usage** - users must enter PID each session; cart is stored in Firestore per PID.

## Running

- Open `index.html` for Student UI.
- Open `admin.html` for Admin UI (default password: `admin123`).
- To reset everything, use Admin → Settings → Factory Reset, which clears all Firestore data.

## Notes on Security

- This is a front-end-only demo. For production:
  - Implement proper Firestore security rules
  - Add server-side authentication and validation
  - Use Firebase Authentication for user management
  - Secure payment processing integration
