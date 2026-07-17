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
- **Backend & Database**: Updated backend API routes and Mongoose schemas to parse, store, and retrieve the new granular address fields correctly.

## 2. Password Visibility Toggle
- **Enhancement**: Added an interactive "eye" icon to the Password and Confirm Password fields in `Register.jsx`.
- **Functionality**: Users can now toggle the visibility of their passwords while typing to prevent errors during account creation.

## 3. Email Notification System
- **New Utility**: Introduced Node.js email handling (`backend/utils/emailHelper.js`) using Nodemailer for outbound email logic.
- **Integration**: 
  - Wired into backend authentication routes to send welcome and verification emails upon successful user registration.
  - Wired into order routes to notify users when an order is placed or its status is updated by administrators.

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

## How to Run Locally

### Backend (Node.js/Express)
1. Open a terminal and navigate to the `backend/` folder:
   ```bash
   cd backend
   ```
2. Install the required Node dependencies:
   ```bash
   npm install
   ```
3. Start the backend server in development mode (defaults to port `5000`):
   ```bash
   npm run dev
   ```

### Frontend (React)
1. Open a separate terminal in the root directory of the project (`firstapp/`).
2. Install the required React dependencies:
   ```bash
   npm install
   ```
3. Start the frontend React app (defaults to port `3000`):
   ```bash
   npm start
   ```
