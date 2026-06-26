import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import axios from 'axios';
import '../assets/styles/orderform.css';
import carousel4 from '../assets/styles/images/carousel4.png';

function OrderForm() {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address: '',
        service_id: '',
        serviceType: '',
        date: '',
        timeSlot: '',
        notes: ''
    });

    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userAge, setUserAge] = useState(0);
    const navigate = useNavigate();

    const loggedInUser = sessionStorage.getItem("loggedInUser");
    const userId = sessionStorage.getItem("userId");
    const userDob = sessionStorage.getItem("userDob") || localStorage.getItem("userDob");

    const calculateAge = (dob) => {
        if (!dob || dob === 'undefined') return 0;
        const birthDate = new Date(dob);
        if (isNaN(birthDate)) return 0;
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    useEffect(() => {
        // Pre-fill date if selected from calendar
        const params = new URLSearchParams(window.location.search);
        const prefillDate = params.get("date");
        if (prefillDate) {
            setFormData(prev => ({ ...prev, date: prefillDate }));
        }

        // Not logged in → redirect
        if (!loggedInUser) {
            alert("You must be logged in to submit an order.");
            navigate('/login');
            return;
        }

        const fetchServices = async () => {
            try {
                const response = await api.get('/services.php?available=true');
                setServices(response.data);
            } catch (error) {
                console.error('Error fetching services:', error);
                alert('Failed to load services');
            } finally {
                setLoading(false);
            }
        };

        if (userDob) {
            setUserAge(calculateAge(userDob));
        }

        const fetchUserData = async () => {
            try {
                const userName = sessionStorage.getItem("userName") || '';
                const userEmail = sessionStorage.getItem("userEmail") || '';

                try {
                    const response = await api.get(`/read.php?type=user&id=${userId}`);
                    if (response.data) {
                        if (response.data.date_of_birth) {
                            setUserAge(calculateAge(response.data.date_of_birth));
                        }
                        
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
        const { id, value } = e.target;

        setFormData(prev => ({
            ...prev,
            [id]: id === 'seniorCardImage' ? e.target.files[0] : (id === 'applySeniorDiscount' ? e.target.checked : value)
        }));

        // Fill service name when service changes
        if (id === 'service_id') {
            const selectedService = services.find(
                s => s.id === Number(value) // strict compare
            );

            if (selectedService) {
                setFormData(prev => ({
                    ...prev,
                    serviceType: selectedService.name
                }));
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!loggedInUser || !userId) {
            alert("You must be logged in to submit an order.");
            navigate('/login');
            return;
        }

        try {
            const submitData = new FormData();
            submitData.append('type', 'order');
            submitData.append('user_id', userId);

            // Calculate discount amount if applicable
            let discountAmount = 0;
            if (formData.applySeniorDiscount && formData.service_id) {
                const selectedService = services.find(s => s.id === Number(formData.service_id));
                if (selectedService && selectedService.base_price) {
                    discountAmount = (selectedService.base_price * 0.20).toFixed(2);
                }
            }
            submitData.append('discountAmount', discountAmount);

            Object.keys(formData).forEach(key => {
                if (key === 'seniorCardImage' && formData[key]) {
                    submitData.append('seniorCardImage', formData[key]);
                } else if (key !== 'seniorCardImage' && key !== 'applySeniorDiscount') {
                    submitData.append(key, formData[key]);
                }
            });

            // Override standard api behavior to force native FormData processing without JSON constraints
            const response = await axios.post('http://localhost/firstapp/php-backend/api/submit.php', submitData);

            if (response.data.success) {
                navigate('/thank-you');

                setFormData({
                    firstName: '',
                    lastName: '',
                    email: '',
                    phone: '',
                    address: '',
                    service_id: '',
                    serviceType: '',
                    date: '',
                    timeSlot: '',
                    notes: '',
                    applySeniorDiscount: false,
                    seniorCardImage: null
                });
            } else {
                alert(response.data.message || "Error submitting order");
            }
        } catch (error) {
            console.error('Error submitting order:', error);
            alert("Error submitting order. Please try again.");
        }
    };

    if (loading) {
        return <div className="text-center p-5">Loading services...</div>;
    }

    return (
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

                    <div className="form-group">
                        <label className="form-label">Type of Service</label>
                        <select 
                            className="form-control"
                            id="service_id"
                            value={formData.service_id}
                            onChange={handleChange}
                            required
                        >
                            <option value="">Select service...</option>
                            {services.map(service => (
                                <option key={service.id} value={service.id}>
                                    {service.name} {service.base_price > 0 ? `(₱${service.base_price})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Preferred Inspection Date</label>
                        <input 
                            type="date"
                            className="form-control"
                            id="date"
                            value={formData.date}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Preferred Time Slot</label>
                        <select 
                            className="form-control"
                            id="timeSlot"
                            value={formData.timeSlot}
                            onChange={handleChange}
                            required
                        >
                            <option value="">Select time slot...</option>
                            <option value="Morning">Morning</option>
                            <option value="Afternoon">Afternoon</option>
                            <option value="Evening">Evening</option>
                        </select>
                    </div>

                    {/* Senior Discount Section */}
                    {userAge >= 60 && (
                        <div className="form-group p-3 border rounded mb-3 bg-light" style={{ borderColor: '#0D8D1E' }}>
                            <h5 className="fw-bold text-success mb-3">
                                <i className="fas fa-id-card me-2"></i>Senior Citizen Discount
                            </h5>
                            <p className="small text-muted mb-3">
                                You are legally eligible for a 20% senior citizen discount! Upload your Senior ID Card below to automatically apply the 20% discount.
                            </p>
                            
                            <div className="mb-3">
                                <label className="form-label text-dark fw-bold">Upload Senior Citizen ID Image</label>
                                <input 
                                    type="file"
                                    className="form-control"
                                    id="seniorCardImage"
                                    accept="image/*"
                                    onChange={handleChange}
                                />
                                <small className="text-muted d-block mt-1">Image will strictly be used for discount validation.</small>
                            </div>

                            <div className="form-check mb-3">
                                <input 
                                    type="checkbox" 
                                    className="form-check-input" 
                                    id="applySeniorDiscount" 
                                    checked={formData.applySeniorDiscount || false}
                                    onChange={handleChange}
                                />
                                <label className="form-check-label fw-bold text-dark" htmlFor="applySeniorDiscount">
                                    I confirm that I want to apply the 20% Senior Citizen Discount
                                </label>
                            </div>

                            {formData.applySeniorDiscount && formData.service_id && services.find(s => s.id === Number(formData.service_id)) && (
                                <div className="mt-2 fw-bold text-success fs-5">
                                    <em>Discount Amount: -₱{(services.find(s => s.id === Number(formData.service_id)).base_price * 0.20).toFixed(2)}</em>
                                </div>
                            )}
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
    );
}

export default OrderForm;
