import { BrowserRouter, Routes, Route } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import AboutUs from './pages/AboutUs';
import Resources from './pages/Resources';
import SiphoDeslud from './pages/SiphoDeslud';
import DeepCleaning from './pages/DeepCleaning';
import Declogging from './pages/Declogging';
import Register from './pages/Register';
import Login from './pages/Login';
import VerifyEmail from './pages/VerifyEmail';
import OrderForm from './pages/OrderForm';
import OngoingOrders from './pages/OngoingOrders';
import ThankYou from './pages/ThankYou';
import AdminLanding from './pages/AdminLanding';
import OrderDatabase from './pages/OrderDatabase';
import ServiceManagement from './components/ServiceManagement';
import AdminUsers from './pages/AdminUsers';
import AdminSettings from './pages/AdminSettings';
import AdminLayout from './components/AdminLayout';

import AdminProfile from './pages/AdminProfile';
import ClientProfile from './pages/ClientProfile';

function App() {
  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/client" element={<HomePage />} />
        <Route path="/client/profile" element={<ClientProfile />} />
        <Route path="/about" element={<AboutUs />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/services/siphoning-desludging" element={<SiphoDeslud />} />
        <Route path="/client/services/siphoning-desludging" element={<SiphoDeslud />} />
        <Route path="/services/deep-cleaning" element={<DeepCleaning />} />
        <Route path="/client/services/deep-cleaning" element={<DeepCleaning />} />
        <Route path="/services/declogging" element={<Declogging />} />
        <Route path="/client/services/declogging" element={<Declogging />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify" element={<VerifyEmail />} />
        <Route path="/login" element={<Login />} />
        <Route path="/order" element={<OrderForm />} />
        <Route path="/orders" element={<OngoingOrders />} />
        <Route path="/thank-you" element={<ThankYou />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminLanding />} />
          <Route path="profile" element={<AdminProfile />} />
          <Route path="orders" element={<OrderDatabase />} />
          <Route path="services" element={<ServiceManagement />} />
          <Route path="order-form" element={<OrderForm />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

      </Routes>
      <Footer />
    </BrowserRouter>
  );
}

export default App;