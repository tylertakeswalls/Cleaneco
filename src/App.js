import { BrowserRouter, Routes, Route } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import HomePageClient from './pages/HomePageClient';
import AboutUs from './pages/AboutUs';
import Resources from './pages/Resources';
import SiphoDeslud from './pages/SiphoDeslud';
import SiphoDesludClient from './pages/SiphoDesludClient';
import DeepCleaning from './pages/DeepCleaning';
import DeepCleaningClient from './pages/DeepCleaningClient';
import Declogging from './pages/Declogging';
import DecloggingClient from './pages/DecloggingClient';
import Register from './pages/Register';
import Login from './pages/Login';
import OrderForm from './pages/OrderForm';
import OngoingOrders from './pages/OngoingOrders';
import ThankYou from './pages/ThankYou';
import AdminLanding from './pages/AdminLanding';
import OrderDatabase from './pages/OrderDatabase';
import ServiceManagement from './components/ServiceManagement';
import AdminUsers from './pages/AdminUsers';


function App() {
  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/client" element={<HomePageClient />} />
        <Route path="/about" element={<AboutUs />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/services/siphoning-desludging" element={<SiphoDeslud />} />
        <Route path="/client/services/siphoning-desludging" element={<SiphoDesludClient />} />
        <Route path="/services/deep-cleaning" element={<DeepCleaning />} />
        <Route path="/client/services/deep-cleaning" element={<DeepCleaningClient />} />
        <Route path="/services/declogging" element={<Declogging />} />
        <Route path="/client/services/declogging" element={<DecloggingClient />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/order" element={<OrderForm />} />
        <Route path="/orders" element={<OngoingOrders />} />
        <Route path="/thank-you" element={<ThankYou />} />
        <Route path="/admin" element={<AdminLanding />} />
        <Route path="/admin/orders" element={<OrderDatabase />} />
        <Route path="/admin/services" element={<ServiceManagement />} />
        <Route path="/admin/order-form" element={<OrderForm />} />
        <Route path="/admin/users" element={<AdminUsers />} />

      </Routes>
      <Footer />
    </BrowserRouter>
  );
}

export default App;