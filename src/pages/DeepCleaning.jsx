import { Link } from 'react-router-dom';
import '../assets/styles/services.css';
import { useRef } from 'react';

function DeepCleaning() {
  const isLoggedIn = !!sessionStorage.getItem('loggedInUser');
  const bookLink = isLoggedIn ? '/order' : '/register';
  const container = useRef();
  
  return (
    <div ref={container}>
      {/* hero section */}
      <section className="service-hero" data-service="deepcleaning">
        <div className="content">
          <h1 className="display-4 font-weight-bold">Deep Cleaning & Declogging</h1>
          <p className="lead">Experience spotless, sanitized spaces and fast, reliable declogging to restore the smooth flow of your plumbing system.</p>
          <Link to={bookLink} className="btn btn-custom mt-3">Book Now</Link>
        </div>
      </section>

      {/* service benefits and value proposition section */}
      <section className="info-section text-center">
        <div className="container">
          <h2 className="intro-title mb-4">Why Choose Our Deep Cleaning & Declogging?</h2>
          <p className="intro-text">
            Cleaneco provides manual removal of garbage, mud, grease, and solid wastes inside your septic tanks, chipping of walls to make them good as new, and efficient declogging for optimal flow.
          </p>

          <div className="row mt-5">
            <div className="col-md-4 mb-4">
              <div className="info-card glass-card p-4 rounded-4 h-100">
                <h4>✔ Advanced Equipment</h4>
                <p>We utilize high-pressure water jets, vacuum pumps, and industry-grade cleaning tools for a thorough clean without damaging pipes.</p>
              </div>
            </div>
            <div className="col-md-4 mb-4">
              <div className="info-card glass-card p-4 rounded-4 h-100">
                <h4>✔ Expert Technicians</h4>
                <p>Our trained professionals handle all types of drainage issues and hidden grime, maintaining the highest standards of hygiene.</p>
              </div>
            </div>
            <div className="col-md-4 mb-4">
              <div className="info-card glass-card p-4 rounded-4 h-100">
                <h4>✔ Safe & Eco-Friendly</h4>
                <p>We use biodegradable, non-toxic, and eco-safe products to protect your health, your staff, and the environment.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* service process and workflow explanation */}
      <section className="how-it-works text-center my-5">
        <div className="container">
          <h2 className="intro-title mb-4">How It Works</h2>
          <div className="steps-wrapper">
            <div className="step glass-panel p-4 rounded-4 m-2">
              <div className="step-number">1</div>
              <h5>Inspection</h5>
              <p>We inspect your septic tanks and pipeline systems to identify blockages and determine cleaning requirements.</p>
            </div>
            <div className="step glass-panel p-4 rounded-4 m-2">
              <div className="step-number">2</div>
              <h5>Preparation</h5>
              <p>We prepare all necessary equipment, eco-safe cleaning solutions, and safety measures for an efficient process.</p>
            </div>
            <div className="step glass-panel p-4 rounded-4 m-2">
              <div className="step-number">3</div>
              <h5>Deep Cleaning & Declogging</h5>
              <p>Our team manually removes solid wastes, chips walls to restore them, and uses pressure jets to clear all pipe debris.</p>
            </div>
            <div className="step glass-panel p-4 rounded-4 m-2">
              <div className="step-number">4</div>
              <h5>Final Verification</h5>
              <p>We test your system to ensure complete water flow and a spotless, sanitized environment before finishing.</p>
            </div>
          </div>
          <Link to={bookLink} className="btn btn-custom mt-4">Schedule a Service</Link>
        </div>
      </section>
    </div>
  );
}

export default DeepCleaning;