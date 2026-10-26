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

## 17. Service Operations & Final Pricing Workflow
- **State-Driven Progress Tracker**: Overhauled the client-side progress tracker in `OngoingOrders.jsx` to dynamically reflect exact state transitions:
  - **Reserved**: Activates once the initial ₱1000 booking fee is verified.
  - **For Inspection**: Activates only when the admin assigns a confirmed schedule and a truck team.
  - **Quoted**: Activates immediately once the admin inputs a miscellaneous/final fee.
  - **Completed**: Triggers automatically once the admin uploads a Service Report.
- **Dynamic Payment Logic**: 
  - Integrated PayMongo to handle the final balance payment using a seamless modal interface on the client dashboard.
  - The backend dynamically calculates the final remaining balance by appending a 10% service tax to the total price and deducting the ₱1100 initial booking payment.
  - Added a detailed computation breakdown on the client dashboard to ensure price transparency.
- **Admin Visibility Updates**: Added a real-time computation in the `OrderDatabase.jsx` to display the "Total Bill with 10% Tax" so administrators are aware of the exact amount the client will be billed at checkout.
- **Auto-Completion**: Refactored the `upload-documents` endpoint to automatically transition an order's status to "Completed" the moment an admin uploads the post-operation Service Report.

## 18. Codebase Audit Fixes (UI/UX & Architecture)
- **Impeccable UI Clean-up**: Stripped outdated "AI tells" (e.g. side-tab accents) from the `OngoingOrders.jsx` dashboard, and tokenized hardcoded colors to strictly use our `.text-brand` and `.bg-brand` design system tokens.
- **Frontend Responsiveness**: Refactored the progress tracker in the Ongoing Orders view using a robust Flexbox layout with `flex-shrink-0` to ensure perfectly round status indicators on mobile devices.
- **Ponytail Security Hardening**: Added cryptographic signature verification to PayMongo webhooks in `backend/routes/payments.js` using `crypto.createHmac` to prevent spoofed successful payments (with a secure fallback for local development).
- **Database Optimization**: Refactored multiple N+1 `order.save()` loops into `Promise.all()` concurrent writes within the webhook handler and the order submission route to drastically reduce latency and avoid database lock contention.
- **Authentication Resilience**: Removed hardcoded JWT secret fallbacks from `backend/routes/auth.js` to ensure the server enforces secure environment configurations.

## 19. Production Deployment & Infrastructure
- **Backend Deployment (Render)**: Successfully deployed the Express backend as a live Web Service on Render, transitioning from local development. Configured production environment variables and whitelisted the Render IP in MongoDB Atlas.
- **Frontend Deployment (Vercel)**: Deployed the React frontend application to Vercel. Configured global routing to ensure standard SPA behavior.
- **PayMongo Webhook Infrastructure**: 
  - Integrated live PayMongo webhooks to securely listen for checkout success events.
  - Resolved complex Express body parsing limitations by capturing `req.rawBody` globally to ensure cryptographic webhook signatures perfectly match PayMongo's requirements.
- **Cross-Domain Session Architecture**: 
  - Overhauled the authentication flow in `Login.jsx` to strictly enforce `localStorage` as the default session storage medium.
  - This prevents modern browser Intelligent Tracking Prevention (ITP) from accidentally dropping user sessions when redirecting back from external payment gateways across different subdomains.
- **Environment Parity**: Synchronized API endpoints dynamically via `REACT_APP_API_URL` to seamlessly switch between local environments and the production backend.

## 20. Codebase Debloating & Native Replacements (Ponytail Audit)
- **PDF Generation Overhaul**: Removed heavy third-party PDF libraries (`jspdf`, `jspdf-autotable`) from the frontend. Replaced the client-side receipt generation in `OngoingOrders.jsx` with a lean, CSS-driven `@media print` layout utilizing the browser's native `window.print()` functionality, significantly reducing bundle size.
- **API Networking Modernization**: Completely removed `axios` across both the frontend and backend. 
  - Rewrote the frontend API configuration (now strictly named `api.js` instead of `axiosConfig.js`) into a zero-dependency, drop-in `fetch` wrapper that natively handles Bearer tokens and JSON parsing.
  - Replaced all PayMongo API calls in the backend (`payments.js`, `orders.js`) with the native Node.js `fetch` API.
- **Dependency Purge**: Net reduction of 3 heavy npm packages (`axios`, `jspdf`, `jspdf-autotable`), shedding dead weight and minimizing the application's attack surface and build time.
- **Dead Code & Asset Purge**: Ran an exhaustive repository audit to clear out bloated historical fragments. Deleted over 25+ dead files including deprecated backup components (`old_orderdatabase.jsx`), legacy text documents, and a massive batch of unused test image uploads from the backend. Added strict `.gitignore` rules for `/uploads` to prevent future asset pollution in source control.

## 21. Payment & Form Processing Fixes
- **PayMongo Checkout Standardization**: Removed the unsupported `dob` (Direct Online Banking) payment method type from the reservation fee checkout request in `backend/routes/orders.js`. This resolves an issue where live PayMongo accounts without this specific activation would trigger a 400 Bad Request error.
- **PayMongo Secret Key Resilience**: Implemented a fallback mechanism for the `PAYMONGO_SECRET_KEY` in the checkout session authorization header to prevent catastrophic crashes if environment variables fail to load correctly.
- **FormData Boundary Resolution**: Removed explicit `Content-Type: multipart/form-data` headers across multiple frontend components (`OrderForm.jsx`, `OrderDatabase.jsx`, `AdminSettings.jsx`). This allows the native `fetch` API to automatically generate the necessary multipart boundary strings, fixing `Multer` parsing crashes ("Multipart: Boundary not found") on the Express backend.

## 22. API Security Hardening
- **Secure HTTP Headers (Helmet)**: Integrated `helmet()` middleware into the global Express pipeline to automatically set secure HTTP headers (e.g., Content Security Policy, X-Frame-Options, X-XSS-Protection) protecting the application against well-known web vulnerabilities.
- **Strict CORS Policy**: Replaced the wildcard CORS configuration with a strict whitelist. The API now securely accepts cross-origin requests exclusively from the trusted frontend production domain (`https://cleaneco-kappa.vercel.app`) and local development ports (`5173`, `3000`).
- **Global Rate Limiting**: Deployed `express-rate-limit` across all `/api` routes, restricting inbound traffic to 100 requests per 15-minute window per IP address. This mitigates brute-force authentication attacks and DDoS vectors.

## 23. ISO/IEC 25010 Paper Alignment & Email Infrastructure Overhaul
- **Contact/Complaint System**: Implemented a dedicated "Contact Us" form accessible to both authenticated users and guests. This directly satisfies the research paper requirement for "complaint and request handling to manage client concerns" to align with ISO/IEC 25010:2011 assessment criteria.
- **Render Firewall Bypass (EmailJS)**: 
  - Completely removed `nodemailer` to circumvent Render's strict free-tier outbound SMTP firewall (which blocks ports 25, 465, and 587).
  - Migrated the entire email notification infrastructure to **EmailJS**, transmitting payloads securely over standard HTTPS (port 443).
- **Dynamic HTML Templates**: Retained the beautiful, custom HTML email designs by dynamically injecting full HTML strings directly into EmailJS templates using the `{{{html_content}}}` variable, avoiding any loss in visual quality.
- **Proxy Configuration**: Configured `app.set('trust proxy', 1)` in the Express backend to ensure the global rate limiter correctly identifies client IP addresses when deployed behind Render's reverse proxy, preventing `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` crashes.

## 24. PDF Generation & Receipt Styling
- **Header Image Injection**: Resolved an issue where the generated receipt PDF upon order completion was missing the official header image. The header is now securely fetched, buffered, and injected.
- **Stylistic Alignment**: Matched the font sizes, spacing (1.0 line height), and layout of the generated PDF receipts exactly to the official company template to ensure a professional, branded look for clients.

## 25. Edge-Case Workflow & Email Bug Fixes
- **Unpaid Order UI (Abandoned Carts)**: Modified `OngoingOrders.jsx` to completely hide the visual progress tracker if an order is in the "Pending" (unpaid) state. Unpaid orders now elegantly display as abandoned carts with a simple "Pay Reservation" call-to-action button, reducing UX confusion.
- **Email Status Correction**: Fixed a bug where successful reservation payments triggered an email with the outdated "Pending Review" subject line. The PayMongo webhook now correctly triggers the "Status Updated" template, notifying clients that their order is "In Progress".
- **Email Receipt Calculation**: Updated the backend email parser to accurately append the 10% tax amount (`tax_amount`) to the base price before sending the email receipt. The receipt now perfectly matches the actual total charged on PayMongo (e.g., ₱1100 instead of ₱1000).

## 26. Final Ponytail Codebase Audit & Optimizations
- **DRY Refactoring (Payment Routes)**: Extracted 50 lines of heavily duplicated PayMongo session creation logic across the `checkout-final` and `checkout-reservation` routes into a single, clean `createPayMongoSession` helper function.
- **Node-Cron Eradication (Native Replacements)**: Uninstalled the third-party `node-cron` package and completely deleted `cronJobs.js`. Replaced the manual daily script loop with a native **MongoDB TTL (Time-To-Live) Index** on the `delete_requested_at` field, enabling the database to handle automatic account deletions securely and efficiently in the background.
- **Webhook Memory Optimization**: Isolated the `req.rawBody` parsing logic—necessary for PayMongo signature validation—so that it *strictly* executes on the `/api/payments/webhook` route. Removing this from the global `express.json()` middleware protects the broader application from potential Out-Of-Memory (OOM) exploits caused by large, arbitrary JSON payloads.
- **Deprecation Resolution**: Resolved a noisy Mongoose deprecation warning (`new: true`) across `findOneAndUpdate` calls by updating to the standardized MongoDB driver syntax (`returnDocument: 'after'`).

## 27. Cross-Platform PDF Rendering & Persistent GridFS Storage
- **MongoDB GridFS Migration**: Refactored the `orders.js` endpoints to upload all administrative order documents (Service Reports, Final Billing Quotations) directly into a MongoDB GridFS bucket (`order_files`). This completely replaces local disk storage, eliminating 404 errors caused by Render's ephemeral filesystem wipes during deployments or idle periods.
- **TOS Plain-Text Rendering (Ponytail Refactor)**: Removed the heavy `react-pdf` dependency and native `<object>` rendering for the Terms of Service modal. The application now dynamically fetches the plain-text TOS directly from the `/api/settings/tos` endpoint. This achieves 100% native mobile compatibility and circumvents `helmet` cross-origin iframe security headers with zero added bundle weight.

## 28. UX Improvements & Dependency Cleanup
- **Registration Flow:** Fixed an issue where duplicate username and email errors were merged into a single vague message, causing confusion. They now return specific validation errors.
- **Default Profile Pictures:** Added a local placeholder image (`default_profile.jpg`) for new registrations so users have a clean default avatar before uploading their own.
- **Dependency Cleanup:** Uninstalled completely unused frontend dependencies (`web-vitals` and `@fortawesome/fontawesome-free`) to keep `node_modules` lightweight.
## 29. Unavailable Dates Management
- **Administrative Control:** Implemented an "Unavailable Dates" manager in the Admin Settings panel (`AdminSettings.jsx`). Administrators can now selectively block specific dates (e.g., holidays, company teambuilding) with an optional reason, preventing clients from booking services on those days.
- **Client Calendar Integration:** Updated the `ClientCalendar.jsx` component to fetch and visually grey out these unavailable dates. The calendar correctly displays the blocked status and reason, disabling time slot selection.
- **Backend Validation:** Added the `UnavailableDate.js` Mongoose model and a new `/api/unavailable-dates` route. Reinforced the `/api/orders/submit` endpoint to perform a final validation check against the database, preventing any edge-case booking loopholes on blocked dates.

## 30. Order Rescheduling & Cancellation UI Updates
- **Cancellation Policy Warning:** Added a clear notice in the `OrderForm.jsx` reservation summary clarifying that cancellation requests do not guarantee a refund of the reservation fee.
- **Client Reschedule Modal UI:** Redesigned the client-side reschedule modal to use a stacked layout, optimizing vertical space to eliminate double scrollbars while keeping the calendar center-aligned.
- **Admin Visibility:** Enhanced `OrderDatabase.jsx` to surface "Client Additional Notes" in a read-only format directly within the manage order details view.
- **Admin Modal Standardization:** Replaced native browser `window.prompt` dialogs for Reschedule Rejections with a custom-styled React modal (Cleaneco Green header). Utilized `createPortal` to resolve z-index overlapping issues, ensuring the modal properly layers above the "Manage Order" side drawer.

## 31. Payment UI Standardization
- **Secure Payment Modal**: Updated the "Secure Payment" modal in `OngoingOrders.jsx` to perfectly match the design, layout, and glassmorphism styling of the "Pay Reservation" modal in the Order Form, ensuring a consistent checkout experience across the application.

## 32. UI Polish & PDF Viewer Enhancements
- **Footer Modernization**: Replaced basic emojis in the global footer with professional, scalable SVG icons using `lucide-react`, and applied precise flexbox alignment (`.footer-list`, `.contact-item`) for a cleaner, premium look.
- **Inline Terms of Service**: Refactored the TOS viewer in the registration modal to use an `<iframe>` instead of an `<object>` tag for native browser PDF rendering. Adjusted the backend `helmet` configuration (`contentSecurityPolicy: false`) to allow cross-origin iframe embedding, eliminating "localhost refused to connect" errors and removing the need for external tab fallbacks.

## 33. Phase 2: Hierarchical Quotations, Cheque Verification & Order Lifecycle Refinements
- **Direct Contact Cancellation & Failsafe Architecture**:
  - Removed self-service client quotation decline and arbitrary cancellation buttons to safeguard business commitments.
  - Implemented an informative cancellation notice directing clients to contact company dispatch directly (`046-447-03-54`) so administrators retain full authority to review, confirm, and mark cancellations in the database.
  - Added fail-safe logic ensuring that whenever an admin cancels an order, tentative inspection or service calendar holds are automatically released and revenue metrics update accurately.
- **Smart Reschedule Workflow (Inspection vs. Service Execution)**:
  - Distinct reschedule targets for Site Inspection vs. Service Execution with conditional lifecycle visibility.
  - The "Reschedule Inspection" button is strictly visible prior to quotation finalization, preventing redundant requests after inspection is concluded.
  - The "Reschedule Service Date" button is visible once execution schedules are assigned (until order completion or cancellation).
  - Redesigned the "Reschedule Service Date" button to strictly adhere to Cleaneco primary brand green (`#0D8D1E` via `.btn-outline-cleaneco`), fixing hover washout where the text previously blended into a white background.
  - Updated the Quotation Response confirmation modal to display a green success checkmark icon upon agreement submission.
- **Corporate Cheque Payment & MongoDB GridFS Verification**:
  - Introduced Cheque payment options for Commercial and Industrial clients across reservation fee and final payment modals.
  - Captures complete cheque metadata (Bank Name, Cheque Number, Account Name, Cheque Date) and streams image receipts directly to **MongoDB GridFS** for durable cloud persistence without relying on ephemeral server disk storage.
  - Integrated admin cheque verification tools within the Order Database to approve or reject submitted cheque payments.
- **Hierarchical Quotation & Scope of Works**:
  - Implemented structured quotation breakdown schemas with main deliverables, granular sub-items, technical justifications, and unit pricing.
  - Introduced quotation lifecycles (`Pending Inspection`, `Pending Client Approval`, `Clarification Requested`, `Approved`, `Client Declined`).
  - Integrated client acceptance modals that capture agreement, set execution date/time slots, and auto-update order states.
- **Printable Billing Templates & Formal Report Headers**:
  - Implemented `BillingTemplate.jsx` utilizing CSS `@media print` for browser-native invoice and billing statement generation without external runtime overhead.
  - Incorporated high-resolution company branding headers (`report_header.png`) in administrative data exports.
- **Client Profile & Name Formatting**:
  - Extended client profiles with account type segregation (`residential`, `commercial`, `industrial`) and company name attributes.
  - Added `formatName.js` utility ensuring proper display of commercial/industrial client records (`Client Name (Company Name)`).
  - Capitalized site accessibility descriptors across customer summaries ("Easy", "Moderate", "Challenging").
- **Cross-Domain Session & Production Resilience**:
  - Hardened `src/api/api.js` request interceptor to seamlessly check `localStorage` as a fallback whenever `sessionStorage` is empty, preventing accidental session drops during PayMongo cross-domain checkout redirects.
  - Cleaned dead references and unused compiler flags to guarantee clean, zero-warning production builds on Vercel.

## 34. Homepage & Service Page Asset Updates
- **Hero Carousel Refresh**: Updated the landing page hero carousel in `HomePage.jsx` to feature refreshed high-definition images (`updated_carousel1.jpg`, `updated_carousel2.jpg`, and `updated_carousel3.jpg`).
- **Our Services Cards**: Synchronized the service cards on the homepage to display the matching updated imagery for Siphoning/Desludging, Deep Cleaning, and Declogging.
- **Service Pages Hero Banners**: Updated `services.css` so that the dedicated service pages (`SiphoDeslud.jsx` and `DeepCleaning.jsx`) use the new image assets for their respective hero banner sections.

## 35. Real-Time Client/Admin Messaging Hub & Interactive Notifications
- **Integrated Communication Suite**:
  - Implemented full-stack messaging between clients and administrative staff via `ClientChatWidget.jsx`, `ClientMessages.jsx`, and `AdminMessages.jsx`.
  - Supports conversation threads tied to orders or general service inquiries, complete with unread badge indicators and real-time polling.
- **Interactive Notification Routing**:
  - Upgraded notification toasts so clicking a notification navigates directly to the target order and automatically opens the drawer to the relevant tab (`details`, `quotation`, `scheduling`, or `documents`).
- **Quotation Clarification Integration**:
  - Client clarification requests automatically generate and link into a dedicated message conversation thread, facilitating seamless negotiations.

## 36. Business Rules 1–4, Dynamic Fleet Availability & 2-Truck Auto-Pairing
- **Rule 1: High-Capacity & Trip Estimation**:
  - Implemented automatic trip calculation based on tank capacity and accessibility. Orders requiring 5 or more trips are automatically designated as **Whole-Day Lock orders** requiring deployment of 2 operational vacuum trucks.
- **Rule 2: Fleet Management & 2-Truck Auto-Pairing**:
  - Added operational status toggles in **Admin Settings** (`available` vs. `unavailable - maintenance`) for fleet management.
  - Automatically auto-pairs the two available operational trucks when managing high-capacity orders.
- **Rule 3: Quotation Clarification & Negotiation**:
  - Formalized the quotation clarification flow with real-time alerts and state transitions.
- **Rule 4: Client-Side Final Billing Report & PO Removal**:
  - Clients dynamically generate and print official itemized Final Billing Statements with electronic signatures, eliminating redundant administrative quotation uploads.
- **UI Currency Formatting**: Standardized currency symbols (`₱`) across all admin calendar tools and order management dashboards.

## 37. Automated Forgot & Reset Password Flow with Cryptographic Security
- **Token Security & Cryptographic Hashing**:
  - Generates 256-bit cryptographic tokens via Node's `crypto.randomBytes(32)`.
  - In line with OWASP security recommendations, tokens are **hashed with SHA-256** prior to database insertion in MongoDB (`User.resetPasswordToken`) with a sparse index and strict 1-hour expiration timestamp.
  - Username queries are sanitized against regex special characters to prevent ReDoS.
- **Cloud Email Dispatch**:
  - Delivers branded password reset templates via cloud **EmailJS** (`template_ns5zlcs`) with dynamic production URL resolution (`https://cleaneco-kappa.vercel.app/reset-password?token=...`).
- **Account Recovery & Audit Trail**:
  - Resetting passwords hashes inputs via bcrypt (10 rounds), resets failed login attempts (`loginAttempts: 0`), clears lockout flags, and writes an in-app audit notification.
- **Unified UI**:
  - Polished Forgot Password modal in `Login.jsx` matching system design tokens, and created dedicated `ResetPassword.jsx` page with accessible form controls and password visibility toggles.

## 38. Admin Order State Normalization & Bug Resolution
- **Centralized Order Pipeline (`processGroupedOrders`)**:
  - Refactored 5 fragmented and duplicated `.reduce()` mutations in `OrderDatabase.jsx` into a centralized, top-level pure function.
  - Resolved the bug where confirming an inspection schedule wiped out `service_ids` in React state, restoring immediate rendering of the Quotation Builder cards without requiring manual browser reloads.
  - Added defensive fallback logic in `openEditModal` and the Quotation tab render.

## 39. Government Compliance Expansion: PCAPI R4A Accreditation
- **PCAPI R4A Integration**:
  - Added the **Pollution Control Association of the Philippines (PCAPI Region IV-A Chapter)** accreditation card to `Resources.jsx`, highlighting Cleaneco's commitment to continuous accredited DENR-EMB training for Pollution Control Officers.
- **Responsive 4-Column Layout**:
  - Upgraded compliance cards to `col-lg-3 col-md-6 mb-4`, rendering 4 side-by-side cards on desktop, an even 2×2 grid on tablets/half-screen, and a single column on mobile.
- **Equalized CSS Baselines**:
  - Enforced normalized logo image constraints (`height: 75px; object-fit: contain;`) and flexbox heading alignments (`min-height: 3.2rem;`) in `resources.css` for visual harmony.

## 40. Dynamic Admin-Configurable Service Pricing Engine & Modal UX Refinement
- **Dynamic Pricing Engine & Snapshots**:
  - Replaced hardcoded service calculators with a database-driven, configurable pricing engine ([`backend/utils/pricing.js`](file:///c:/xampp/firstapp/backend/utils/pricing.js) and [`src/utils/pricing.js`](file:///c:/xampp/firstapp/src/utils/pricing.js)).
  - **Factor Types Supported**:
    - **Number Multipliers**: Direct numeric inputs (e.g., number of septic tanks or grease traps) with customizable minimum constraints and trip-counting options.
    - **Dropdown Multipliers**: Configurable options with custom factors (e.g., standard residential vs. large commercial tank capacity).
    - **Dropdown Surcharges**: Configurable fee add-ons (e.g., difficult site accessibility requiring long extension hoses) with optional photo upload flags.
  - **Permanent Pricing Snapshot (`pricing_snapshot`)**:
    - Stores an immutable snapshot of exact rates, factors, and surcharges within the order document at booking time. Future rate or factor edits in Service Management will never alter historical orders.
  - **Shared Component Decomposition ([`ServicePricingFields.jsx`](file:///c:/xampp/firstapp/src/components/ServicePricingFields.jsx))**:
    - Reusable UI component powering dynamic questionnaires across the Client Order Form (`OrderForm.jsx`), Admin Quotation Editor (`OrderDatabase.jsx`), and Client Ongoing Orders view (`OngoingOrders.jsx`).
- **Interactive Quotation & Inspection Factor Editor**:
  - Administrators can review and adjust dynamic factors directly in the **Quotation Tab** of `OrderDatabase.jsx`, with auto-calculated subtotals, factor justifications, and live discount recalculations.
- **Service Management Modal & UX Polish ([`ServiceManagement.jsx`](file:///c:/xampp/firstapp/src/components/ServiceManagement.jsx))**:
  - **Layout & Scrolling**: Fixed modal element widths and border alignment across all sections, standardized internal scrollable containers, and added sticky header/footer actions.
  - **Input Sanitization**: Eliminated field key collisions, sanitized option values, resolved leading-zero input handling on currency fields, and aligned delete actions with custom checkboxes.
- **Service Deletion Guard**:
  - Implemented backend protection in `backend/routes/services.js` that blocks deletion of any service referenced by existing orders, prompting administrators to mark it as "Unavailable" instead to preserve order history integrity.

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
