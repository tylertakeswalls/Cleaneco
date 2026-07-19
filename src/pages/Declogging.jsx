import { Link } from 'react-router-dom';
import '../assets/styles/services.css';
import { useRef } from 'react';

function Declogging() {
  const isLoggedIn = !!sessionStorage.getItem('loggedInUser');
  const bookLink = isLoggedIn ? '/order' : '/register';
  const container = useRef();
  
  return (
    <div ref={container}>
      {/* hero section for declogging service */}
      <section className="service-hero" data-service="declogging">
        <div className="content">
          <h1 className="display-4 font-weight-bold">Declogging Services</h1>
          <p className="lead">Fast, reliable declogging to restore the smooth flow and freshness of your plumbing system.</p>
          <Link to={bookLink} className="btn btn-custom mt-3">Book Now</Link>
        </div>
      </section>

      {/* service benefits and features section */}
      <section className="info-section text-center">
        <div className="container">
          <h2 className="intro-title mb-4">Why Choose Our Declogging Services?</h2>
          <p className="intro-text">
            Cleaneco provides fast and efficient declogging for residential, commercial, and industrial clients. We use modern tools and eco-friendly methods to clear blockages and restore your system's optimal flow.
          </p>

          {/* service feature cards */}
          <div className="row mt-5">
            <div className="col-md-4 mb-4">
              <div className="info-card glass-card p-4 rounded-4 h-100">
                <h4>✔ Advanced Tools</h4>
                <p>We utilize high-pressure water jets and vacuum pumps to effectively remove clogs without damaging pipes.</p>
              </div>
            </div>
            <div className="col-md-4 mb-4">
              <div className="info-card glass-card p-4 rounded-4 h-100">
                <h4>✔ Expert Technicians</h4>
                <p>Our trained professionals handle all types of drainage issues, from kitchen sinks to main sewer lines.</p>
              </div>
            </div>
            <div className="col-md-4 mb-4">
              <div className="info-card glass-card p-4 rounded-4 h-100">
                <h4>✔ Safe & Eco-Friendly</h4>
                <p>We use non-toxic and eco-safe cleaning solutions, ensuring your health and the environment are protected.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* service process and workflow section */}
      <section className="how-it-works text-center my-5">
        <div className="container">
          <h2 className="intro-title mb-4">How It Works</h2>
          <div className="steps-wrapper">
            {/* step 1: inspection */}
            <div className="step glass-panel p-4 rounded-4 m-2">
              <div className="step-number">1</div>
              <h5>Inspection</h5>
              <p>We inspect your drainage or pipeline system using advanced tools to locate clogs and blockages.</p>
            </div>
            {/* step 2: preparation */}
            <div className="step glass-panel p-4 rounded-4 m-2">
              <div className="step-number">2</div>
              <h5>Preparation</h5>
              <p>We prepare all necessary equipment and safety measures for a smooth and efficient declogging process.</p>
            </div>
            {/* step 3: declogging process */}
            <div className="step glass-panel p-4 rounded-4 m-2">
              <div className="step-number">3</div>
              <h5>Declogging</h5>
              <p>Our team uses pressure jets or vacuum pumps to clear all debris and buildup within the pipes.</p>
            </div>
            {/* step 4: quality check */}
            <div className="step glass-panel p-4 rounded-4 m-2">
              <div className="step-number">4</div>
              <h5>Final Check</h5>
              <p>We test your system to ensure complete water flow and confirm that all blockages are removed.</p>
            </div>
          </div>
          <Link to={bookLink} className="btn btn-custom mt-4">Schedule a Declogging</Link>
        </div>
      </section>
    </div>
  );
}

export default Declogging;