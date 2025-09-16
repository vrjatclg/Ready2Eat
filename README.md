# Canteen Management System (Firebase + HTML/CSS/JS)

A real-time web app to streamline canteen orders using Firebase Firestore for cross-device synchronization:
- Students: browse, add to cart, place orders, generate payment codes, view/cancel orders.
- Admin: login, verify payment codes, block/unblock students, edit menu, cancel/delete/fulfill orders, export/import data.

Data is stored in Firebase Firestore for real-time updates across devices. Cart data remains in localStorage for fast local access.

## Setup Instructions

### 1. Firebase Setup
1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Firestore Database in your project
3. Create a web app in your Firebase project
4. Copy the Firebase configuration from Project Settings → General → Your apps → Web app

### 2. Configure Firebase
1. Copy `js/firebase-init.sample.js` to `js/firebase-init.js`
2. Replace the placeholder values with your actual Firebase config:
   ```javascript
   const firebaseConfig = {
     apiKey: "your-api-key",
     authDomain: "your-project.firebaseapp.com", 
     projectId: "your-project-id",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "your-sender-id",
     appId: "your-app-id"
   };
   ```

### 3. Firestore Security Rules
Set up permissive rules for development in Firestore → Rules:
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

**Note:** For production, implement proper security rules based on your authentication requirements.

### 4. Deploy
- Deploy via GitHub Pages or any static hosting service
- Ensure HTTPS is used (required for Firebase)

## Features

Student (index.html)
- No login required. PID is entered only at checkout or when viewing orders.
- Mobile-first UI.
- Menu browsing with images, prices, and availability.
- Cart & checkout (cart stored locally for performance).
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

### Data Storage
- **Firestore Collections:**
  - `settings/main`: Admin password hash, cancellation threshold
  - `menu`: Menu items with availability, prices, images
  - `orders`: Order records with status, payment codes, timestamps
  - `students/{pid}`: Student records with block status, cancellation history
- **localStorage**: Cart data (`cms_cart`) and last PID (`cms_last_pid`) for local performance

### Order Statuses
- `PENDING_PAYMENT` → created
- `PAID_UNVERIFIED` → student generated payment code
- `VERIFIED` → admin verified code
- `FULFILLED` → order delivered
- `CANCELLED` → cancelled by student/admin

### Auto-block Policy
If cancellations in the last 24 hours reach the threshold (default 3), student is auto-blocked. Admin can adjust threshold.

### Security
Admin password is stored as SHA-256 hash in Firestore.

## Running

- Open `index.html` for Student UI.
- Open `admin.html` for Admin UI (default password: `admin123`).
- To reset everything, use Admin → Settings → Factory Reset (for development only).

## Development Notes

- Uses Firebase v9 modular SDK via CDN (no bundler required)
- The original `js/storage.js` remains for reference but is no longer used
- Cart operations are kept in localStorage for fast local access
- All data operations are real-time via Firestore

## Notes on Security

- This implementation uses permissive Firestore rules suitable for development/kiosk use
- For production, implement proper authentication and security rules
- Consider rate limiting and data validation on the server side
- Admin authentication is client-side only - implement server-side auth for production
