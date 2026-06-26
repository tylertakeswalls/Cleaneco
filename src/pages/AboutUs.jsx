import '../assets/styles/aboutus.css';
import history from '../assets/styles/images/history_img.png';
import certificate1 from '../assets/styles/images/certificate1.png';
import certificate2 from '../assets/styles/images/certificate2.png';
import certificate3 from '../assets/styles/images/certificate3.png';
import certificate4 from '../assets/styles/images/certificate4.png';

function AboutUs() {
  return (
    <main className="container my-5">
      {/* page header section with company introduction */}
      <header className="page-hero text-center mb-5">
        <h2 className="intro-title" >Over 30 Years of Excellence</h2>
        <p className="lead text-secondary">
          Discover the history, mission, and commitments that have made CLEANECO the trusted leader in waste management and environmental solutions since 1998.
        </p>
      </header>

      {/* company history section with founder information */}
      <section id="history" className="mb-5 text-center">
        <h2 className="section-title">Company History</h2>
        <div className="row align-items-center justify-content-center">
          <div className="col-md-3 text-center mb-3 mb-md-0">
            <img src={history} alt="Founders: Mrs. Lucia Malabanan Bonavente and Mr. Jose Burac Bonavente" className="founder-img" />
            <p className="mt-3 mb-0 font-weight-bold">Mrs. Lucia Malabanan Bonavente</p>
            <p className="small text-muted">(Founder)</p>
            <p className="mt-3 mb-0 font-weight-bold">Mr. Jose Burac Bonavente</p>
            <p className="small text-muted">(Founder)</p>
          </div>
          <div className="col-md-9 history-card text-left">
            <p>
              <strong>Cleaneco Waste Management Services</strong> was formerly known as L.I. Malabanan Excavation and Plumbing Services (LiMEPS). Founded in mid-1998, it was established in Cavite through a dedicated team of professionals who share a vision of excellence in service. Our management offers quality service in excavation and plumbing.
            </p>
            <p>
              Our capacity to manage projects from conception to completion was founded on our wealth of diverse internal experience, at every stage. Currently involved in excavation and plumbing, development, and servicing of residential areas and some of PEZA most prestigious companies, our broad-based capabilities have seen us gain an enviable reputation as a trusted expert and leader in excavation and plumbing services.
            </p>
            <p className="font-weight-bold text-success">
              At CLEANECO, we are focused on providing good quality services with the highest levels of customer satisfaction – we will do everything we can to meet your expectations.
            </p>
          </div>
        </div>
      </section>

      {/* certifications and compliance section */}
      <section id="certifications" className="mb-5 text-center">
        <h2 className="section-title">Our Certification</h2>
        <p className="lead text-center mb-4">We are fully licensed and compliant with all local and national environmental and health regulations, ensuring responsible and safe waste management.</p>
        
        {/* certification images grid */}
        <div className="certification-grid">
          <div className="certification-item">
            <img src={certificate1} alt="Certification 1" className="img-fluid mb-2" />
            <p className="font-weight-bold small mb-0 text-success">Certificate of Compliance</p>
          </div>
          <div className="certification-item">
            <img src={certificate2} alt="Certification 2" className="img-fluid mb-2" />
            <p className="font-weight-bold small mb-0 text-success">Certificate of Recognition</p>
          </div>
          <div className="certification-item">
            <img src={certificate3} alt="Certification 3" className="img-fluid mb-2" />
            <p className="font-weight-bold small mb-0 text-success">Certificate of Accreditation</p>
          </div>
          <div className="certification-item">
            <img src={certificate4} alt="Certification 4" className="img-fluid mb-2" />
            <p className="font-weight-bold small mb-0 text-success">Certificate of Appreciation</p>
          </div>
        </div>
      </section>
      
      {/* additional business information section */}
      <section id="more-info" className="mb-5 text-center">
        <h2 className="section-title">More About The Business</h2>
        <div className="info-box" id="WhyUs">
          <h3>Why Trust Us?</h3>
          <p>
            As an industry innovator, we take pride in driving and developing the growth of the excavation and plumbing sector. Through strategic partnerships, alliances, and relationships with like-minded organizations and government departments we are helping to build an industry based on the highest possible work standards, setting the benchmark for the industry, and raising the bar for our competitors.
          </p>
          <p className="mb-0">
            Our commitment extends beyond just services; it's about establishing a foundation of <strong>integrity, competence, and environmental stewardship</strong> that our clients can rely on year after year.
          </p>
          <br />
          {/* environmental commitment subsection */}
          <p>
            <strong>Environmental:</strong>                
          </p>
          <p>
            At every level of our business, we are committed to our effort to minimize the environmental impact of our projects. From choice of material, waste disposal, efficiency of machinery and power, right down to the recycled paper of this brochure, sustaining our environment sustains a future for us all.             
          </p>
          {/* health and safety commitment subsection */}
          <p>
            <strong>Healthy and Safety:</strong>                
          </p>
          <p>
            Safety is not just another box to be ticked. Before any work commences, our committed team ensures the work environment meets and maintains the highest level of safety, minimizing injuries and project downtime. Fully compliant with the strictest of government regulations, our Health and Safety Policy is another way we are helping our clients manage risk while delivering exceptional project results.
          </p>
        </div>
      </section>
    </main>
  );
}

export default AboutUs;