import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { CheckCircle2, Phone, Mail, Clock } from 'lucide-react';
import api from '../api/api';

function Footer() {
  const location = useLocation();
  const [services, setServices] = useState([]);

  useEffect(() => {
    let isMounted = true;
    api.get('/services')
      .then(res => {
        if (isMounted && Array.isArray(res.data)) {
          const active = res.data.filter(s => s.status !== 'suspended' && s.status !== 'unavailable');
          if (active.length > 0) {
            setServices(active);
          }
        }
      })
      .catch(() => {
        // Silently preserve initial fallback on network errors
      });

    return () => { isMounted = false; };
  }, []);

  if (location.pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <footer className="footer-custom">
      <div className="footer-container">
        <div className="footer-section">
          <h4>About Us</h4>
          <p>
            CLEANECO is a trusted provider of fast, efficient, and compliant waste management solutions. 
            We specialize in siphoning, declogging, desludging, and grease trap cleaning for residential, 
            commercial, and industrial clients.
          </p>
          <p>
            Committed to health, safety, and the environment, we operate 
            24/7 to ensure clean, sustainable communities always in compliance with LGU, DENR, and DOH standards.
          </p>
        </div>

        <div className="footer-section">
          <h4>Our Services</h4>
          <ul className="footer-list">
            {services.length > 0 ? (
              services.map(service => (
                <li key={service._id || service.id || service.name}>
                  <CheckCircle2 size={18} /> {service.name}
                </li>
              ))
            ) : (
              <>
                <li><CheckCircle2 size={18} /> Siphoning & Desludging</li>
                <li><CheckCircle2 size={18} /> Deep Cleaning</li>
                <li><CheckCircle2 size={18} /> Declogging</li>
                <li><CheckCircle2 size={18} /> Grease Trap Cleaning</li>
              </>
            )}
          </ul>
        </div>

        <div className="footer-section">
          <h4>Why Us?</h4>
          <p>For over 30 years, CLEANECO has been a
            trusted name in professional septic tank
            care serving both residential and
            industrial clients across the region.
          </p>
          <ul className="footer-list">
            <li><CheckCircle2 size={18} /> DENR & DOH Compliant</li>
            <li><CheckCircle2 size={18} /> Residential & Industrial Expertise</li>
            <li><CheckCircle2 size={18} /> Fast & reliable, 24/7 service</li>
            <li><CheckCircle2 size={18} /> Eco-Friendly Operations</li>
          </ul>
        </div>

        <div className="footer-section" id="Emergency">
          <h4>Contact Info</h4>
          <p>Addas Greenfields, Mambog 4, Bacoor, Philippines</p>
          <p className="contact-item"><Phone size={18} className="flex-shrink-0" /> <span>046-447-03-54</span></p>
          <p className="contact-item"><Mail size={18} className="flex-shrink-0" /> <span>cleaneco@cwms.com.ph</span></p>
          <p className="contact-item"><Clock size={18} className="flex-shrink-0" /> <span>Mon–Sun: 8:00 AM – 9:00 PM</span></p>
        </div>
      </div>

      <div className="footer-bottom">
        <p>© 2026 CLEANECO. ALL RIGHTS RESERVED.</p>
      </div>
    </footer>
  );
}

export default Footer;