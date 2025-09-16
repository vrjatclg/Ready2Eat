# Canteen Management System (Pure HTML/CSS/JS)

A no-backend web app to streamline canteen orders:
- Students: browse, add to cart, place orders, generate payment codes, view/cancel orders.
- Admin: login, verify payment codes, block/unblock students, edit menu, cancel/delete/fulfill orders, export/import data.

Data is stored in the browser's localStorage. No frameworks, no servers.

## Features

Student (index.html)
- No login required. PID is entered only at checkout or when viewing orders.
- Mobile-first UI.
- Menu browsing with images, prices, and availability.
- Cart & checkout.
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

- All data under localStorage key `cms_v1`.
- Orders statuses:
  - `PENDING_PAYMENT` → created
  - `PAID_UNVERIFIED` → student generated payment code
  - `VERIFIED` → admin verified code
  - `FULFILLED` → order delivered
  - `CANCELLED` → cancelled by student/admin
- Auto-block policy: if cancellations in the last 24 hours reach the threshold (default 3), student is auto-blocked. Admin can adjust threshold.
- Admin password is stored as SHA-256 hash in localStorage.

## Running

- Open `index.html` for Student UI.
- Open `admin.html` for Admin UI (default password: `admin123`).
- To reset everything, use Admin → Settings → Factory Reset, or clear the site's local storage in your browser.

## Notes on Security

- This is a front-end-only demo suitable for kiosk or LAN use. For production, add a backend with real authentication, secure payments, and server-side validation.
