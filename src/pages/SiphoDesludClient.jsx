import { Link } from 'react-router-dom';
import '../assets/styles/services.css';

function SiphoDesludClient() {
  return (
    <div>
      {/* hero section for siphoning and desludging service - client version */}
      <section className="service-hero" data-service="siphoning">
        <div className="content">
          <h1 className="display-4 font-weight-bold">Siphoning & Desludging Services</h1>
          <p className="lead">Professional, eco-friendly, and DOH-DENR compliant waste management for every property type.</p>
          {/* book now button links directly to order page for logged-in clients */}
          <Link to="/order" className="btn btn-custom mt-3">Book Now</Link>
        </div>
      </section>

      {/* service benefits section for authenticated clients */}
      <section className="info-section text-center">
        <div className="container">
          <h2 className="intro-title mb-4">Why Choose Our Siphoning & Desludging Services?</h2>
          <p className="intro-text">
            Our siphoning and desludging solutions ensure proper sanitation and maintain the efficiency of your septic system. 
            Cleaneco's team of professionals is equipped with high-powered vacuum trucks to safely handle sludge, grease, and wastewater, 
            keeping your environment clean and odor-free.
          </p>

          {/* service feature cards highlighting key advantages for clients */}
          <div className="row mt-5">
            <div className="col-md-4 mb-4">
              <div className="info-card">
                <h4>✔ Professional Equipment</h4>
                <p>We use industrial-grade vacuum trucks designed for fast and complete sludge extraction from septic tanks and grease traps.</p>
              </div>
            </div>
            <div className="col-md-4 mb-4">
              <div className="info-card">
                <h4>✔ Health & Safety Compliance</h4>
                <p>All operations comply with LGU, DENR, and DOH regulations to ensure safe, sanitary, and eco-friendly waste disposal.</p>
              </div>
            </div>
            <div className="col-md-4 mb-4">
              <div className="info-card">
                <h4>✔ Fast & Reliable Service</h4>
                <p>Our team operates 24/7 to provide quick response times, ensuring minimal disruption to your household or business operations.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* service process workflow for client users */}
      <section className="how-it-works text-center my-5">
        <div className="container">
          <h2 className="intro-title mb-4">How It Works</h2>
          <div className="steps-wrapper">
            {/* step 1: initial system assessment */}
            <div className="step">
              <div className="step-number">1</div>
              <h5>Inspection</h5>
              <p>We assess your septic tank or grease trap's capacity and current sludge level to determine the right service approach.</p>
            </div>
            {/* step 2: waste extraction process */}
            <div className="step">
              <div className="step-number">2</div>
              <h5>Extraction</h5>
              <p>Our industrial vacuum trucks efficiently remove all sludge, grease, and wastewater without contaminating the surroundings.</p>
            </div>
            {/* step 3: compliant waste disposal */}
            <div className="step">
              <div className="step-number">3</div>
              <h5>Transport & Disposal</h5>
              <p>All collected waste is safely transported to a DENR-accredited treatment and disposal facility following eco-compliance protocols.</p>
            </div>
            {/* step 4: ongoing maintenance planning */}
            <div className="step">
              <div className="step-number">4</div>
              <h5>Cleaning & Maintenance</h5>
              <p>We provide regular maintenance schedules to help prolong the efficiency of your septic system and avoid future problems.</p>
            </div>
          </div>
          {/* call-to-action for clients to schedule siphoning service */}
          <Link to="/order" className="btn btn-custom mt-4">Schedule a Service</Link>
        </div>
      </section>
    </div>
  );
}

export default SiphoDesludClient;