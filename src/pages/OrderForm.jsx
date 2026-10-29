import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import '../assets/styles/orderform.css';
import carousel4 from '../assets/styles/images/carousel4.png';
import paymongoLogo from '../assets/styles/images/paymongo.png';
import ClientCalendar from '../components/ClientCalendar';
import AlertModal from '../components/AlertModal';
import ServicePricingFields from '../components/ServicePricingFields';
import { calculateOrderTotals } from '../utils/pricing';

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
        notes: '',
        clientType: 'residential'
    });
    // eslint-disable-next-line no-unused-vars
    const [sitePhoto, setSitePhoto] = useState(null);

    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', type: 'info' });
    
    // Payment specific state
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [paymentMethod, setPaymentMethod] = useState('paymongo');
    const [chequeFile, setChequeFile] = useState(null);
    const [chequeDetails, setChequeDetails] = useState({
        bankName: '',
        chequeNumber: '',
        accountName: '',
        chequeDate: new Date().toISOString().split('T')[0]
    });

    // Estimate state
    const [estimateInputs, setEstimateInputs] = useState({});
    const [baseEstimate, setBaseEstimate] = useState(0);

    // Residential 3-household minimum state
    const [households, setHouseholds] = useState([
        { name: '', address: '' },
        { name: '', address: '' },
        { name: '', address: '' }
    ]);

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
                            address: response.data.address || '',
                            clientType: response.data.clientType || 'residential'
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

    // Keep Household 1 in sync with lead client info for residential bookings
    useEffect(() => {
        if (formData.clientType === 'residential') {
            const leadName = `${formData.firstName || ''} ${formData.lastName || ''}`.trim();
            const leadAddress = formData.address || '';
            setHouseholds(prev => {
                const updated = [...prev];
                while (updated.length < 3) {
                    updated.push({ name: '', address: '' });
                }
                updated[0] = {
                    name: leadName || updated[0]?.name || '',
                    address: leadAddress || updated[0]?.address || ''
                };
                return updated;
            });
        }
    }, [formData.firstName, formData.lastName, formData.address, formData.clientType]);

    const handleHouseholdChange = (index, field, value) => {
        setHouseholds(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    const addHousehold = () => {
        setHouseholds(prev => [...prev, { name: '', address: '' }]);
    };

    const removeHousehold = (index) => {
        if (households.length <= 3) {
            showAlert("Minimum Required", "Residential bookings require a minimum of 3 households.", "warning");
            return;
        }
        setHouseholds(prev => prev.filter((_, i) => i !== index));
    };

    useEffect(() => {
        const selectedServices = (formData.service_ids || [])
            .map(sId => services.find(s => s.id === sId || s._id === sId))
            .filter(Boolean);

        const { totalEstimate } = calculateOrderTotals(selectedServices, estimateInputs);
        setBaseEstimate(totalEstimate);
    }, [formData.service_ids, estimateInputs, services]);

    const handleServiceToggle = (serviceId) => {
        setFormData(prev => {
            const currentIds = prev.service_ids || [];
            const isCurrentlySelected = currentIds.includes(serviceId);
            const nextIds = isCurrentlySelected
                ? currentIds.filter(id => id !== serviceId)
                : [...currentIds, serviceId];
            return {
                ...prev,
                service_ids: nextIds
            };
        });

        setEstimateInputs(prev => {
            if (!prev[serviceId]) {
                const srv = services.find(s => s.id === serviceId || s._id === serviceId);
                if (srv && srv.fields && srv.fields.length > 0) {
                    const defaults = {};
                    srv.fields.forEach(f => {
                        if (f.default !== undefined) defaults[f.key] = f.default;
                        else if (f.options?.[0]) defaults[f.key] = f.options[0].value;
                        else if (f.type === 'number') defaults[f.key] = f.min || 1;
                    });
                    return {
                        ...prev,
                        [serviceId]: defaults
                    };
                }
            }
            return prev;
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

        if (formData.clientType === 'residential') {
            if (households.length < 3) {
                showAlert("Minimum Households Required", "Residential bookings require a minimum of 3 participating households.", "warning");
                return;
            }
            const missingRequired = households.slice(0, 3).some((h) => !h.name?.trim() || !h.address?.trim());
            if (missingRequired) {
                showAlert("Household Details Required", "Please provide both the Name and Address for all 3 required households.", "warning");
                return;
            }
            const missingAdditional = households.slice(3).some((h) => !h.name?.trim() || !h.address?.trim());
            if (missingAdditional) {
                showAlert("Household Details Incomplete", "Please provide both Name and Address for all additional households, or remove empty entries.", "warning");
                return;
            }
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



    const handlePaymentSubmit = async () => {
        if (paymentMethod === 'cheque') {
            if (!chequeDetails.bankName || !chequeDetails.chequeNumber || !chequeDetails.accountName || !chequeDetails.chequeDate || !chequeFile) {
                showAlert("Missing Fields", "Please provide all cheque details and upload an image.", "warning");
                return;
            }
        }

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
            const completeInputs = {};
            (formData.service_ids || []).forEach(sId => {
                const srv = services.find(s => s.id === sId || s._id === sId);
                if (srv) {
                    const defaults = {};
                    (srv.fields || []).forEach(f => {
                        if (f.default !== undefined) defaults[f.key] = f.default;
                        else if (f.options?.[0]) defaults[f.key] = f.options[0].value;
                        else if (f.type === 'number') defaults[f.key] = f.min || 1;
                    });
                    completeInputs[sId] = { ...defaults, ...(estimateInputs[sId] || {}) };
                }
            });
            submitData.append('base_estimate', baseEstimate);
            submitData.append('estimate_inputs', JSON.stringify(completeInputs));
            submitData.append('clientType', formData.clientType);
            submitData.append('num_households', formData.clientType === 'residential' ? households.length : 1);
            submitData.append('households', JSON.stringify(formData.clientType === 'residential' ? households : []));
            if (sitePhoto) {
                submitData.append('site_photo', sitePhoto);
            }
            
            submitData.append('payment_method', paymentMethod);
            if (paymentMethod === 'cheque') {
                submitData.append('cheque_issuing_bank', chequeDetails.bankName);
                submitData.append('cheque_bank_name', chequeDetails.bankName);
                submitData.append('cheque_number', chequeDetails.chequeNumber);
                submitData.append('cheque_payer_name', chequeDetails.accountName);
                submitData.append('cheque_account_name', chequeDetails.accountName);
                submitData.append('cheque_date', chequeDetails.chequeDate);
                submitData.append('cheque_amount', 1100);
                if (chequeFile) {
                    submitData.append('cheque_image', chequeFile);
                }
            }

            const response = await api.post('/orders/submit', submitData);
            
            if (response.data.success) {
                if (paymentMethod === 'cheque') {
                    showAlert("Success", "Order and Cheque details submitted for verification.", "success");
                    setShowPaymentModal(false);
                    setTimeout(() => navigate('/orders'), 2000);
                } else if (response.data.checkout_url) {
                    window.location.href = response.data.checkout_url;
                }
            } else {
                showAlert("Error", response.data.message || "Could not create payment session", "error");
            }
        } catch (error) {
            console.error('Submit error:', error);
            const errorMsg = error.response?.data?.message || error.message || "Error submitting order or connecting to PayMongo. Please try again.";
            showAlert("Error", errorMsg, "error");
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
                            
                            {(formData.clientType === 'commercial' || formData.clientType === 'industrial') && (
                                <div className="mb-4">
                                    <div className="d-flex gap-3 justify-content-center">
                                        <div 
                                            className="card flex-grow-1 p-3 text-center border-2 shadow-sm"
                                            style={{
                                                cursor: 'pointer', 
                                                transition: 'all 0.2s ease', 
                                                borderColor: paymentMethod === 'paymongo' ? '#0D8D1E' : '#e2e8f0', 
                                                backgroundColor: paymentMethod === 'paymongo' ? '#f0fdf4' : '#fff',
                                                transform: paymentMethod === 'paymongo' ? 'translateY(-2px)' : 'none'
                                            }}
                                            onClick={() => setPaymentMethod('paymongo')}
                                        >
                                            <i className="fas fa-credit-card mb-2 fs-3" style={{color: paymentMethod === 'paymongo' ? '#0D8D1E' : '#94a3b8'}}></i>
                                            <div className="fw-bold" style={{color: paymentMethod === 'paymongo' ? '#0D8D1E' : '#64748b', fontSize: '0.9rem'}}>Online Payment</div>
                                        </div>
                                        
                                        <div 
                                            className="card flex-grow-1 p-3 text-center border-2 shadow-sm"
                                            style={{
                                                cursor: 'pointer', 
                                                transition: 'all 0.2s ease', 
                                                borderColor: paymentMethod === 'cheque' ? '#0D8D1E' : '#e2e8f0', 
                                                backgroundColor: paymentMethod === 'cheque' ? '#f0fdf4' : '#fff',
                                                transform: paymentMethod === 'cheque' ? 'translateY(-2px)' : 'none'
                                            }}
                                            onClick={() => setPaymentMethod('cheque')}
                                        >
                                            <i className="fas fa-money-check-alt mb-2 fs-3" style={{color: paymentMethod === 'cheque' ? '#0D8D1E' : '#94a3b8'}}></i>
                                            <div className="fw-bold" style={{color: paymentMethod === 'cheque' ? '#0D8D1E' : '#64748b', fontSize: '0.9rem'}}>Cheque Verification</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {paymentMethod === 'paymongo' ? (
                                <>
                                    <img src={paymongoLogo} alt="PayMongo Options" className="img-fluid mb-4 px-2" style={{ width: '100%', objectFit: 'contain' }} />
                                    <div className="alert alert-info text-start small mb-4" role="alert">
                                        <i className="fas fa-info-circle me-2"></i>
                                        <strong>Instructions:</strong> Please click the button below to pay securely via PayMongo. You can use credit/debit cards, GCash, or Maya. This ₱1000 fee (plus 10% tax) will be deducted from your final bill.
                                    </div>
                                </>
                            ) : (
                                <div className="text-start mt-3 mb-4">
                                    <div className="alert alert-warning small mb-3">
                                        <i className="fas fa-exclamation-triangle me-2"></i>
                                        <strong>Note:</strong> Cheque payments require manual verification by our staff. The required amount is fixed to <strong>₱1,100</strong>.
                                    </div>
                                    <div className="form-group mb-2">
                                        <label className="form-label small fw-bold">Bank Name</label>
                                        <input type="text" className="form-control form-control-sm" placeholder="e.g. BDO, BPI" value={chequeDetails.bankName} onChange={(e) => setChequeDetails({...chequeDetails, bankName: e.target.value})} required />
                                    </div>
                                    <div className="form-group mb-2">
                                        <label className="form-label small fw-bold">Cheque Number</label>
                                        <input type="text" className="form-control form-control-sm" value={chequeDetails.chequeNumber} onChange={(e) => setChequeDetails({...chequeDetails, chequeNumber: e.target.value})} required />
                                    </div>
                                    <div className="form-group mb-2">
                                        <label className="form-label small fw-bold">Account Name</label>
                                        <input type="text" className="form-control form-control-sm" value={chequeDetails.accountName} onChange={(e) => setChequeDetails({...chequeDetails, accountName: e.target.value})} required />
                                    </div>
                                    <div className="form-group mb-2">
                                        <label className="form-label small fw-bold">Cheque Date</label>
                                        <input type="date" className="form-control form-control-sm" value={chequeDetails.chequeDate} onChange={(e) => setChequeDetails({...chequeDetails, chequeDate: e.target.value})} required />
                                    </div>
                                    <div className="form-group mb-2">
                                        <label className="form-label small fw-bold text-success"><i className="fas fa-camera me-1"></i>Upload Cheque Image</label>
                                        <input type="file" className="form-control form-control-sm" accept="image/*" onChange={(e) => setChequeFile(e.target.files[0])} required />
                                    </div>
                                </div>
                            )}

                        </div>
                        <div className="modal-footer border-0 p-4 pt-0 d-flex flex-column gap-2">
                            <button type="button" className="btn btn-primary w-100 rounded-pill fw-bold shadow-sm" onClick={handlePaymentSubmit} disabled={isSubmitting}>
                                {paymentMethod === 'paymongo' 
                                    ? <><i className="fas fa-credit-card me-2"></i>{isSubmitting ? 'Processing...' : 'Pay with PayMongo (Cards, GCash, Maya)'}</>
                                    : <><i className="fas fa-money-check me-2"></i>{isSubmitting ? 'Submitting...' : 'Submit Cheque for Verification'}</>
                                }
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

                    {/* Residential Group Booking (Minimum 3 Households) */}
                    {formData.clientType === 'residential' && (
                        <div className="card border-0 p-4 mb-4 shadow-sm" style={{ backgroundColor: '#ffffff', border: '1.5px solid #86efac', borderRadius: '1rem' }}>
                            <div className="mb-3">
                                <h5 className="fw-bold mb-1 d-flex align-items-center" style={{ color: '#0D8D1E' }}>
                                    <i className="fas fa-home me-2"></i>Residential Group Booking
                                </h5>
                                <p className="text-muted small mb-0">
                                    Residential bookings require a minimum of <strong>3 households</strong>. A single <strong>₱1,100</strong> group reservation fee covers all participating homes.
                                </p>
                            </div>

                            {/* Household Entries */}
                            <div className="d-flex flex-column gap-3">
                                {households.map((household, index) => (
                                    <div 
                                        key={index} 
                                        className="p-3 rounded border"
                                        style={{ 
                                            backgroundColor: index === 0 ? '#f0fdf4' : '#ffffff',
                                            borderColor: index < 3 ? '#bbf7d0' : '#e2e8f0',
                                            overflow: 'hidden',
                                            boxSizing: 'border-box'
                                        }}
                                    >
                                        {/* Household Title & Status */}
                                        <div className="d-flex align-items-center justify-content-between mb-2">
                                            <div className="d-flex align-items-center gap-2">
                                                <span 
                                                    className="badge rounded-circle d-inline-flex align-items-center justify-content-center" 
                                                    style={{ 
                                                        width: '22px', 
                                                        height: '22px', 
                                                        backgroundColor: index === 0 ? '#0D8D1E' : '#64748b',
                                                        color: '#ffffff',
                                                        fontSize: '0.72rem',
                                                        fontWeight: 'bold'
                                                    }}
                                                >
                                                    {index + 1}
                                                </span>
                                                <span className="fw-bold small text-dark">Household #{index + 1}</span>
                                                {index === 0 && (
                                                    <span className="badge" style={{ backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', fontSize: '0.68rem' }}>
                                                        Lead Applicant
                                                    </span>
                                                )}
                                                {index > 0 && index < 3 && (
                                                    <span className="badge bg-light text-muted border" style={{ fontSize: '0.68rem' }}>
                                                        Required
                                                    </span>
                                                )}
                                            </div>
                                            {index >= 3 && (
                                                <button
                                                    type="button"
                                                    className="btn btn-outline-danger btn-sm py-0 px-2 border-0"
                                                    onClick={() => removeHousehold(index)}
                                                    title="Remove household"
                                                    style={{ fontSize: '0.78rem' }}
                                                >
                                                    <i className="fas fa-trash-alt me-1"></i>Remove
                                                </button>
                                            )}
                                        </div>

                                        {/* Input Fields (50% / 50% on sm/md screens) */}
                                        <div className="row g-2 mx-0">
                                            <div className="col-12 col-sm-5 px-1">
                                                <input 
                                                    type="text"
                                                    className="form-control form-control-sm w-100"
                                                    placeholder="Resident Full Name"
                                                    value={household.name}
                                                    onChange={(e) => handleHouseholdChange(index, 'name', e.target.value)}
                                                    required
                                                    style={{ minWidth: 0, boxSizing: 'border-box' }}
                                                />
                                            </div>
                                            <div className="col-12 col-sm-7 px-1">
                                                <input 
                                                    type="text"
                                                    className="form-control form-control-sm w-100"
                                                    placeholder="House / Lot / Street Address"
                                                    value={household.address}
                                                    onChange={(e) => handleHouseholdChange(index, 'address', e.target.value)}
                                                    required
                                                    style={{ minWidth: 0, boxSizing: 'border-box' }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-3 text-end">
                                <button
                                    type="button"
                                    className="btn btn-sm rounded-pill fw-bold px-3 shadow-sm"
                                    style={{ 
                                        color: '#0D8D1E', 
                                        borderColor: '#0D8D1E', 
                                        backgroundColor: '#ffffff',
                                        transition: 'all 0.2s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = '#0D8D1E';
                                        e.currentTarget.style.color = '#ffffff';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = '#ffffff';
                                        e.currentTarget.style.color = '#0D8D1E';
                                    }}
                                    onClick={addHousehold}
                                >
                                    <i className="fas fa-plus me-1"></i>Add Another Household
                                </button>
                            </div>
                        </div>
                    )}

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
                                                    <ServicePricingFields
                                                        service={service}
                                                        values={estimateInputs[service.id || service._id] || {}}
                                                        onChange={(fieldKey, val) => handleEstimateInputChange(service.id || service._id, fieldKey, val)}
                                                        showPhotoUpload={true}
                                                        onPhotoChange={(file) => {
                                                            if (file && file.size > 5 * 1024 * 1024) {
                                                                showAlert("File Too Large", "Please upload an image smaller than 5MB.", "warning");
                                                            } else {
                                                                setSitePhoto(file);
                                                            }
                                                        }}
                                                    />
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
