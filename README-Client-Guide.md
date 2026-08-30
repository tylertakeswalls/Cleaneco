# Cleaneco Waste Management Services - Client Usage Guide

Welcome to the **Cleaneco Waste Management Services** web platform! This guide is designed to help you and your users understand how to navigate the site, book services, manage orders, and understand the core features available.

---

## 📋 Table of Contents
1. [Overview](#overview)
2. [User Account & Authentication](#user-account--authentication)
3. [Exploring Services](#exploring-services)
4. [The Booking Process](#the-booking-process)
5. [Client Dashboard](#client-dashboard)
6. [Administrator Features](#administrator-features)
7. [Third-Party API Integrations](#third-party-api-integrations)

---

## 1. Overview
The Cleaneco platform is a complete booking and management system. It allows clients to browse services (Deep Cleaning, Siphoning, and Desludging), create an account, book appointments securely online, and track their service statuses.

---

## 2. User Account & Authentication
To access the booking features, clients must have a verified account.

- **Registration:** Clients can sign up by providing their basic details (Name, Email, Phone, Address). 
- **Email Verification:** Upon registration, an automated email is sent to the client's email address with a verification link. They must click this link to activate their account. *(Powered by Nodemailer API)*
- **Login:** Once verified, clients can securely log in using their credentials.

---

## 3. Exploring Services
Clients can browse the available services from the homepage and dedicated service pages:
- **Deep Cleaning:** Detailed information about deep cleaning solutions.
- **Siphoning & Desludging:** Information on specialized waste management services.
Clients can view pricing, details, and directly start a booking from these pages.

---

## 4. The Booking Process
Booking a service is streamlined and user-friendly.

1. **Select Service:** Clients choose the services they need.
2. **Choose Schedule:** Clients select their preferred **Date** and **Time Slot** for the service.
3. **Provide Details:** Clients review their contact information, service address, and can add additional notes or a site photo if necessary.
4. **Checkout & Payment:** 
   - The platform calculates the total estimate based on the selected services.
   - Clients are redirected to a secure payment gateway to complete their transaction online. *(Powered by Paymongo API)*
5. **Confirmation:** Once payment is successful, the client receives an automated **Order Confirmation Email** detailing their booking.

---

## 5. Client Dashboard
After logging in, clients have access to their personal dashboard where they can:
- **View Ongoing Orders:** Track the real-time status of their bookings (e.g., *Pending, In Progress, Completed, Cancelled*).
- **Manage Profile:** Update personal information, contact details, and address.
- **Order History:** View past services and payments.

When an administrator updates the status of an order, the client will automatically receive an **Order Status Update Email**.

---

## 6. Administrator Features
For the site owners and staff, there is a dedicated Admin portal:
- **Order Database:** View, manage, and update the status of all client bookings in one centralized database.
- **User Management:** View registered clients and manage system access.
- **Admin Settings:** Configure site preferences and admin profile details.

---

## 7. Third-Party API Integrations
The platform utilizes secure and reliable third-party APIs to handle complex functionalities:

### ✉️ Email Communications (Nodemailer API)
- **What it does:** Handles all automated email sending from the system.
- **Usage:** It sends the Account Verification emails when a user signs up, the Order Confirmation receipts when a booking is made, and the Status Update alerts when an admin changes an order's status.

### 💳 Secure Online Payments (Paymongo API)
- **What it does:** A Philippine-based payment gateway that securely processes online transactions.
- **Usage:** When a client finalizes their booking, Paymongo handles the sensitive payment data, allowing clients to pay via E-wallets (GCash, Maya), Credit/Debit Cards, or online banking without the site having to store sensitive financial information directly.
