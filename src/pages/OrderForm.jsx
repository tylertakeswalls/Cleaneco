import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import '../assets/styles/orderform.css';
import carousel4 from '../assets/styles/images/carousel4.png';
import ClientCalendar from '../components/ClientCalendar';
import AlertModal from '../components/AlertModal';

function OrderForm() {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address: '',
        service_ids: [],
        date: '',
        timeSlot: '',
        notes: ''
    });

    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', type: 'info' });
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

    const calculateSubtotal = () => {
        return (formData.service_ids || []).reduce((sum, sId) => {
            const service = services.find(s => s.id === Number(sId));
            return sum + (service ? parseFloat(service.base_price) : 0);
        }, 0);
    };

    const handleSubmit = async (e) => {
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

        try {
            const submitData = { ...formData };
            submitData.user_id = userId;

            const response = await api.post('/orders/submit', submitData);

            if (response.data.success) {
                navigate('/thank-you');

                setFormData({
                    firstName: '',
                    lastName: '',
                    email: '',
                    phone: '',
                    address: '',
                    service_ids: [],
                    date: '',
                    timeSlot: '',
                    notes: ''
                });
            } else {
                showAlert("Error", response.data.message || "Error submitting order", "error");
            }
        } catch (error) {
            console.error('Error submitting order:', error);
            showAlert("Error", "Error submitting order. Please try again.", "error");
        }
    };

    if (loading) {
        return <div className="text-center p-5">Loading services...</div>;
    }

    return (
        <>
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

                <form onSubmit={handleSubmit}>
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

                    <div className="form-group">
                        <label className="form-label">Address</label>
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
                                            <div className="fw-bold text-success fs-5">
                                                ₱{parseFloat(service.base_price).toFixed(2)}
                                            </div>
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
                            <h6 className="fw-bold text-dark mb-3"><i className="fas fa-receipt me-2 text-success"></i>Price Summary</h6>
                            {(formData.service_ids || []).map(sId => {
                                const s = services.find(serv => serv.id === Number(sId));
                                if (!s) return null;
                                return (
                                    <div className="d-flex justify-content-between align-items-center mb-1 small text-muted" key={sId}>
                                        <span>{s.name}</span>
                                        <span>₱{parseFloat(s.base_price).toFixed(2)}</span>
                                    </div>
                                );
                            })}
                            <hr className="my-2" />
                            <div className="d-flex justify-content-between align-items-center mb-1">
                                <span className="fw-bold text-dark">Subtotal:</span>
                                <span className="fw-bold text-dark">₱{calculateSubtotal().toFixed(2)}</span>
                            </div>
                            <div className="d-flex justify-content-between align-items-center mt-2 pt-2 border-top">
                                <span className="fw-bolder fs-5 text-dark">Estimated Total:</span>
                                <span className="fw-bolder fs-5 text-success" style={{ color: '#0D8D1E' }}>
                                    ₱{(calculateSubtotal() + (calculateSubtotal() * 0.10)).toFixed(2)}
                                </span>
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

                    <button type="submit" className="submit-btn">
                        Submit Order
                    </button>
                </form>
            </div>
        </div>
        </>
    );
}

export default OrderForm;
