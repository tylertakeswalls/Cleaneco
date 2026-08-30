import { useState } from 'react';
import api from '../api/api';
import AlertModal from '../components/AlertModal';

function ContactUs() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: 'Inquiry',
    message: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', type: 'info' });

  const showAlert = (title, message, type = 'info') => {
    setModalConfig({ isOpen: true, title, message, type });
  };

  const closeAlert = () => {
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.message) {
      showAlert("Missing Fields", "Please fill out all required fields.", "warning");
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await api.post('/contact/submit', formData);
      if (response.data.success) {
        showAlert("Success", "Your message has been sent successfully. We will get back to you shortly.", "success");
        setFormData({
          name: '',
          email: '',
          subject: 'Inquiry',
          message: ''
        });
      } else {
        showAlert("Error", response.data.message || "Failed to send message.", "error");
      }
    } catch (error) {
      console.error("Error submitting contact form:", error);
      showAlert("Error", "An unexpected error occurred. Please try again later.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="container my-5">
      <AlertModal 
        isOpen={modalConfig.isOpen} 
        title={modalConfig.title} 
        message={modalConfig.message} 
        type={modalConfig.type} 
        onClose={closeAlert} 
      />
      
      <header className="page-hero text-center mb-5">
        <h2 className="intro-title" style={{ color: '#0D8D1E', fontWeight: 'bold' }}>Contact & Complaints</h2>
        <p className="lead text-secondary">
          We value your feedback. Whether you have a question, a complaint, or feedback about our services, please let us know.
        </p>
      </header>

      <div className="row justify-content-center">
        <div className="col-md-8 col-lg-6">
          <div className="card shadow-sm border-0" style={{ borderRadius: '1rem' }}>
            <div className="card-body p-4 p-md-5">
              <form onSubmit={handleSubmit}>
                <div className="form-group mb-3">
                  <label htmlFor="name" className="form-label fw-bold">Full Name <span className="text-danger">*</span></label>
                  <input 
                    type="text" 
                    className="form-control" 
                    id="name" 
                    placeholder="Juan Dela Cruz"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-group mb-3">
                  <label htmlFor="email" className="form-label fw-bold">Email Address <span className="text-danger">*</span></label>
                  <input 
                    type="email" 
                    className="form-control" 
                    id="email" 
                    placeholder="juan@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-group mb-3">
                  <label htmlFor="subject" className="form-label fw-bold">Subject <span className="text-danger">*</span></label>
                  <select 
                    className="form-select" 
                    id="subject" 
                    value={formData.subject}
                    onChange={handleChange}
                    required
                  >
                    <option value="Inquiry">Inquiry</option>
                    <option value="Complaint">Complaint</option>
                    <option value="Feedback">Feedback</option>
                    <option value="Follow-up">Follow-up</option>
                  </select>
                </div>

                <div className="form-group mb-4">
                  <label htmlFor="message" className="form-label fw-bold">Message <span className="text-danger">*</span></label>
                  <textarea 
                    className="form-control" 
                    id="message" 
                    rows="5" 
                    placeholder="Please provide the details of your inquiry, complaint, or feedback..."
                    value={formData.message}
                    onChange={handleChange}
                    required
                  ></textarea>
                </div>

                <button 
                  type="submit" 
                  className="btn w-100 fw-bold shadow-sm" 
                  style={{ backgroundColor: '#0D8D1E', color: 'white', padding: '12px' }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <span><i className="fas fa-spinner fa-spin me-2"></i>Sending...</span>
                  ) : (
                    <span><i className="fas fa-paper-plane me-2"></i>Send Message</span>
                  )}
                </button>
              </form>
            </div>
          </div>
          
          <div className="text-center mt-4 text-muted small">
            <p className="mb-1"><i className="fas fa-envelope me-2 text-success"></i>Direct Email: cleanecowmss@gmail.com</p>
            <p><i className="fas fa-phone me-2 text-success"></i>Phone: +63 921 621 4712</p>
          </div>
        </div>
      </div>
    </main>
  );
}

export default ContactUs;
