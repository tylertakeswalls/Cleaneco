import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api/api';
import '../assets/styles/orderform.css';
import carousel4 from '../assets/styles/images/carousel4.webp';
import paymongoLogo from '../assets/styles/images/paymongo.png';
import ClientCalendar from '../components/ClientCalendar';
import AlertModal from '../components/AlertModal';
import ServicePricingFields from '../components/ServicePricingFields';
import { calculateOrderTotals } from '../utils/pricing';
import { formatPhoneNumber } from '../utils/helpers';
import { detectRegionFromAddress, formatFullAddress } from '../data/psgcData';

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
        clientType: 'residential',
        companyName: ''
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

    // Residential households state (1 household default, optional neighbor additions)
    const [households, setHouseholds] = useState([
        { name: '', address: '' }
    ]);
    const [reorderRef, setReorderRef] = useState('');

    const navigate = useNavigate();
    const location = useLocation();

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

        // Restore unsubmitted booking draft or "Book Again" prefill from sessionStorage / location.state
        let parsedDraft = location.state?.reorderDraft || null;
        if (!parsedDraft) {
            try {
                const savedDraft = sessionStorage.getItem('cleaneco_booking_draft_v1');
                if (savedDraft) {
                    parsedDraft = JSON.parse(savedDraft);
                }
            } catch (err) {
                console.error('Failed to restore booking draft:', err);
            }
        }

        if (parsedDraft) {
            if (parsedDraft.reorderFromOrderRef) {
                setReorderRef(parsedDraft.reorderFromOrderRef);
            }
            if (parsedDraft.formData) {
                const draftAddress = parsedDraft.formData.address || '';
                const draftRegion = parsedDraft.formData.region || '';
                const detectedFromDraft = detectRegionFromAddress(draftAddress);
                const finalRegion = (detectedFromDraft === 'CALABARZON' && draftRegion === 'NCR') ? 'CALABARZON' : (draftRegion || detectedFromDraft);

                setFormData(prev => ({
                    ...prev,
                    ...parsedDraft.formData,
                    region: finalRegion || prev.region
                }));
            }
            if (parsedDraft.estimateInputs) {
                setEstimateInputs(parsedDraft.estimateInputs);
            }
            if (parsedDraft.households && Array.isArray(parsedDraft.households) && parsedDraft.households.length > 0) {
                setHouseholds(parsedDraft.households.slice(0, 3));
            }
        }

        const fetchServices = async () => {
            try {
                const response = await api.get('/services');
                const loadedServices = Array.isArray(response.data) ? response.data : [];
                setServices(loadedServices);

                if (parsedDraft && loadedServices.length > 0) {
                    const draftIds = Array.isArray(parsedDraft.formData?.service_ids) ? [...parsedDraft.formData.service_ids] : [];
                    const draftNames = Array.isArray(parsedDraft.service_names) ? parsedDraft.service_names : [];
                    const normalizedIds = [];

                    draftIds.forEach(dId => {
                        const match = loadedServices.find(s => String(s.id || s._id) === String(dId));
                        if (match) {
                            const canonicalId = match.id || match._id;
                            if (!normalizedIds.includes(canonicalId)) normalizedIds.push(canonicalId);
                        }
                    });

                    draftNames.forEach(dName => {
                        const match = loadedServices.find(s => String(s.name || '').trim().toLowerCase() === String(dName || '').trim().toLowerCase());
                        if (match) {
                            const canonicalId = match.id || match._id;
                            if (!normalizedIds.includes(canonicalId)) normalizedIds.push(canonicalId);
                        }
                    });

                    if (normalizedIds.length > 0) {
                        setFormData(prev => ({ ...prev, service_ids: normalizedIds }));
                        setEstimateInputs(prev => {
                            const nextInputs = { ...prev };
                            normalizedIds.forEach(sId => {
                                if (!nextInputs[sId]) {
                                    const srv = loadedServices.find(s => (s.id || s._id) === sId);
                                    if (srv && Array.isArray(srv.fields)) {
                                        const defaults = {};
                                        srv.fields.forEach(f => {
                                            if (f.default !== undefined) defaults[f.key] = f.default;
                                            else if (f.options?.[0]) defaults[f.key] = f.options[0].value;
                                            else if (f.type === 'number') defaults[f.key] = f.min || 1;
                                        });
                                        nextInputs[sId] = defaults;
                                    }
                                }
                            });
                            return nextInputs;
                        });
                    }
                }
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
                        const userAddress = response.data.address || '';
                        const userProvince = response.data.province || '';
                        const resolvedAddress = userAddress || formatFullAddress(response.data);
                        const detectedRegion = detectRegionFromAddress(resolvedAddress, userProvince);

                        setFormData(prev => {
                            const keepDraftAddress = Boolean(prev.address && prev.address.trim());
                            const finalAddress = keepDraftAddress ? prev.address : resolvedAddress;
                            const finalRegion = keepDraftAddress
                                ? (prev.region || detectRegionFromAddress(prev.address, userProvince))
                                : detectedRegion;
                            return {
                                ...prev,
                                firstName: response.data.first_name || '',
                                lastName: response.data.last_name || '',
                                email: response.data.email || userEmail,
                                phone: formatPhoneNumber(response.data.phone || ''),
                                address: finalAddress,
                                region: finalRegion,
                                clientType: response.data.clientType || 'residential',
                                companyName: response.data.companyName || ''
                            };
                        });
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
    }, [loggedInUser, navigate, userId, userDob, location.state]);

    // Autosave booking draft in sessionStorage
    useEffect(() => {
        const hasDataToSave = (formData.service_ids && formData.service_ids.length > 0) ||
            Boolean(formData.date) ||
            Boolean(formData.timeSlot) ||
            Boolean(formData.landmark) ||
            Boolean(formData.notes) ||
            (households && households.length > 1);

        if (hasDataToSave && !isSubmitting) {
            try {
                const draft = {
                    formData: {
                        region: formData.region,
                        address: formData.address,
                        landmark: formData.landmark,
                        date: formData.date,
                        timeSlot: formData.timeSlot,
                        notes: formData.notes,
                        service_ids: formData.service_ids
                    },
                    estimateInputs,
                    households
                };
                sessionStorage.setItem('cleaneco_booking_draft_v1', JSON.stringify(draft));
            } catch (err) {
                console.error('Failed to autosave booking draft:', err);
            }
        }
    }, [formData.service_ids, formData.region, formData.address, formData.landmark, formData.date, formData.timeSlot, formData.notes, estimateInputs, households, isSubmitting]);

    // Warn before leaving if unsaved changes exist
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            const hasDataToSave = (formData.service_ids && formData.service_ids.length > 0) ||
                Boolean(formData.date) ||
                Boolean(formData.landmark) ||
                Boolean(formData.notes);

            if (hasDataToSave && !isSubmitting) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [formData.service_ids, formData.date, formData.landmark, formData.notes, isSubmitting]);

    const handleChange = (e) => {
        const { id, value, type, checked } = e.target;
        const maxLimits = {
            firstName: 50,
            lastName: 50,
            email: 100,
            address: 200,
            landmark: 100,
            notes: 500
        };
        let finalValue = value;
        if (maxLimits[id] && typeof value === 'string') {
            finalValue = value.slice(0, maxLimits[id]);
        }
        if (id === 'address') {
            const detected = detectRegionFromAddress(finalValue);
            setFormData(prev => ({
                ...prev,
                address: finalValue,
                region: detected || prev.region
            }));
            return;
        }
        if (id === 'phone') {
            setFormData(prev => ({
                ...prev,
                phone: formatPhoneNumber(value)
            }));
            return;
        }
        setFormData(prev => ({
            ...prev,
            [id]: type === 'checkbox' ? checked : finalValue
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

    // Keep primary location (Household #1 / Building #1) in sync with lead client info
    useEffect(() => {
        const isBiz = formData.clientType === 'commercial' || formData.clientType === 'industrial';
        const contactName = `${formData.firstName || ''} ${formData.lastName || ''}`.trim();
        const leadName = isBiz && formData.companyName
            ? `${formData.companyName}${contactName ? ` (${contactName})` : ''}`
            : contactName;
        const leadAddress = formData.address || '';
        setHouseholds(prev => {
            const updated = prev && prev.length > 0 ? [...prev] : [{ name: '', address: '' }];
            updated[0] = {
                name: updated[0]?.name || leadName || '',
                address: leadAddress || updated[0]?.address || ''
            };
            return updated;
        });
    }, [formData.firstName, formData.lastName, formData.address, formData.clientType, formData.companyName]);

    const handleHouseholdChange = (index, field, value) => {
        const limit = field === 'name' ? 80 : 150;
        const val = typeof value === 'string' ? value.slice(0, limit) : value;
        setHouseholds(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: val };
            return updated;
        });
    };

    const addHousehold = () => {
        const isBiz = formData.clientType === 'commercial' || formData.clientType === 'industrial';
        if (households.length >= 3) {
            showAlert(
                "Maximum Limit Reached",
                isBiz
                    ? "You can include up to 3 buildings/units per order (1 primary site + up to 2 additional buildings/units)."
                    : "You can include up to 3 households per order (1 primary home + up to 2 neighboring households).",
                "warning"
            );
            return;
        }
        setHouseholds(prev => [...prev, { name: '', address: '' }]);
    };

    const removeHousehold = (index) => {
        const isBiz = formData.clientType === 'commercial' || formData.clientType === 'industrial';
        if (index === 0 || households.length <= 1) {
            showAlert(
                isBiz ? "Primary Site" : "Primary Household",
                isBiz ? "The primary building/unit location cannot be removed." : "The lead applicant household cannot be removed.",
                "warning"
            );
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

        const isBiz = formData.clientType === 'commercial' || formData.clientType === 'industrial';
        if (!households || households.length < 1) {
            showAlert(
                isBiz ? "Location Details Required" : "Household Details Required",
                isBiz ? "Please provide details for your primary building/unit." : "Please provide details for your household.",
                "warning"
            );
            return;
        }
        const missingPrimary = !households[0]?.name?.trim() || !households[0]?.address?.trim();
        if (missingPrimary) {
            showAlert(
                isBiz ? "Location Details Required" : "Household Details Required",
                isBiz
                    ? "Please provide both the Name/Contact and Address for the primary building/unit."
                    : "Please provide both the Name and Address for the primary household.",
                "warning"
            );
            return;
        }
        if (households.length > 3) {
            showAlert(
                "Maximum Limit Exceeded",
                isBiz
                    ? "A maximum of 3 buildings/units (1 primary site + up to 2 additional) is allowed per order."
                    : "A maximum of 3 households (1 primary home + up to 2 neighboring households) is allowed per order.",
                "warning"
            );
            return;
        }
        if (households.length > 1) {
            const missingAdditional = households.slice(1).some((h) => !h.name?.trim() || !h.address?.trim());
            if (missingAdditional) {
                showAlert(
                    isBiz ? "Building / Unit Details Incomplete" : "Household Details Incomplete",
                    isBiz
                        ? "Please provide both Name and Address for all added buildings/units, or remove empty entries."
                        : "Please provide both Name and Address for all added neighbor households, or remove empty entries.",
                    "warning"
                );
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
            submitData.append('num_households', households.length || 1);
            submitData.append('households', JSON.stringify(households || []));
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
                sessionStorage.removeItem('cleaneco_booking_draft_v1');
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
                                        <input type="text" className="form-control form-control-sm" maxLength={80} placeholder="e.g. BDO, BPI" value={chequeDetails.bankName} onChange={(e) => setChequeDetails({...chequeDetails, bankName: e.target.value.slice(0, 80)})} required />
                                    </div>
                                    <div className="form-group mb-2">
                                        <label className="form-label small fw-bold">Cheque Number</label>
                                        <input type="text" className="form-control form-control-sm" maxLength={50} value={chequeDetails.chequeNumber} onChange={(e) => setChequeDetails({...chequeDetails, chequeNumber: e.target.value.slice(0, 50)})} required />
                                    </div>
                                    <div className="form-group mb-2">
                                        <label className="form-label small fw-bold">Account Name</label>
                                        <input type="text" className="form-control form-control-sm" maxLength={100} value={chequeDetails.accountName} onChange={(e) => setChequeDetails({...chequeDetails, accountName: e.target.value.slice(0, 100)})} required />
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

                {reorderRef && (
                    <div
                        className="alert d-flex align-items-start justify-content-between gap-2 mb-4 py-2 px-3 rounded-3 shadow-sm"
                        style={{ backgroundColor: '#f0fdf4', border: '1px solid #86efac', color: '#166534' }}
                        role="status"
                    >
                        <div className="small">
                            <i className="fas fa-redo-alt me-2 text-success"></i>
                            <strong>Re-booking from Order #{reorderRef}:</strong> Your previous services, locations, and site details have been pre-filled. Please select your preferred inspection date and time below.
                        </div>
                        <button
                            type="button"
                            className="btn-close btn-sm"
                            style={{ fontSize: '0.65rem' }}
                            onClick={() => setReorderRef('')}
                            aria-label="Dismiss notice"
                        ></button>
                    </div>
                )}

                <form onSubmit={handleInitialSubmit}>
                    <div className="name-row">
                        <div className="form-group flex-fill">
                            <label htmlFor="firstName" className="form-label fw-semibold small text-dark mb-1">First Name <span className="text-danger">*</span></label>
                            <input 
                                type="text"
                                className="form-control"
                                id="firstName"
                                maxLength={50}
                                placeholder="e.g. Juan"
                                value={formData.firstName}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="form-group flex-fill">
                            <label htmlFor="lastName" className="form-label fw-semibold small text-dark mb-1">Last Name <span className="text-danger">*</span></label>
                            <input 
                                type="text"
                                className="form-control"
                                id="lastName"
                                maxLength={50}
                                placeholder="e.g. Dela Cruz"
                                value={formData.lastName}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="contact-row">
                        <div className="form-group flex-fill">
                            <label htmlFor="email" className="form-label fw-semibold small text-dark mb-1">Email Address <span className="text-danger">*</span></label>
                            <input 
                                type="email"
                                className="form-control"
                                id="email"
                                maxLength={100}
                                placeholder="e.g. juan.delacruz@example.com"
                                value={formData.email}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="form-group flex-fill">
                            <label htmlFor="phone" className="form-label fw-semibold small text-dark mb-1">Phone Number <span className="text-danger">*</span></label>
                            <input 
                                type="tel"
                                className="form-control"
                                id="phone"
                                placeholder="e.g. (+63) 921-621-4712"
                                maxLength={18}
                                value={formData.phone}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="contact-row">
                        <div className="form-group" style={{ minWidth: '180px' }}>
                            <label className="form-label fw-semibold small text-dark mb-1">Region <span className="text-danger">*</span></label>
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
                            <small className="text-muted d-block mt-1" style={{ fontSize: '0.75rem' }}>Auto-selected from province</small>
                        </div>
                        <div className="form-group flex-fill">
                            <label className="form-label fw-semibold small text-dark mb-1">Full Service Address <span className="text-danger">*</span></label>
                            <input 
                                type="text"
                                className="form-control"
                                id="address"
                                maxLength={200}
                                placeholder="House/Unit No., Street, Barangay, City, Province"
                                value={formData.address}
                                onChange={handleChange}
                                required
                            />
                            <small className="text-muted d-block mt-1" style={{ fontSize: '0.75rem' }}>Pre-filled from profile. Edit if this service order is for another address.</small>
                        </div>
                    </div>

                    <div className="form-group mb-4">
                        <label className="form-label">Nearest Landmark (Optional)</label>
                        <input 
                            type="text"
                            className="form-control"
                            id="landmark"
                            maxLength={100}
                            placeholder="e.g. Near Brgy Hall, Beside 7-Eleven..."
                            value={formData.landmark}
                            onChange={handleChange}
                        />
                    </div>

                    {/* Residential Household Sharing / Commercial & Industrial Multi-Building Coverage */}
                    {(() => {
                        const isBiz = formData.clientType === 'commercial' || formData.clientType === 'industrial';
                        return (
                            <div className="card border-0 p-4 mb-4 shadow-sm" style={{ backgroundColor: '#ffffff', border: '1.5px solid #86efac', borderRadius: '1rem' }}>
                                <div className="mb-3">
                                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                                        <h5 className="fw-bold mb-0 d-flex align-items-center" style={{ color: '#0D8D1E' }}>
                                            <i className={`fas ${isBiz ? 'fa-building' : 'fa-home'} me-2`}></i>
                                            {isBiz ? 'Service Locations & Building / Unit Coverage' : 'Residential Household & Neighborhood Sharing'}
                                        </h5>
                                        {households.length === 1 && (
                                            <span className="badge rounded-pill px-3 py-2" style={{ backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', fontSize: '0.75rem' }}>
                                                <i className={`fas ${isBiz ? 'fa-building' : 'fa-user'} me-1`}></i>
                                                {isBiz ? 'Single Site (1 Building/Unit)' : 'Solo Booking (1 Home)'}
                                            </span>
                                        )}
                                        {households.length === 2 && (
                                            <span className="badge rounded-pill px-3 py-2" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontSize: '0.75rem' }}>
                                                <i className={`fas ${isBiz ? 'fa-city' : 'fa-user-friends'} me-1`}></i>
                                                {isBiz ? 'Multi-Unit (2 Buildings/Units)' : 'Shared (2 Homes)'}
                                            </span>
                                        )}
                                        {households.length >= 3 && (
                                            <span className="badge rounded-pill px-3 py-2" style={{ backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontSize: '0.75rem' }}>
                                                <i className={`fas ${isBiz ? 'fa-city' : 'fa-users'} me-1`}></i>
                                                {isBiz ? `Multi-Unit (${households.length} Buildings/Units)` : `Group Unlocked (${households.length} Homes)`}
                                            </span>
                                        )}
                                    </div>

                                    {/* Dynamic Savings & Coverage Feedback */}
                                    {isBiz ? (
                                        <div className="alert alert-light border border-success border-opacity-25 d-flex align-items-center mb-0 py-2 px-3 rounded-3" style={{ backgroundColor: households.length >= 3 ? '#ecfdf5' : '#f8fafc' }}>
                                            <i className={`fas ${households.length >= 3 ? 'fa-check-circle' : 'fa-info-circle'} text-success me-2 fs-6`}></i>
                                            <div className="small text-dark">
                                                {households.length === 1 && (
                                                    <>Booking for your primary facility or unit. Need multiple buildings or neighboring units serviced in the same order? <strong>You can add up to 2 additional buildings/units (3 max)!</strong></>
                                                )}
                                                {households.length === 2 && (
                                                    <><strong>2 of 3 buildings / units</strong> listed. You can add <strong>1 more building/unit</strong> under this single <strong>₱1,100</strong> reservation fee.</>
                                                )}
                                                {households.length >= 3 && (
                                                    <><strong>Maximum of 3 buildings / units reached!</strong> (1 primary site + 2 additional units). A single <strong>₱1,100</strong> reservation fee covers all 3 listed locations.</>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            {households.length === 1 && (
                                                <div className="alert alert-light border border-success border-opacity-25 d-flex align-items-center mb-0 py-2 px-3 rounded-3" style={{ backgroundColor: '#f8fafc' }}>
                                                    <i className="fas fa-info-circle text-success me-2 fs-6"></i>
                                                    <div className="small text-dark">
                                                        Booking for your home alone. Have neighbors nearby who also need service? <strong>Add up to 2 neighboring households (3 homes max) to save more!</strong>
                                                    </div>
                                                </div>
                                            )}
                                            {households.length === 2 && (
                                                <div className="alert alert-light border border-primary border-opacity-25 d-flex align-items-center mb-0 py-2 px-3 rounded-3" style={{ backgroundColor: '#eff6ff' }}>
                                                    <i className="fas fa-user-friends text-primary me-2 fs-6"></i>
                                                    <div className="small text-dark">
                                                        Great! You can add <strong>1 more neighboring household (3 homes max)</strong> to unlock maximum group savings!
                                                    </div>
                                                </div>
                                            )}
                                            {households.length >= 3 && (
                                                <div className="alert alert-light border border-success border-opacity-50 d-flex align-items-center mb-0 py-2 px-3 rounded-3" style={{ backgroundColor: '#ecfdf5' }}>
                                                    <i className="fas fa-check-circle text-success me-2 fs-6"></i>
                                                    <div className="small text-dark">
                                                        <strong>Maximum of 3 households (full 10 cu.m tanker load) reached!</strong> Maximum group savings unlocked across all 3 participating homes. A single <strong>₱1,100</strong> reservation fee covers all participating homes.
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>

                                {/* Location / Household Entries */}
                                <div className="d-flex flex-column gap-3">
                                    {households.map((household, index) => (
                                        <div 
                                            key={index} 
                                            className="p-3 rounded border"
                                            style={{ 
                                                backgroundColor: index === 0 ? '#f0fdf4' : '#ffffff',
                                                borderColor: index === 0 ? '#bbf7d0' : '#e2e8f0',
                                                overflow: 'hidden',
                                                boxSizing: 'border-box'
                                            }}
                                        >
                                            {/* Title & Status */}
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
                                                    <span className="fw-bold small text-dark">
                                                        {isBiz
                                                            ? (index === 0 ? 'Building / Unit #1 (Primary Site)' : `Neighboring Building / Unit #${index + 1}`)
                                                            : (index === 0 ? 'Household #1 (Your Home)' : `Neighbor Household #${index + 1}`)}
                                                    </span>
                                                    {index === 0 && (
                                                        <span className="badge" style={{ backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', fontSize: '0.68rem' }}>
                                                            {isBiz ? 'Primary Site' : 'Lead Applicant'}
                                                        </span>
                                                    )}
                                                    {index > 0 && (
                                                        <span className="badge bg-light text-muted border" style={{ fontSize: '0.68rem' }}>
                                                            {isBiz ? 'Additional Unit' : 'Neighbor Add-on'}
                                                        </span>
                                                    )}
                                                </div>
                                                {index > 0 && (
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-solid-danger py-0 px-2"
                                                        onClick={() => removeHousehold(index)}
                                                        title={isBiz ? "Remove building / unit" : "Remove neighbor household"}
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
                                                        maxLength={80}
                                                        placeholder={isBiz ? "Building / Unit Name or Contact" : "Resident Full Name"}
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
                                                        maxLength={150}
                                                        placeholder={isBiz ? "Building / Unit / Street Address" : "House / Lot / Street Address"}
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
                                        className="btn btn-sm btn-solid-brand rounded-pill fw-bold px-3 py-2 text-white shadow-sm"
                                        disabled={households.length >= 3}
                                        style={{ 
                                            backgroundColor: households.length >= 3 ? '#64748b' : '#0D8D1E', 
                                            border: 'none',
                                            opacity: households.length >= 3 ? 0.75 : 1,
                                            cursor: households.length >= 3 ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (households.length < 3) {
                                                e.currentTarget.style.backgroundColor = '#0A6F17';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (households.length < 3) {
                                                e.currentTarget.style.backgroundColor = '#0D8D1E';
                                            }
                                        }}
                                        onClick={addHousehold}
                                    >
                                        <i className={`fas ${households.length >= 3 ? 'fa-check-circle' : 'fa-plus'} me-1`}></i>
                                        {households.length >= 3
                                            ? (isBiz ? 'Max 3 Buildings / Units Reached' : 'Max 3 Households Reached')
                                            : (isBiz
                                                ? (households.length === 1 ? 'Add Neighboring Building / Unit (Optional)' : 'Add 1 More Building / Unit')
                                                : (households.length === 1 ? 'Add Neighboring Household (Optional)' : 'Add 1 More Neighbor'))}
                                    </button>
                                </div>
                            </div>
                        );
                    })()}

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
                                                <h6 id={`service-title-${service.id || service._id}`} className="fw-bold text-dark mb-0">{service.name}</h6>
                                                <input 
                                                    id={`service-checkbox-${service.id || service._id}`}
                                                    type="checkbox" 
                                                    className="form-check-input"
                                                    checked={isSelected}
                                                    onChange={() => {}} // click is handled by the card container
                                                    style={{ cursor: 'pointer', accentColor: '#0D8D1E' }}
                                                    aria-labelledby={`service-title-${service.id || service._id}`}
                                                    aria-label={`Select ${service.name}`}
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
                                    ₱1,100.00
                                </span>
                            </div>
                            <div className="alert alert-warning mt-3 mb-0 small py-2">
                                <div className="mb-1">
                                    <i className="fas fa-exclamation-triangle me-2"></i>
                                    Note: The Estimated Base Cost is subject to change upon physical inspection. The ₱1,100.00 payment today secures your booking and is deducted from the final bill.
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
                            maxLength={500}
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
