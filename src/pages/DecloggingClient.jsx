import { Link } from 'react-router-dom';
import '../assets/styles/services.css';

function DecloggingClient() {
  return (
    <div>
      {/* hero section for declogging service - client version */}
      <section className="service-hero" data-service="declogging">
        <div className="content">
          <h1 className="display-4 font-weight-bold">Declogging Services</h1>
          <p className="lead">Fast, reliable declogging to restore the smooth flow and freshness of your plumbing system.</p>
          {/* links to order page instead of register for logged-in clients */}
          <Link to="/order" className="btn btn-custom mt-3">Book Now</Link>
        </div>
      </section>

      {/* service benefits section for client users */}
      <section className="info-section text-center">
        <div className="container">
          <h2 className="intro-title mb-4">Why Choose Our Declogging Services?</h2>
          <p className="intro-text">
            Cleaneco provides fast and efficient declogging for residential, commercial, and industrial clients. We use modern tools and eco-friendly methods to clear blockages and restore your system's optimal flow.
          </p>

          {/* service feature cards showing key advantages */}
          <div className="row mt-5">
            <div className="col-md-4 mb-4">
              <div className="info-card">
                <h4>✔ Advanced Tools</h4>
                <p>We utilize high-pressure water jets and vacuum pumps to effectively remove clogs without damaging pipes.</p>
              </div>
            </div>
            <div className="col-md-4 mb-4">
              <div className="info-card">
                <h4>✔ Expert Technicians</h4>
                <p>Our trained professionals handle all types of drainage issues, from kitchen sinks to main sewer lines.</p>
              </div>
            </div>
            <div className="col-md-4 mb-4">
              <div className="info-card">
                <h4>✔ Safe & Eco-Friendly</h4>
                <p>We use non-toxic and eco-safe cleaning solutions, ensuring your health and the environment are protected.</p>
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
            {/* step 1: initial inspection process */}
            <div className="step">
              <div className="step-number">1</div>
              <h5>Inspection</h5>
              <p>We inspect your drainage or pipeline system using advanced tools to locate clogs and blockages.</p>
            </div>
            {/* step 2: equipment preparation */}
            <div className="step">
              <div className="step-number">2</div>
              <h5>Preparation</h5>
              <p>We prepare all necessary equipment and safety measures for a smooth and efficient declogging process.</p>
            </div>
            {/* step 3: main declogging operation */}
            <div className="step">
              <div className="step-number">3</div>
              <h5>Declogging</h5>
              <p>Our team uses pressure jets or vacuum pumps to clear all debris and buildup within the pipes.</p>
            </div>
            {/* step 4: final verification and testing */}
            <div className="step">
              <div className="step-number">4</div>
              <h5>Final Check</h5>
              <p>We test your system to ensure complete water flow and confirm that all blockages are removed.</p>
            </div>
          </div>
          {/* call-to-action button for logged-in clients to schedule service */}
          <Link to="/order" className="btn btn-custom mt-4">Schedule a Declogging</Link>
        </div>
      </section>
    </div>
  );
}

export default DecloggingClient;