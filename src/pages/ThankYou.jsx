import { Link } from 'react-router-dom';
import '../assets/styles/thankyou.css';
import carousel2 from '../assets/styles/images/carousel2.png'
import { useRef } from 'react';

function ThankYou() {
  const container = useRef();
  return (
    <div ref={container}>
      {/* thank you page container with two-column layout */}
      <div className="thankyou-container">
        {/* decorative image section */}
        <div className="thankyou-image">
          <img src={carousel2} alt="Service" />
        </div>

        {/* thank you message and navigation section */}
        <div className="thankyou-section">
          <h2 className="thankyou-title">Thank you</h2>
          <p className="thankyou-message">The form was successfully submitted.</p>
          {/* navigation links for user next steps */}
          <p className="support-text">
            <Link to="/orders">Check your order/s here</Link>
            <br />
            <Link to="/client">Return to home</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default ThankYou;