import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import AboutUs from './pages/AboutUs';
import Resources from './pages/Resources';
import SiphoDeslud from './pages/SiphoDeslud';
import DeepCleaning from './pages/DeepCleaning';
import Register from './pages/Register';
import Login from './pages/Login';
import VerifyEmail from './pages/VerifyEmail';
import ResetPassword from './pages/ResetPassword';
import OrderForm from './pages/OrderForm';
import OngoingOrders from './pages/OngoingOrders';
import ThankYou from './pages/ThankYou';
import PaymentSuccess from './pages/PaymentSuccess';
import PaymentCancel from './pages/PaymentCancel';
import AdminLanding from './pages/AdminLanding';
import OrderDatabase from './pages/OrderDatabase';
import ServiceManagement from './components/ServiceManagement';
import AdminUsers from './pages/AdminUsers';
import AdminSettings from './pages/AdminSettings';
import AdminLayout from './components/AdminLayout';

import AdminProfile from './pages/AdminProfile';
import ClientProfile from './pages/ClientProfile';
import ContactUs from './pages/ContactUs';
import AdminMessages from './pages/AdminMessages';
import ClientMessages from './pages/ClientMessages';
import ClientChatWidget from './components/ClientChatWidget';
import { ConfirmProvider } from './context/ConfirmContext';

function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    const timer = setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }, 50);
    return () => clearTimeout(timer);
  }, [pathname, search]);

  return null;
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <ConfirmProvider>
        <Header />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/client" element={<HomePage />} />
          <Route path="/client/profile" element={<ClientProfile />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/contact" element={<ContactUs />} />
          <Route path="/client/contact" element={<ContactUs />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/services/siphoning-desludging" element={<SiphoDeslud />} />
          <Route path="/client/services/siphoning-desludging" element={<SiphoDeslud />} />
          <Route path="/services/deep-cleaning-declogging" element={<DeepCleaning />} />
          <Route path="/client/services/deep-cleaning-declogging" element={<DeepCleaning />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify" element={<VerifyEmail />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/login" element={<Login />} />
          <Route path="/order" element={<OrderForm />} />
          <Route path="/orders" element={<OngoingOrders />} />
          <Route path="/messages" element={<ClientMessages />} />
          <Route path="/client/messages" element={<ClientMessages />} />
          <Route path="/thank-you" element={<ThankYou />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/payment-cancel" element={<PaymentCancel />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminLanding />} />
            <Route path="profile" element={<AdminProfile />} />
            <Route path="messages" element={<AdminMessages />} />
            <Route path="orders" element={<OrderDatabase />} />
            <Route path="services" element={<ServiceManagement />} />
            <Route path="order-form" element={<OrderForm />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Footer />
        <ClientChatWidget />
      </ConfirmProvider>
    </BrowserRouter>
  );
}

export default App;