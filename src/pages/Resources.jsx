import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../assets/styles/resources.css';
import { Accordion } from 'react-bootstrap';
import doh from '../assets/styles/images/doh.png';
import denr from '../assets/styles/images/denr.png';
import lgu from '../assets/styles/images/lgu.png';
import faq from '../assets/styles/images/faq3.png';

function Resources() {
  // state for search functionality
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  // handle search form submission with navigation
  const handleSearch = (e) => {
    e.preventDefault();
    const query = searchQuery.trim().toLowerCase();

    // route to appropriate pages based on search terms
    if (query.includes('declog')) {
      navigate('/services/declogging');
    } else if (query.includes('siphon') || query.includes('desludging')) {
      navigate('/services/siphoning-desludging');
    } else if (query.includes('deep')) {
      navigate('/services/deep-cleaning');
    } else if (query.includes('history')) {
      navigate('/about');
    } else if (query.includes('location')) {
      navigate('/map-location');
    } else {
      alert("No results found for '" + query + "'. Please try searching for 'declogging', 'siphoning', or 'deep cleaning'.");
    }
  };

  // handle enter key press for search
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch(e);
    }
  };

  return (
    <main className="container my-5">
      {/* page header section */}
      <header className="page-hero text-center mb-5">
        <h2 className="intro-title">FAQs & Compliance</h2>
        <p className="lead text-secondary">
          Find quick answers to your questions and view the government compliance that keeps our services trusted and reliable.
        </p>
      </header>

      {/* government compliance section */}
      <section id="compliance" className="mb-5">
        <h2 className="section-title text-center">Government Compliance & Accreditation</h2>
        <p className="text-center lead text-muted mb-4">
          We strictly adhere to the highest standards set by national and local government units to ensure our waste management practices are safe, legal, and environmentally responsible.
        </p>
        <div className="row">
          {/* denr compliance box */}
          <div className="col-md-4 mb-4">
            <div className="compliance-logo-box">
              <img src={denr} alt="DENR Logo" className="img-fluid" />
              <h4 className="text-success font-weight-bold mb-3">Department of Environment and Natural Resources (DENR)</h4>
              <p className="text-muted small mb-0">
                Our compliance with DENR standards ensures that all sewage, septage, and hazardous wastes are properly collected, treated, and disposed of according to national environmental laws. This confirms our commitment to minimizing environmental harm.
              </p>
            </div>
          </div>
          {/* doh compliance box */}
          <div className="col-md-4 mb-4">
            <div className="compliance-logo-box">
              <img src={doh} alt="DOH Logo" className="img-fluid" />
              <h4 className="text-success font-weight-bold mb-3">Department of Health (DOH)</h4>
              <p className="text-muted small mb-0">
                Adherence to DOH regulations guarantees that our processes, especially for handling human waste, meet strict public health and sanitation requirements. We prioritize the health and safety of our clients and the public.
              </p>
            </div>
          </div>
          {/* lgu compliance box */}
          <div className="col-md-4 mb-4">
            <div className="compliance-logo-box">
              <img src={lgu} alt="LGU Logo" className="img-fluid" />
              <h4 className="text-success font-weight-bold mb-3">Local Government Unit (LGU)</h4>
              <p className="text-muted small mb-0">
                We are fully licensed and accredited by the local government units where we operate. This local partnership validates our operational legitimacy and ensures we contribute positively to local waste management programs and community health.
              </p>
            </div>
          </div>
        </div>
      </section>



      <hr className="my-5" />

      {/* faq section with search functionality */}
      <section id="faqs" className="mb-5">
        <div className="faq-hero">
          {/* faq content and search area */}
          <div className="faq-content-left">
            <p className="text-muted">CONTACT US</p>
            <h2 className="intro-title">Frequently Asked Questions</h2>

            {/* search bar component */}
            <div className="search-container">
              <div className="search-bar-wrapper">
                <input
                  type="text"
                  className="form-control search-bar-custom"
                  placeholder="Search question here"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                />
                <button className="search-button" onClick={handleSearch}>
                  <i className="fas fa-search"></i>
                </button>
              </div>
            </div>

            <p className="contact-support">
              Didn't find what you're looking for?
            </p>

            {/* contact email display */}
            <p className="contact-support" style={{ color: '#0D8D1E' }}>
              cleaneco-it@cwms.com.ph
            </p>
          </div>

          {/* faq illustration image */}
          <div className="faq-illustration">
            <img src={faq} alt="FAQ Illustration" className="img-fluid" />
          </div>
        </div>

        {/* general information faq category */}
        <h3 className="faq-question-category" id="tips">General Information</h3>

        <Accordion>
          <Accordion.Item eventKey="0">
            <Accordion.Header>
              <i className="fas fa-info-circle mr-2 text-muted"></i> How often should I schedule a Desludging/Siphoning service?
            </Accordion.Header>
            <Accordion.Body>
              The standard recommendation, as per many LGUs, is to schedule desludging or siphoning every 3 to 5 years for residential properties to ensure your septic tank functions efficiently and to prevent blockages. Commercial and industrial establishments may require more frequent services, often every 1-2 years, depending on usage.
            </Accordion.Body>
          </Accordion.Item>

          <Accordion.Item eventKey="1">
            <Accordion.Header>
              <i className="fas fa-peso-sign mr-2 text-muted"></i> How is the service price determined?
            </Accordion.Header>
            <Accordion.Body>
              The cost for our services (Siphoning, Deep Cleaning, Declogging) is determined by several factors, including: the type and size of the service required, the location of the site (travel time/distance), the accessibility of the septic tank or clogged area, and whether it is a residential or commercial client. Please call our hotline for a quick, no-obligation quotation.
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>

        {/* services faq category */}
        <h3 className="faq-question-category">About Our Services</h3>

        <Accordion>
          <Accordion.Item eventKey="2">
            <Accordion.Header>
              <i className="fas fa-water mr-2 text-muted"></i> How does the Siphoning / Desludging process work?
            </Accordion.Header>
            <Accordion.Body>
              Our team will locate your septic tank, open the manhole, and use a specialized vacuum truck to completely remove the accumulated sludge (septage) from the tank. The waste is securely contained and transported to a DENR-accredited treatment facility, ensuring zero improper disposal and full compliance with environmental regulations.
            </Accordion.Body>
          </Accordion.Item>

          <Accordion.Item eventKey="3">
            <Accordion.Header>
              <i className="fas fa-broom mr-2 text-muted"></i> What does Deep Cleaning service cover?
            </Accordion.Header>
            <Accordion.Body>
              Our <strong>Deep Cleaning service</strong> is comprehensive, covering areas often missed by regular maintenance. This includes the thorough cleaning and sanitizing of catch basins, manholes, and grease traps (for food establishments). We remove hardened build-up, debris, and grease that cause slow drainage and foul odors, restoring your system to optimal function.
            </Accordion.Body>
          </Accordion.Item>

          <Accordion.Item eventKey="4">
            <Accordion.Header>
              <i className="fas fa-wrench mr-2 text-muted"></i> How quickly can you resolve a pipe Declogging emergency?
            </Accordion.Header>
            <Accordion.Body>
              As we offer <strong>24/7 Emergency Service</strong>, we aim to dispatch a team immediately upon your call for urgent declogging issues (like toilet, sink, or main line blockages). Using powerful hydro-jetting equipment and specialized tools, our skilled professionals can typically resolve even the toughest clogs quickly and effectively to restore your plumbing system.
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>
      </section>
    </main>
  );
}

export default Resources;
