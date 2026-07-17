import { Link } from 'react-router-dom';
import { Carousel } from 'react-bootstrap';
import '../assets/styles/homepage.css';
import carousel5 from '../assets/styles/images/carousel5.png';
import carousel1 from '../assets/styles/images/carousel1.png';
import carousel2 from '../assets/styles/images/carousel2.png';
import carousel4 from '../assets/styles/images/carousel4.png';
import carousell7 from '../assets/styles/images/carousell7.png';
import image2 from '../assets/styles/images/2.png';
import image3 from '../assets/styles/images/3.png';
import image4 from '../assets/styles/images/4.png';
import image5 from '../assets/styles/images/5.png';
import image6 from '../assets/styles/images/6.png';
import image7 from '../assets/styles/images/7.png';
import image8 from '../assets/styles/images/8.png';
import image9 from '../assets/styles/images/9.png';
import image10 from '../assets/styles/images/10.png';
import image11 from '../assets/styles/images/11.png';

function HomePage() {
  const isLoggedIn = !!sessionStorage.getItem('loggedInUser');
  const bookLink = isLoggedIn ? '/order' : '/register';
  const servicePrefix = isLoggedIn ? '/client/services' : '/services';
  return (
    <div>
      {/* main hero carousel showcasing company services */}
      <Carousel 
      interval={3000}
      controls={true}
      indicators={true}
      pause="hover">
        <Carousel.Item>
          <img className="d-block w-100" src={carousel5} alt="First slide" />
        </Carousel.Item>
        <Carousel.Item>
          <img className="d-block w-100" src={carousel1} alt="Second slide" />
        </Carousel.Item>
        <Carousel.Item>
          <img className="d-block w-100" src={carousel2} alt="Third slide" />
        </Carousel.Item>
      </Carousel>

      {/* company introduction and value proposition section */}
      <section className="text-center my-5">
        <h2 className="intro-title">Welcome to Cleaneco's Waste Management Services!</h2>
        <p className="intro-text">
          Through extensive experience across a broad range of industries, we are
          proving the value of our "no problems, only solutions" mantra. And as the
          demand for innovative solutions and partnerships continues to grow, our
          unique capabilities and passion to deliver are proving CLEANECO as a key
          project collaborator for developments of any scale. When planning your next
          development, you can rely on Cleaneco Waste Management Services to deliver
          innovative solutions, on time, on budget and above all expectations.
        </p>
        {/* primary call-to-action for new users */}
        <Link to={bookLink} className="btn btn-custom">Book Now!</Link>
      </section>

      {/* services showcase section with feature cards */}
      <div className="text-center my-5" style={{backgroundColor: '#F2F2F2'}}>
        <br />
        <h2 className="intro-title">Our Services</h2>
        
        {/* service cards container */}
  <div style={{display: 'flex', justifyContent: 'center', alignItems: 'stretch', gap: '20px', margin: '40px 0', flexWrap: 'wrap'}}>

          {/* siphoning/desludging service card */}
          <div className="card" style={{width: '18rem'}}>
            <img className="card-img-top" src={carousel4} alt="Siphoning/Desludging" style={{width: '100%', height: '250px', objectFit: 'cover'}} />
            <div className="card-body">
              <h5 className="card-title">Siphoning/Desludging</h5>
              <p className="card-text">Siphoning of accumulated sludge and
                wastewater from the septic tanks, grease traps,
                and STP's to ensure proper sanitation, prevent
                overflow, and maintain the efficiency of the
                wastewater treatment system.</p>
              <Link to={`${servicePrefix}/siphoning-desludging`} className="btn btn-custom">Learn More</Link>
            </div>
          </div>

          {/* deep cleaning service card */}
          <div className="card" style={{width: '18rem'}}>
            <img className="card-img-top" src={carousel2} alt="Deep Cleaning" style={{width: '100%', height: '250px', objectFit: 'cover'}} />
            <div className="card-body">
              <h5 className="card-title">Deep Cleaning</h5>
              <p className="card-text">Deep cleaning of septic tanks, grease traps,
                and STP's involves the thorough removal of
                hardened sludge, grease layers, and solid
                waste deposits that regular siphoning cannot
                eliminate.</p>
              <Link to={`${servicePrefix}/deep-cleaning`} className="btn btn-custom">Learn More</Link>
            </div>
          </div>

          {/* declogging service card */}
          <div className="card" style={{width: '18rem'}}>
            <img className="card-img-top" src={carousell7} alt="Declogging" style={{width: '100%', height: '250px', objectFit: 'cover'}} />
            <div className="card-body">
              <h5 className="card-title">Declogging</h5>
              <p className="card-text">Our declogging service utilizes high-pressure
                water jetting and mechanical tools to clear
                obstructions in sewer lines, floor drains, and
                pipelines. This ensures smooth drainage flow and
                prevents potential overflows or structural damage.</p>
              <Link to={`${servicePrefix}/declogging`} className="btn btn-custom">Learn More</Link>
            </div>
          </div>
        </div>
        <br />
      </div>

      {/* company location and map section */}
      <section className="text-center my-5">
        <h2 className="intro-title">Where We Are</h2>
        <p className="intro-text">
          CLEANECO is conveniently located in Addas Greenfields, Bacoor, Cavite, making us easily accessible to residential, commercial, and industrial clients across Cavite and nearby areas. Our central location allows us to deliver fast, reliable waste management services whenever and wherever they are needed.
        </p>
        {/* embedded google maps location */}
        <div className="container px-4" id="map-location">
          <iframe 
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3864.2579530598628!2d120.96337168885495!3d14.412288000000009!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3397d300794cbd47%3A0xe051f98e08cbc667!2sAddas%20Greenfields!5e0!3m2!1sen!2sph!4v1758897291471!5m2!1sen!2sph" 
            style={{width: '100%', maxWidth: '800px', height: '450px', border: '2px solid #0D8D1E', borderRadius: '10px'}} 
            allowFullScreen="" 
            loading="lazy" 
            referrerPolicy="no-referrer-when-downgrade"
            title="Cleaneco Location Map"
          ></iframe>
        </div>
        <br />
      </section>

      {/* client portfolio and testimonials section */}
      <section className="clients-section text-center py-5" style={{backgroundColor: '#F2F2F2'}}>
        <h2 className="intro-title mb-4" id="clients">Trusted by Our Clients</h2>

        {/* client logo carousel */}
        <div className="container">
          <Carousel id="clientCarousel" interval={4000}>
            {/* first set of client logos */}
            <Carousel.Item>
              <div className="d-flex justify-content-around align-items-center flex-wrap">
                <div className="client-box"><img src={image2} alt="Client 1" /></div>
                <div className="client-box"><img src={image3} alt="Client 2" /></div>
                <div className="client-box"><img src={image4} alt="Client 3" /></div>
                <div className="client-box"><img src={image5} alt="Client 4" /></div>
                <div className="client-box"><img src={image6} alt="Client 5" /></div>
              </div>
            </Carousel.Item>

            {/* second set of client logos */}
            <Carousel.Item>
              <div className="d-flex justify-content-around align-items-center flex-wrap">
                <div className="client-box"><img src={image7} alt="Client 6" /></div>
                <div className="client-box"><img src={image8} alt="Client 7" /></div>
                <div className="client-box"><img src={image9} alt="Client 8" /></div>
                <div className="client-box"><img src={image10} alt="Client 9" /></div>
                <div className="client-box"><img src={image11} alt="Client 10" /></div>
              </div>
            </Carousel.Item>
          </Carousel>
        </div>
        <br />
        
        {/* company credibility and compliance statement */}
        <p className="intro-text">
          With over 30 years of industry experience, CLEANECO has built a reputation as a trusted partner in waste management solutions. We pride ourselves on delivering fast, reliable, and eco-friendly services that go beyond just siphoning, declogging, desludging, and grease trap cleaning.
          Our operations are backed by strict compliance with LGU, DOH, and DENR standards, ensuring every service we provide safeguards not only your property but also public health and the environment.
        </p>
        {/* secondary call-to-action button */}
        <Link to={bookLink} className="btn btn-custom">Book Now!</Link>
      </section>
    </div>
  );
}

export default HomePage;
