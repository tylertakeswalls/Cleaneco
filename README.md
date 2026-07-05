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
