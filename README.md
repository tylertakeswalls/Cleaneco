# Cleaneco - Recent Revisions & Updates

This document summarizes the recent features and structural updates implemented in the Cleaneco project.

## 1. Address Field Decomposition
- **Forms Updated**: Registration Form (`Register.jsx`) and Order Forms (`OrderForm.jsx`).
- **Changes**: Transitioned from a single "Full Address" input to granular address components:
  - Address Line 1 (Street, House No.)
  - Address Line 2 (Subdivision - Optional)
  - Barangay
  - City/Municipality
  - Province
- **Backend & Database**: Updated `submit.php`, `update.php`, `read.php`, and `database.sql` to parse, store, and retrieve the new granular address fields correctly.

## 2. Password Visibility Toggle
- **Enhancement**: Added an interactive "eye" icon to the Password and Confirm Password fields in `Register.jsx`.
- **Functionality**: Users can now toggle the visibility of their passwords while typing to prevent errors during account creation.

## 3. Email Notification System
- **New Utility**: Introduced `php-backend/api/email_helper.php` to handle outbound email logic.
- **Integration**: 
  - Wired into `submit.php` to send welcome/confirmation emails upon successful user registration and new order placement.
  - Wired into `update.php` to notify users when their order status is updated by administrators.

## 4. UI/UX Component Additions
- **Modals**: Created reusable `AlertModal.jsx` and `ConfirmModal.jsx` to replace native browser alerts with stylized, branded popup dialogues.
- **Client Scheduling**: Added `ClientCalendar.jsx` to improve appointment and date selection for client-side interactions.

## 5. Administrative Dashboard Enhancements
- **Admin Landing & Users**: Updated `AdminLanding.jsx` and `AdminUsers.jsx` to support the new data structures and UI components.
- **Service Management**: Refactored `ServiceManagement.jsx` to integrate the custom confirm and alert modals.
- **Order Database**: Improved `OrderDatabase.jsx` to display the newly separated address strings and integrate the latest order status workflows.

## 6. Styling Updates
- **CSS**: Minor layout and styling tweaks in `orderform.css` to accommodate the new side-by-side address fields.

## 7. Registration & User Onboarding Updates
- **Mobile Number Formatting**: Enforced the `xxx-xxx-xxxx` format on the mobile number in the registration text field.
- **Terms of Service**: Added a short notice upon registration and a Terms of Service "Agree" checkbox.

## 8. Order & Service Management Enhancements
- **Service Tax Placeholder**: Implemented a service tax computation feature placeholder (currently set at 10%).
- **Reschedule & Cancellation Workflow**: Added a feature for reschedule and cancellation requiring admin approval, including status approval charging depending on cancelled or rescheduled reason filtering.
- **Filtering Improvements**: 
  - Updated order filtering to use a dropdown of services instead of manual typing.
  - Updated service filtering to use a dropdown of services instead of manual typing.

## 9. Major Architecture Overhaul (Node.js/Express Migration)
- **Backend Migration**: Replaced the legacy PHP backend (`php-backend`) with a modern, robust Node.js/Express server (`backend/`).
- **Database Integration**: Implemented Mongoose models (`Service.js`, `Notification.js`, etc.) for structured MongoDB interactions.
- **Frontend Refactoring & Cleanup**:
  - Removed redundant client-specific pages (e.g., `DecloggingClient.jsx`, `DeepCleaningClient.jsx`) in favor of unified, role-based views.
  - Added dedicated layout components (e.g., `AdminLayout.jsx`) for better UI consistency.
  - Introduced profile management pages (`AdminProfile.jsx`, `ClientProfile.jsx`).
  - Implemented an email verification page (`VerifyEmail.jsx`) to enhance user security.
  - Removed standard React boilerplate files (`App.test.js`, `logo.svg`, `reportWebVitals.js`, `setupTests.js`) to clean up the codebase.

## 10. Dashboard & UI Polish
- **PDF Report Generation**: Built a dynamic PDF generation engine using `pdfkit` for the Admin Dashboard to generate structured Monthly, Quarterly, and Yearly reports.
- **Profile Enhancements**: Added the ability for both clients and administrators to view and edit their `username` from their profile settings, protected by backend uniqueness validation.
- **Email Templating Polish**: Embedded the official `logo_fixed.png` securely in outbound Verification Emails, injected inline font styling, and corrected the system sender name to the official "Cleaneco Waste Management Services".
- **Responsive Alignment**: Fixed a flexbox rendering discrepancy affecting the "Clear Filters" button in the Service Management and Order Database admin views by implementing strict cross-axis alignment parameters.

## 11. Bug Fixes, Notifications & Codebase Optimization
- **Admin Notifications**: Implemented comprehensive admin notification hooks for account deletion requests, profile updates, and order cancellation/reschedule requests. Fixed bugs where status updates were not properly triggering admin alerts.
- **Profile Image Upload Fix**: Increased the Express body parser limit (`express.json({ limit: '10mb' })`) to resolve a `PayloadTooLargeError` that prevented users and admins from updating their profile pictures.
- **Ponytail Audit / Refactoring**:
  - Leveraged **Express 5** native async error handling to remove dozens of lines of repetitive `try/catch` boilerplate across API routes.
  - Introduced a centralized `errorHandler` middleware to standardized API error responses.
  - Consolidated scattered date-formatting and status-styling logic into a reusable `src/utils/helpers.js` file, utilizing native `Intl.DateTimeFormat`.
  - Abstracted duplicate CSS button styles into a global `.btn-cleaneco` utility class for maintaining consistent branding across components.

## 12. Recent Enhancements & Global UI Standardization
- **Account Deletion Lifecycle**: Implemented a 90-day grace period for account deletion requests, manageable by administrators.
- **Admin Dashboard Stats**: Added monthly, quarterly, and yearly revenue growth percentage metrics utilizing MongoDB aggregation pipelines, and seeded historical data for realistic timeline displays.
- **Order Editing Constraints**: Enforced strict rules where orders marked as "Cancelled" can no longer be edited by administrators to preserve data integrity.
- **Global Modal System**: Unified all confirmation and alert modals into a single global `ConfirmContext`. Standardized modal styling to use a modern, custom design language with a glassmorphism blur effect (`backdrop-filter: blur(5px)`) and eliminated redundant localized modal components for a leaner architecture.
- **Performance & Code Polish**: Optimized backend data retrieval using `.lean({ virtuals: true })` for significantly reduced memory footprint during order fetching, and removed obsolete frontend regex price parsers.

## 13. UI Alignment & Payment Verification Enhancements
- **Payment Verification System**: Added a dedicated `VerifyPayments.jsx` module for administrators to securely view, verify, or reject uploaded payment receipts in an organized dashboard.
- **Structural UI Polish**: Restructured Admin dashboard views (`VerifyPayments.jsx`, `AdminProfile.jsx`, etc.) to use identical flexbox and bootstrap grid containers ensuring header text and action cards align seamlessly.
- **CSS Hover Effects**: Eradicated transparent-text hover bugs across `OngoingOrders.jsx` and Admin quick actions by decoupling destructive global gradients from contextual `.btn-success-solid` and `.btn-primary-solid` utility classes.

## 14. Mobile Responsiveness & Layout Overhaul
- **Admin Layout Simplification**: Restructured the mobile admin sidebar to integrate gracefully with the top navbar. The top navbar is hidden on mobile devices and its essential actions (Notifications, Profile) are embedded directly into the horizontally scrollable sidebar header, creating a clean, full-screen mobile app experience.
- **Client Navbar Toggler Fix**: Removed redundant `bootstrap.bundle.min.js` imports across HTML and React entry files to resolve conflicting event listeners, ensuring the mobile burger menu opens and closes natively without state corruption.
- **Client Header Actions**: Extracted the Profile Picture and Notification Bell from the collapsible mobile menu and placed them directly on the top header row for constant visibility.
- **Client Notification Overlay**: Upgraded the notification dropdown on mobile devices to a sleek, fixed overlay that spans the full screen width, preventing the UI from being clipped off the edge of narrow screens.
- **Ponytail Architecture Audit**:
  - Replaced an inefficient `O(N)` manual array mapping loop in the `/availability` endpoint with a highly optimized MongoDB Aggregation pipeline (`Order.aggregate`) that natively groups and counts bookings.
  - Refactored `Header.jsx` to eliminate network spam. It now utilizes independent `useEffect` hooks and a 60-second polling interval rather than refetching notifications on every single route change.
  - Left explicit architectural ceiling comments on custom calendar grid components (`AdminCalendar.jsx`, `ClientCalendar.jsx`) to guide future scalability.

## 15. Security & Authentication Enhancements
- **Login Rate Limiting**: Implemented a robust **IP-based** rate limiting system on the authentication endpoints using `express-rate-limit`. This prevents brute-force attacks by temporarily locking out any IP address that attempts to log in with invalid credentials (or non-existent usernames) 5 consecutive times, enforcing a 60-second cooldown period with a live frontend countdown timer.

## 16. PayMongo Integration & Codebase Optimization
- **Unified Checkout Flow**: Removed manual QR code scanning and file uploads for reservation fee payments. The `OrderForm` now securely submits directly to the backend to generate a **PayMongo Checkout Session**, seamlessly redirecting users to the payment gateway.
- **Automated Revenue Tracking**: Implemented a secure webhook listener (`/api/payments/webhook`) to parse `checkout_session.payment.paid` events. The backend now automatically updates order statuses to "In Progress" and updates Admin Revenue metrics instantly upon successful payment.
- **Ponytail Debt Reduction**: Streamlined the architecture by aggressively deleting redundant code. Entirely removed the `VerifyPayments.jsx` admin interface, dropped the secondary `Payment.js` MongoDB schema, and purged obsolete endpoints to ensure the application maintains a lean, single source of truth (`Order.status`) for all revenue calculations.

## Prerequisites & Installation Dependencies

Before running the project, please ensure you have the following installed on your system:
- **Node.js** (v18 or higher recommended) - [Download here](https://nodejs.org/)
- **npm** (Node Package Manager) - installed automatically with Node.js.

> **Note**: A local MongoDB installation is not required as this project connects to a cloud-hosted MongoDB Atlas database. The connection string and other environment variables are pre-configured in the `backend/.env` file.

## How to Run Locally (After Extraction)

Follow these steps exactly to set up and run the project after you have extracted the provided files.

### Step 1: Backend Setup (Node.js/Express)
1. Open a terminal or command prompt.
2. Navigate to the extracted project folder, then into the `backend/` directory:
   ```bash
   cd path/to/extracted/folder/backend
   ```
3. Install the required backend dependencies:
   ```bash
   npm install
   ```
4. Start the backend server:
   ```bash
   npm run dev
   ```
   *The server should start and display a message indicating it's connected to MongoDB and running on port 5000.*

### Step 2: Frontend Setup (React)
1. Open a **new, separate terminal window** (keep the backend terminal running).
2. Navigate to the root of the extracted project folder:
   ```bash
   cd path/to/extracted/folder
   ```
3. Install the required frontend dependencies:
   ```bash
   npm install
   ```
4. Start the frontend React application:
   ```bash
   npm start
   ```
   *The application should automatically open in your default web browser at `http://localhost:3000`.*
