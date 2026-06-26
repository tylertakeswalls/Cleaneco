import { Link } from 'react-router-dom';
import '../assets/styles/services.css';

function DeepCleaning() {
  return (
    <div>
      {/* hero section for deep cleaning service */}
      <section className="service-hero" data-service="deepcleaning">
        <div className="content">
          <h1 className="display-4 font-weight-bold">Deep Cleaning Services</h1>
          <p className="lead">Experience spotless, sanitized spaces with Cleaneco's professional deep cleaning solutions — safe, efficient, and eco-friendly.</p>
          {/* call-to-action button for new users to register and book */}
          <Link to="/register" className="btn btn-custom mt-3">Book Now</Link>
        </div>
      </section>

      {/* service benefits and value proposition section */}
      <section className="info-section text-center">
        <div className="container">
          <h2 className="intro-title mb-4">Why Choose Our Deep Cleaning Services?</h2>
          <p className="intro-text">
            Cleaneco's Deep Cleaning Services go beyond the surface, targeting hidden dirt, grime, and bacteria to create a safer and healthier environment. 
            Perfect for homes, offices, and commercial spaces.
          </p>

          {/* key service features and advantages */}
          <div className="row mt-5">
            <div className="col-md-4 mb-4">
              <div className="info-card">
                <h4>✔ Advanced Equipment</h4>
                <p>We use industry-grade cleaning tools and eco-safe products to ensure a thorough and deep clean without damaging surfaces.</p>
              </div>
            </div>
            <div className="col-md-4 mb-4">
              <div className="info-card">
                <h4>✔ Trained Professionals</h4>
                <p>Our cleaning experts are skilled in handling all types of spaces, maintaining the highest standards of hygiene and sanitation.</p>
              </div>
            </div>
            <div className="col-md-4 mb-4">
              <div className="info-card">
                <h4>✔ Safe & Eco-Friendly</h4>
                <p>We use biodegradable and non-toxic cleaning agents to protect your family, staff, and the environment.</p>
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
            {/* step 1: initial assessment */}
            <div className="step">
              <div className="step-number">1</div>
              <h5>Inspection</h5>
              <p>We inspect your space to identify problem areas and determine the cleaning requirements.</p>
            </div>
            {/* step 2: setup and preparation */}
            <div className="step">
              <div className="step-number">2</div>
              <h5>Preparation</h5>
              <p>We move or protect furniture, set up cleaning tools, and prepare eco-safe cleaning solutions.</p>
            </div>
            {/* step 3: main cleaning operation */}
            <div className="step">
              <div className="step-number">3</div>
              <h5>Deep Cleaning</h5>
              <p>Our team cleans every corner — including hard-to-reach spots, tiles, upholstery, and air vents.</p>
            </div>
            {/* step 4: quality assurance */}
            <div className="step">
              <div className="step-number">4</div>
              <h5>Final Inspection</h5>
              <p>We ensure everything is spotless and sanitized before finishing the service to guarantee satisfaction.</p>
            </div>
          </div>
          {/* secondary call-to-action for scheduling service */}
          <Link to="/register" className="btn btn-custom mt-4">Schedule a Cleaning</Link>
        </div>
      </section>
    </div>
  );
}

export default DeepCleaning;