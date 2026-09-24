import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import '../assets/styles/orderform.css';
import carousel4 from '../assets/styles/images/carousel4.png';
import paymongoLogo from '../assets/styles/images/paymongo.png';
import ClientCalendar from '../components/ClientCalendar';
import AlertModal from '../components/AlertModal';

function OrderForm() {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        region: 'NCR',
        address: '',
        landmark: '',
        service_ids: [],
        date: '',
        timeSlot: '',
        notes: ''
    });
    // eslint-disable-next-line no-unused-vars
    const [sitePhoto, setSitePhoto] = useState(null);

    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', type: 'info' });
    
    // Payment specific state
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Estimate state
    const [estimateInputs, setEstimateInputs] = useState({});
    const [baseEstimate, setBaseEstimate] = useState(0);

    const navigate = useNavigate();

    const showAlert = (title, message, type = 'info') => {
        setModalConfig({ isOpen: true, title, message, type });
    };

    const closeAlert = () => {
        setModalConfig(prev => ({ ...prev, isOpen: false }));
    };

    const loggedInUser = sessionStorage.getItem("loggedInUser");
    const userId = sessionStorage.getItem("userId");
    const userDob = sessionStorage.getItem("userDob") || localStorage.getItem("userDob");

    useEffect(() => {
        // Pre-fill date if selected from calendar
        const params = new URLSearchParams(window.location.search);
        const prefillDate = params.get("date");
        if (prefillDate) {
            setFormData(prev => ({ ...prev, date: prefillDate }));
        }

        // Not logged in → redirect
        if (!loggedInUser) {
            showAlert("Login Required", "You must be logged in to submit an order.", "warning");
            setTimeout(() => navigate('/login'), 2000);
            return;
        }

        const fetchServices = async () => {
            try {
                const response = await api.get('/services');
                setServices(response.data);
            } catch (error) {
                console.error('Error fetching services:', error);
                showAlert("Error", "Failed to load services", "error");
            } finally {
                setLoading(false);
            }
        };

        const fetchUserData = async () => {
            try {
                const userName = sessionStorage.getItem("userName") || '';
                const userEmail = sessionStorage.getItem("userEmail") || '';

                try {
                    const response = await api.get(`/users/${userId}`);
                    if (response.data) {
                        setFormData(prev => ({
                            ...prev,
                            firstName: response.data.first_name || '',
                            lastName: response.data.last_name || '',
                            email: response.data.email || userEmail,
                            phone: response.data.phone || '',
                            address: response.data.address || ''
                        }));
                        return;
                    }
                } catch {
                    console.log("Using session storage data only");
                }

                const nameParts = userName.split(' ');
                setFormData(prev => ({
                    ...prev,
                    firstName: nameParts[0] || '',
                    lastName: nameParts.slice(1).join(' ') || '',
                    email: userEmail
                }));

            } catch (error) {
                console.error('Error fetching user data:', error);
            }
        };

        fetchServices();
        fetchUserData();
    }, [loggedInUser, navigate, userId, userDob]);

    const handleChange = (e) => {
        const { id, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [id]: type === 'checkbox' ? checked : value
        }));
    };

    const handleEstimateInputChange = (serviceId, field, value) => {
        setEstimateInputs(prev => ({
            ...prev,
            [serviceId]: {
                ...(prev[serviceId] || {}),
                [field]: value
            }
        }));
    };

    useEffect(() => {
        let totalEstimate = 0;
        (formData.service_ids || []).forEach(serviceId => {
            const service = services.find(s => s.id === serviceId || s._id === serviceId);
            if (service) {
                const name = service.name.toLowerCase();
                const inputs = estimateInputs[serviceId] || {};
                
                if (name.includes('siphon') || name.includes('desludg')) {
                    const numTanks = parseInt(inputs.numTanks || 1);
                    const capacityType = parseInt(inputs.capacityType || 1);
                    const accessibility = inputs.accessibility || 'easy';
                    const trips = numTanks * capacityType;
                    let cost = trips * 8000;
                    if (accessibility === 'difficult') {
                        cost += 1500;
                    }
                    totalEstimate += cost;
                } else if (name.includes('deep clean') || name.includes('declog')) {
                    const numTanks = parseInt(inputs.numTanks || 1);
                    totalEstimate += numTanks * 8000;
                } else {
                    totalEstimate += service.base_price || 0;
                }
            }
        });
        setBaseEstimate(totalEstimate);
    }, [formData.service_ids, estimateInputs, services]);

    const handleServiceToggle = (serviceId) => {
        setFormData(prev => {
            const currentIds = prev.service_ids || [];
            const nextIds = currentIds.includes(serviceId)
                ? currentIds.filter(id => id !== serviceId)
                : [...currentIds, serviceId];
            return {
                ...prev,
                service_ids: nextIds
            };
        });
    };

    const handleSelectDateTime = (date, slot) => {
        setFormData(prev => ({
            ...prev,
            date: date,
            timeSlot: slot
        }));
    };

    const handleInitialSubmit = (e) => {
        e.preventDefault();

        if (!loggedInUser || !userId) {
            showAlert("Login Required", "You must be logged in to submit an order.", "warning");
            setTimeout(() => navigate('/login'), 2000);
            return;
        }

        if ((formData.service_ids || []).length === 0) {
            showAlert("Selection Required", "Please select at least one service.", "warning");
            return;
        }

        if (!formData.date || !formData.timeSlot) {
            showAlert("Date Required", "Please select a preferred date and time slot from the calendar.", "warning");
            return;
        }

        // Open payment modal
        setShowPaymentModal(true);
    };



    const handlePayMongoSubmit = async () => {
        setIsSubmitting(true);
        try {
            const submitData = new FormData();
            submitData.append('user_id', userId);
            submitData.append('firstName', formData.firstName);
            submitData.append('lastName', formData.lastName);
            submitData.append('email', formData.email);
            submitData.append('phone', formData.phone);
            submitData.append('region', formData.region);
            submitData.append('address', formData.address);
            submitData.append('landmark', formData.landmark);
            submitData.append('date', formData.date);
            submitData.append('timeSlot', formData.timeSlot);
            submitData.append('notes', formData.notes);
            submitData.append('service_ids', JSON.stringify(formData.service_ids));
            submitData.append('base_estimate', baseEstimate);
            submitData.append('estimate_inputs', JSON.stringify(estimateInputs));
            if (sitePhoto) {
                submitData.append('site_photo', sitePhoto);
            }

            const response = await api.post('/orders/submit', submitData);
            
            if (response.data.success && response.data.checkout_url) {
                window.location.href = response.data.checkout_url;
            } else {
                showAlert("Error", response.data.message || "Could not create payment session", "error");
            }
        } catch (error) {
            console.error('Submit error:', error);
            showAlert("Error", "Error submitting order or connecting to PayMongo. Please try again.", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return <div className="text-center p-5">Loading services...</div>;
    }

    return (
        <>


        {showPaymentModal && (
            <div className="modal fade show" style={{ display: 'block', backgroundColor: 'transparent', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', zIndex: 1060 }} tabIndex="-1">
                <div className="modal-dialog modal-dialog-centered">
                    <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '1rem' }}>
                        <div className="modal-header border-0" style={{ backgroundColor: '#0D8D1E', color: 'white', borderTopLeftRadius: '1rem', borderTopRightRadius: '1rem' }}>
                            <h5 className="modal-title text-white fw-bold"><i className="fas fa-wallet me-2"></i>Pay Reservation Fee</h5>
                            <button type="button" className="btn-close btn-close-white" onClick={() => setShowPaymentModal(false)}></button>
                        </div>
                        <div className="modal-body text-center p-4">
                            <p className="text-muted mb-3">To secure your booking, a reservation fee of <strong>₱1,100</strong> is required.</p>
                            <img src={paymongoLogo} alt="PayMongo Options" className="img-fluid mb-4 px-2" style={{ width: '100%', objectFit: 'contain' }} />
                            <div className="alert alert-info text-start small mb-4" role="alert">
                                <i className="fas fa-info-circle me-2"></i>
                                <strong>Instructions:</strong> Please click the button below to pay securely via PayMongo. You can use credit/debit cards, GCash, or Maya. This ₱1000 fee (plus 10% tax) will be deducted from your final bill.
                            </div>
                        </div>
                        <div className="modal-footer border-0 p-4 pt-0 d-flex flex-column gap-2">
                            <button type="button" className="btn btn-primary w-100 rounded-pill fw-bold shadow-sm" onClick={handlePayMongoSubmit} disabled={isSubmitting}>
                                <i className="fas fa-credit-card me-2"></i>{isSubmitting ? 'Processing...' : 'Pay with PayMongo (Cards, GCash, Maya)'}
                            </button>
                            <div className="d-flex w-100 gap-2 mt-2">
                                <button type="button" className="btn btn-light rounded-pill flex-grow-1 fw-bold" onClick={() => setShowPaymentModal(false)} disabled={isSubmitting}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        <AlertModal 
            isOpen={modalConfig.isOpen} 
            title={modalConfig.title} 
            message={modalConfig.message} 
            type={modalConfig.type} 
            onClose={closeAlert} 
        />

        <div className="order-form-container">
            <div className="form-image">
                <img src={carousel4} alt="Worker" />
            </div>

            <div className="form-section">
                <h2 className="form-title">Cleaneco's Order Form</h2>

                <form onSubmit={handleInitialSubmit}>
                    <div className="name-row">
                        <div className="form-group">
                            <label className="form-label">Name</label>
                            <input 
                                type="text"
                                className="form-control"
                                id="firstName"
                                placeholder="John"
                                value={formData.firstName}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" style={{ visibility: 'hidden' }}>Last</label>
                            <input 
                                type="text"
                                className="form-control"
                                id="lastName"
                                placeholder="Doe"
                                value={formData.lastName}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <label className="form-label">Contact Details</label>
                    <div className="contact-row">
                        <div className="form-group">
                            <input 
                                type="email"
                                className="form-control"
                                id="email"
                                placeholder="john.doe@example.com"
                                value={formData.email}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <input 
                                type="tel"
                                className="form-control"
                                id="phone"
                                placeholder="+63 9216214712"
                                value={formData.phone}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="contact-row">
                        <div className="form-group">
                            <label className="form-label">Region</label>
                            <select 
                                className="form-select"
                                id="region"
                                value={formData.region}
                                onChange={handleChange}
                                required
                            >
                                <option value="NCR">NCR</option>
                                <option value="CALABARZON">CALABARZON</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Full Address</label>
                            <input 
                                type="text"
                                className="form-control"
                                id="address"
                                placeholder="Full Address"
                                value={formData.address}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group mb-4">
                        <label className="form-label">Nearest Landmark (Optional)</label>
                        <input 
                            type="text"
                            className="form-control"
                            id="landmark"
                            placeholder="e.g. Near Brgy Hall, Beside 7-Eleven..."
                            value={formData.landmark}
                            onChange={handleChange}
                        />
                    </div>

                    {/* Multi-Service Selection */}
                    <div className="form-group mb-4">
                        <label className="form-label fw-bold text-dark mb-3">
                            <i className="fas fa-concierge-bell me-2 text-success"></i>Select Services (Multiple Allowed)
                        </label>
                        <div className="row g-3">
                            {services.map(service => {
                                const isSelected = (formData.service_ids || []).includes(service.id);
                                return (
                                    <div className="col-md-6" key={service.id}>
                                        <div 
                                            className="card h-100 p-3 shadow-sm border-2"
                                            onClick={() => handleServiceToggle(service.id)}
                                            style={{
                                                cursor: 'pointer',
                                                borderRadius: '0.75rem',
                                                borderColor: isSelected ? '#0D8D1E' : '#e2e8f0',
                                                backgroundColor: isSelected ? '#f0fdf4' : '#fff',
                                                transition: 'all 0.2s ease',
                                                transform: isSelected ? 'scale(1.02)' : 'scale(1)'
                                            }}
                                        >
                                            <div className="d-flex justify-content-between align-items-start mb-2">
                                                <h6 className="fw-bold text-dark mb-0">{service.name}</h6>
                                                <input 
                                                    type="checkbox" 
                                                    className="form-check-input"
                                                    checked={isSelected}
                                                    onChange={() => {}} // click is handled by the card container
                                                    style={{ cursor: 'pointer', accentColor: '#0D8D1E' }}
                                                />
                                            </div>
                                            <p className="text-secondary small mb-3" style={{ flexGrow: 1, minHeight: '40px' }}>
                                                {service.description || 'No description available'}
                                            </p>
                                            {isSelected && (
                                                <div className="mt-3 p-3 rounded" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }} onClick={(e) => e.stopPropagation()}>
                                                    {service.name.toLowerCase().includes('siphon') || service.name.toLowerCase().includes('desludg') ? (
                                                        <>
                                                            <div className="form-group mb-3">
                                                                <label className="form-label small mb-1 fw-bold">Number of Septic Tanks</label>
                                                                <input 
                                                                    type="number" 
                                                                    className="form-control form-control-sm"
                                                                    placeholder="e.g. 1"
                                                                    min="1"
                                                                    value={estimateInputs[service.id || service._id]?.numTanks || '1'}
                                                                    onChange={(e) => handleEstimateInputChange(service.id || service._id, 'numTanks', e.target.value)}
                                                                />
                                                            </div>
                                                            <div className="form-group mb-3">
                                                                <label className="form-label small mb-1 fw-bold">Estimated Tank Capacity / Type</label>
                                                                <select 
                                                                    className="form-select form-select-sm"
                                                                    value={estimateInputs[service.id || service._id]?.capacityType || '1'}
                                                                    onChange={(e) => handleEstimateInputChange(service.id || service._id, 'capacityType', e.target.value)}
                                                                >
                                                                    <option value="1">Standard Residential (1 Trip / ~10 cu.m)</option>
                                                                    <option value="2">Large Commercial / Multi-tank (2+ Trips)</option>
                                                                </select>
                                                            </div>
                                                            <div className="form-group mb-0">
                                                                <label className="form-label small mb-1 fw-bold">Site Accessibility</label>
                                                                <select 
                                                                    className="form-select form-select-sm"
                                                                    value={estimateInputs[service.id || service._id]?.accessibility || 'easy'}
                                                                    onChange={(e) => handleEstimateInputChange(service.id || service._id, 'accessibility', e.target.value)}
                                                                >
                                                                    <option value="easy">Easy (Truck can park within 10–20 meters)</option>
                                                                    <option value="difficult">Difficult / Deep (Needs long extension hoses or narrow alley access)</option>
                                                                </select>
                                                            </div>
                                                            {estimateInputs[service.id || service._id]?.accessibility === 'difficult' && (
                                                                <div className="form-group mb-0 mt-3">
                                                                    <label className="form-label small mb-1 fw-bold text-danger"><i className="fas fa-camera me-1"></i>Upload Photo of Site/Driveway (Optional)</label>
                                                                    <input 
                                                                        type="file" 
                                                                        className="form-control form-control-sm"
                                                                        accept="image/*"
                                                                        onChange={(e) => {
                                                                            if(e.target.files[0] && e.target.files[0].size > 5 * 1024 * 1024) {
                                                                                showAlert("File Too Large", "Please upload an image smaller than 5MB.", "warning");
                                                                                e.target.value = "";
                                                                            } else {
                                                                                setSitePhoto(e.target.files[0]);
                                                                            }
                                                                        }}
                                                                    />
                                                                    <small className="text-muted" style={{ fontSize: '0.75rem' }}>Max size 5MB. Helps our team prepare extension hoses.</small>
                                                                </div>
                                                            )}
                                                        </>
                                                    ) : service.name.toLowerCase().includes('deep clean') || service.name.toLowerCase().includes('declog') ? (
                                                        <div className="form-group mb-0">
                                                            <label className="form-label small mb-1 fw-bold">Number of Septic Tanks</label>
                                                            <input 
                                                                type="number" 
                                                                className="form-control form-control-sm"
                                                                placeholder="e.g. 1"
                                                                min="1"
                                                                value={estimateInputs[service.id || service._id]?.numTanks || '1'}
                                                                onChange={(e) => handleEstimateInputChange(service.id || service._id, 'numTanks', e.target.value)}
                                                            />
                                                        </div>
                                                    ) : null}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Preferred Inspection Date & Time Slot Calendar */}
                    <div className="form-group mb-4">
                        <label className="form-label fw-bold text-dark mb-2">
                            <i className="far fa-calendar-alt me-2 text-success"></i>Select Preferred Inspection Date & Time
                        </label>
                        <ClientCalendar 
                            selectedDate={formData.date} 
                            selectedTimeSlot={formData.timeSlot} 
                            onSelectDateTime={handleSelectDateTime} 
                        />
                    </div>

                    {/* Price Breakdown / Receipt Summary */}
                    {(formData.service_ids || []).length > 0 && (
                        <div className="card border-0 p-3 mb-4 shadow-sm" style={{ background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                            <h6 className="fw-bold text-dark mb-3"><i className="fas fa-receipt me-2 text-success"></i>Reservation Summary</h6>
                            <div className="d-flex justify-content-between align-items-center mb-1 small text-muted">
                                <span>Estimated Base Cost</span>
                                <span>₱{baseEstimate.toFixed(2)}</span>
                            </div>
                            <div className="d-flex justify-content-between align-items-center mb-1 small text-muted">
                                <span>Reservation & Inspection Fee</span>
                                <span>₱1000.00</span>
                            </div>
                            <div className="d-flex justify-content-between align-items-center mb-1 small text-muted">
                                <span>Service Tax (10% of Reservation & Inspection Fee)</span>
                                <span>₱100.00</span>
                            </div>
                            <hr className="my-2" />
                            <div className="d-flex justify-content-between align-items-center mt-2 pt-2 border-top">
                                <span className="fw-bolder fs-5 text-dark">Total Amount Due Now:</span>
                                <span className="fw-bolder fs-5 text-success" style={{ color: '#0D8D1E' }}>
                                    ₱1100.00
                                </span>
                            </div>
                            <div className="alert alert-warning mt-3 mb-0 small py-2">
                                <div className="mb-1">
                                    <i className="fas fa-exclamation-triangle me-2"></i>
                                    Note: The Estimated Base Cost is subject to change upon physical inspection. The ₱1100 payment today secures your booking and is deducted from the final bill.
                                </div>
                                <div>
                                    <i className="fas fa-info-circle me-2"></i>
                                    <strong>Cancellation Policy:</strong> Please be aware that cancellations are non-refundable. The reservation fee cannot be returned if you choose to cancel your order.
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">Additional Notes (Optional)</label>
                        <textarea 
                            className="form-control"
                            id="notes"
                            placeholder="Any special instructions or details..."
                            value={formData.notes}
                            onChange={handleChange}
                            rows="3"
                        />
                    </div>

                    <button type="submit" className="submit-btn" style={{ backgroundColor: '#0D8D1E' }}>
                        <i className="fas fa-wallet me-2"></i>Pay Now
                    </button>
                </form>
            </div>
        </div>
        </>
    );
}

export default OrderForm;
