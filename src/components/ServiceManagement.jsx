import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import api from '../api/api';
import '../assets/styles/servicemanagement.css';
import '../assets/styles/orderdatabase.css';
import carousel7 from '../assets/styles/images/carousell7.png';
import AlertModal from './AlertModal';
import { useConfirm } from '../context/ConfirmContext';
import { calculateStartingPrice } from '../utils/pricing';

const emptyServiceTemplate = {
    name: '',
    description: '',
    status: 'available',
    pricing_mode: 'calculated',
    rate: '',
    fixed_fee: '',
    fields: []
};

function ServiceManagement() {
    const confirm = useConfirm();
    const [services, setServices] = useState([]);
    const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', type: 'info' });

    // Service Edit / Create Modal State
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [formService, setFormService] = useState(emptyServiceTemplate);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [filterName, setFilterName] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    const showAlert = (title, message, type = 'info') => {
        setModalConfig({ isOpen: true, title, message, type });
    };

    const closeAlert = () => {
        setModalConfig(prev => ({ ...prev, isOpen: false }));
    };

    const fetchServices = useCallback(async () => {
        try {
            const response = await api.get('/services');
            setServices(response.data);
        } catch (error) {
            console.error('Error fetching services:', error);
            showAlert("Error", "Failed to load services", "error");
        }
    }, []);

    useEffect(() => {
        fetchServices();
    }, [fetchServices]);

    const openAddModal = () => {
        setIsEditing(false);
        setFormService({
            ...emptyServiceTemplate,
            rate: '',
            fixed_fee: '',
            fields: []
        });
        setIsFormModalOpen(true);
    };

    const openEditModal = (service) => {
        setIsEditing(true);
        setFormService({
            id: service.id || service._id,
            name: service.name || '',
            description: service.description || '',
            status: service.status || 'available',
            pricing_mode: service.pricing_mode || 'calculated',
            rate: service.rate !== undefined ? service.rate : (service.base_price || 0),
            fixed_fee: service.fixed_fee || 0,
            base_price: service.base_price || 0,
            fields: Array.isArray(service.fields) ? JSON.parse(JSON.stringify(service.fields)) : []
        });
        setIsFormModalOpen(true);
    };

    const closeFormModal = () => {
        setIsFormModalOpen(false);
        setFormService(emptyServiceTemplate);
    };

    // Turns a human label into a safe identifier, e.g. "Trap Size" -> "trap_size"
    const slugify = (text) =>
        String(text || '').toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');

    // Appends _2, _3... until the candidate doesn't clash with any taken value
    const makeUnique = (candidate, taken) => {
        let result = candidate;
        let n = 2;
        while (taken.includes(result)) {
            result = `${candidate}_${n++}`;
        }
        return result;
    };

    // Dynamic field manipulation
    const addField = () => {
        setFormService(prev => {
            const existing = prev.fields || [];
            const nextIdx = existing.length + 1;
            const label = `New Factor ${nextIdx}`;
            const newField = {
                key: makeUnique(slugify(label), existing.map(f => f.key)),
                // Key keeps following the label until the service is saved
                _autoKey: true,
                label,
                type: 'number',
                min: 1,
                default: 1,
                counts_toward_trips: false,
                options: []
            };
            return { ...prev, fields: [...existing, newField] };
        });
    };

    const updateField = (index, updates) => {
        setFormService(prev => {
            const updated = [...(prev.fields || [])];
            const current = updated[index];
            const merged = { ...current, ...updates };

            // If type changed to multiplier or surcharge, initialize options if empty
            if (updates.type && updates.type !== current.type) {
                if (updates.type === 'multiplier' && (!merged.options || merged.options.length === 0)) {
                    merged.options = [
                        { value: 'standard', label: 'Standard', factor: 1, amount: 0, requires_photo: false, _autoValue: true },
                        { value: 'large', label: 'Large', factor: 2, amount: 0, requires_photo: false, _autoValue: true }
                    ];
                    merged.default = 'standard';
                } else if (updates.type === 'surcharge' && (!merged.options || merged.options.length === 0)) {
                    merged.options = [
                        { value: 'standard_access', label: 'Standard Access', factor: 1, amount: 0, requires_photo: false, _autoValue: true },
                        { value: 'difficult_access', label: 'Difficult Access', factor: 1, amount: 1500, requires_photo: true, _autoValue: true }
                    ];
                    merged.default = 'standard_access';
                }
            }

            // New (unsaved) fields: re-derive the key from the FULL label on every edit,
            // keeping it unique among the other fields. Saved fields keep their key so
            // existing orders still map their answers correctly.
            if (updates.label !== undefined && (current._autoKey || !current.key)) {
                const otherKeys = updated.filter((_, i) => i !== index).map(f => f.key);
                merged.key = makeUnique(slugify(updates.label) || `field_${index + 1}`, otherKeys);
            }

            updated[index] = merged;
            return { ...prev, fields: updated };
        });
    };

    const removeField = (index) => {
        setFormService(prev => ({
            ...prev,
            fields: prev.fields.filter((_, i) => i !== index)
        }));
    };

    // Option manipulation within a dropdown field
    const addOption = (fieldIndex) => {
        setFormService(prev => {
            const updated = [...(prev.fields || [])];
            const field = { ...updated[fieldIndex] };
            const opts = [...(field.options || [])];
            const optIdx = opts.length + 1;
            const label = `Option ${optIdx}`;
            opts.push({
                value: makeUnique(slugify(label), opts.map(o => String(o.value))),
                _autoValue: true,
                label,
                factor: 1,
                amount: 0,
                requires_photo: false
            });
            field.options = opts;
            updated[fieldIndex] = field;
            return { ...prev, fields: updated };
        });
    };

    const updateOption = (fieldIndex, optionIndex, updates) => {
        setFormService(prev => {
            const updated = [...(prev.fields || [])];
            const field = { ...updated[fieldIndex] };
            const opts = [...(field.options || [])];
            const current = opts[optionIndex];
            const merged = { ...current, ...updates };

            // New (unsaved) options: keep the stored value in sync with the label,
            // unique within this dropdown (so "Medium" is stored as "medium", not "large").
            if (updates.label !== undefined && current._autoValue) {
                const otherValues = opts.filter((_, i) => i !== optionIndex).map(o => String(o.value));
                merged.value = makeUnique(slugify(updates.label) || `option_${optionIndex + 1}`, otherValues);
                // If this option was the default, keep the default pointing at it
                if (String(field.default) === String(current.value)) {
                    field.default = merged.value;
                }
            }

            opts[optionIndex] = merged;
            field.options = opts;
            updated[fieldIndex] = field;
            return { ...prev, fields: updated };
        });
    };

    const removeOption = (fieldIndex, optionIndex) => {
        setFormService(prev => {
            const updated = [...(prev.fields || [])];
            const field = { ...updated[fieldIndex] };
            const removed = (field.options || [])[optionIndex];
            field.options = (field.options || []).filter((_, i) => i !== optionIndex);
            // Don't leave the default pointing at a deleted option
            if (removed && String(field.default) === String(removed.value)) {
                field.default = field.options[0]?.value ?? '';
            }
            updated[fieldIndex] = field;
            return { ...prev, fields: updated };
        });
    };

    const handleSaveService = async (e) => {
        e.preventDefault();
        if (!formService.name || !formService.name.trim()) {
            showAlert("Required", "Please provide a service name.", "warning");
            return;
        }

        setIsSaving(true);
        const cleanFields = (formService.fields || []).map(f => {
            const { _autoKey, ...restField } = f;
            const cleanOptions = (f.options || []).map(opt => {
                const { _autoValue, ...restOpt } = opt;
                return restOpt;
            });
            return {
                ...restField,
                options: cleanOptions
            };
        });

        const payload = {
            ...formService,
            fields: cleanFields,
            rate: parseFloat(formService.rate) || 0,
            fixed_fee: parseFloat(formService.fixed_fee) || 0
        };

        try {
            if (isEditing) {
                const response = await api.put(`/services/${formService.id}`, payload);
                if (response.data.success) {
                    showAlert("Success", "Service updated successfully", "success");
                    closeFormModal();
                    fetchServices();
                } else {
                    showAlert("Warning", response.data.message || "Failed to update service", "warning");
                }
            } else {
                const response = await api.post('/services', payload);
                if (response.data.success) {
                    showAlert("Success", "Service added successfully", "success");
                    closeFormModal();
                    fetchServices();
                } else {
                    showAlert("Warning", response.data.message || "Failed to add service", "warning");
                }
            }
        } catch (error) {
            console.error('Error saving service:', error);
            showAlert("Error", error.response?.data?.message || "Failed to save service", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const promptDelete = async (id) => {
        const isConfirmed = await confirm({
            title: "Confirm Deletion",
            text: "Are you sure you want to delete this service? If customers have orders for it, it cannot be deleted.",
            confirmLabel: "Delete",
            confirmVariant: "danger"
        });

        if (isConfirmed) {
            try {
                const response = await api.delete('/services/' + id);
                if (response.data.success) {
                    showAlert("Success", "Service deleted successfully", "success");
                    fetchServices();
                } else {
                    showAlert("Warning", response.data.message || "Failed to delete service", "warning");
                }
            } catch (error) {
                console.error('Error deleting service:', error);
                showAlert("Cannot Delete", error.response?.data?.message || "Failed to delete service", "error");
            }
        }
    };

    const toggleServiceStatus = async (service) => {
        const newStatus = service.status === 'available' ? 'unavailable' : 'available';
        try {
            const response = await api.put('/services/' + service.id, {
                status: newStatus
            });
            if (response.data.success) {
                showAlert("Success", `Service marked as ${newStatus}`, "success");
                fetchServices();
            } else {
                showAlert("Warning", response.data.message || "Failed to update service status", "warning");
            }
        } catch (error) {
            console.error('Error updating service status:', error);
            showAlert("Error", error.response?.data?.message || "Failed to update service status", "error");
        }
    };

    const uniqueServiceNames = [...new Set(services.map(s => s.name))].sort();

    const filteredServices = services.filter(service => {
        const matchName = filterName === '' || service.name === filterName;
        const matchStatus = filterStatus === '' || service.status === filterStatus;
        return matchName && matchStatus;
    });

    const currentStartingPrice = calculateStartingPrice(formService);

    return (
        <>
            <AlertModal
                isOpen={modalConfig.isOpen}
                title={modalConfig.title}
                message={modalConfig.message}
                type={modalConfig.type}
                onClose={closeAlert}
            />

            <div>
                <img className="img-fluid banner-img" src={carousel7} alt="Banner" />

                <section className="section-bg">
                    <div className="table-box">
                        <div className="d-flex justify-content-between align-items-center mb-4">
                            <h3 className="mb-0 fw-bold">Service Management</h3>
                            <button className="btn btn-success" onClick={openAddModal}>
                                <i className="fas fa-plus me-2"></i>Add New Service
                            </button>
                        </div>

                        {/* Services List Table */}
                        <div className="card shadow-sm border-0">
                            <div className="card-header bg-success text-white py-3">
                                <h4 className="mb-0 text-white">Services List</h4>
                            </div>
                            <div className="card-body">
                                <div className="filters-container mb-3 d-flex gap-3 align-items-center flex-wrap">
                                    <select
                                        className="form-select"
                                        style={{ width: '250px' }}
                                        value={filterName}
                                        onChange={(e) => setFilterName(e.target.value)}
                                    >
                                        <option value="">Filter by Service Name</option>
                                        {uniqueServiceNames.map(name => (
                                            <option key={name} value={name}>{name}</option>
                                        ))}
                                    </select>
                                    <select
                                        className="form-select"
                                        style={{ width: '200px' }}
                                        value={filterStatus}
                                        onChange={(e) => setFilterStatus(e.target.value)}
                                    >
                                        <option value="">All Statuses</option>
                                        <option value="available">Available</option>
                                        <option value="unavailable">Unavailable</option>
                                    </select>
                                    <button
                                        className="btn btn-secondary m-0 d-flex align-items-center justify-content-center"
                                        style={{ borderRadius: '10px', padding: '0 20px', height: '38px' }}
                                        onClick={() => { setFilterName(''); setFilterStatus(''); }}
                                    >
                                        Clear Filters
                                    </button>
                                </div>
                                <div className="table-responsive">
                                    <table className="table table-hover align-middle">
                                        <thead className="table-light">
                                            <tr>
                                                <th>ID</th>
                                                <th>Name</th>
                                                <th>Description</th>
                                                <th>Pricing Setup</th>
                                                <th>Starting At</th>
                                                <th>Status</th>
                                                <th className="text-center">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredServices.length === 0 ? (
                                                <tr>
                                                    <td colSpan="7" className="text-center py-4 text-muted">No services found.</td>
                                                </tr>
                                            ) : (
                                                filteredServices.map(service => {
                                                    const isInspectionOnly = service.pricing_mode === 'inspection_only';
                                                    const displayStartingPrice = isInspectionOnly 
                                                        ? null 
                                                        : (service.starting_price !== undefined ? service.starting_price : calculateStartingPrice(service));

                                                    return (
                                                        <tr key={service.id || service._id}>
                                                            <td className="small text-muted font-monospace">{service.id || service._id}</td>
                                                            <td className="fw-bold text-dark">{service.name}</td>
                                                            <td className="small text-secondary" style={{ maxWidth: '280px' }}>
                                                                {service.description || '-'}
                                                            </td>
                                                            <td>
                                                                {isInspectionOnly ? (
                                                                    <span className="badge bg-info text-dark">Inspection Only</span>
                                                                ) : (
                                                                    <div className="small">
                                                                        <span className="fw-bold text-success">Rate: ₱{parseFloat(service.rate || 0).toLocaleString()}</span>
                                                                        {service.fixed_fee > 0 && <span className="text-muted ms-1">+ ₱{parseFloat(service.fixed_fee).toLocaleString()} fee</span>}
                                                                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                                                                            {(service.fields || []).length} dynamic factor{(service.fields || []).length === 1 ? '' : 's'}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="fw-bold">
                                                                {isInspectionOnly ? (
                                                                    <span className="text-muted small">On-site Quote</span>
                                                                ) : (
                                                                    <span className="text-success">
                                                                        ₱{parseFloat(displayStartingPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td>
                                                                <span className={`badge ${service.status === 'available' ? 'bg-success' : 'bg-danger'}`}>
                                                                    {service.status}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <div className="d-flex gap-2 justify-content-center align-items-center">
                                                                    <button
                                                                        className="btn btn-sm btn-primary text-nowrap"
                                                                        onClick={() => openEditModal(service)}
                                                                    >
                                                                        <i className="fas fa-edit me-1"></i>Edit
                                                                    </button>

                                                                    <button
                                                                        className={`btn btn-sm text-nowrap ${service.status === 'available' ? 'btn-warning' : 'btn-success'}`}
                                                                        onClick={() => toggleServiceStatus(service)}
                                                                    >
                                                                        {service.status === 'available' ? 'Make Unavailable' : 'Make Available'}
                                                                    </button>

                                                                    <button
                                                                        className="btn btn-sm btn-danger text-nowrap"
                                                                        onClick={() => promptDelete(service.id || service._id)}
                                                                    >
                                                                        <i className="fas fa-trash me-1"></i>Delete
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            {/* Service & Pricing Configuration Modal */}
            {/* Service & Pricing Configuration Modal */}
            {isFormModalOpen && createPortal(
                <div
                    className="service-modal-overlay"
                    tabIndex="-1"
                    onClick={closeFormModal}
                >
                    <div
                        className="service-modal-dialog"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="service-modal-content shadow-lg">
                            {/* Modal Header */}
                            <div className="service-modal-header">
                                <h5 className="modal-title">
                                    <i className="fas fa-sliders-h me-2"></i>
                                    <span>
                                        {isEditing ? `Edit Service: ${formService.name}` : 'Add New Service & Pricing Configuration'}
                                    </span>
                                </h5>
                                <button
                                    type="button"
                                    className="btn-close btn-close-white"
                                    onClick={closeFormModal}
                                    aria-label="Close"
                                ></button>
                            </div>

                            {/* Form container */}
                            <form
                                className="service-modal-form"
                                onSubmit={handleSaveService}
                            >
                                {/* Scrollable Modal Body */}
                                <div className="service-modal-body">
                                    {/* Section 1: General Information */}
                                    <div className="d-flex align-items-center mb-3 pb-2 border-bottom">
                                        <span
                                            className="d-inline-flex align-items-center justify-content-center rounded-circle me-2"
                                            style={{ width: '28px', height: '28px', backgroundColor: '#e8f5e9', color: '#0D8D1E' }}
                                        >
                                            <i className="fas fa-info-circle" style={{ fontSize: '0.85rem' }}></i>
                                        </span>
                                        <h6 className="fw-bold mb-0" style={{ color: '#0D8D1E', fontSize: '1rem', letterSpacing: '0.2px' }}>
                                            General Information
                                        </h6>
                                    </div>
                                    <div className="row g-3 mb-3">
                                        <div className="col-md-8">
                                            <label className="form-label fw-bold small text-dark mb-1">Service Name *</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="e.g. Grease Trap Cleaning"
                                                value={formService.name}
                                                onChange={(e) => setFormService({ ...formService, name: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="col-md-4">
                                            <label className="form-label fw-bold small text-dark mb-1">Status</label>
                                            <select
                                                className="form-select"
                                                value={formService.status}
                                                onChange={(e) => setFormService({ ...formService, status: e.target.value })}
                                            >
                                                <option value="available">Available</option>
                                                <option value="unavailable">Unavailable</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="row g-3 mb-4">
                                        <div className="col-12">
                                            <label className="form-label fw-bold small text-dark mb-1">Description</label>
                                            <textarea
                                                className="form-control"
                                                rows="2"
                                                placeholder="Briefly describe what this service includes..."
                                                value={formService.description}
                                                onChange={(e) => setFormService({ ...formService, description: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    {/* Section 2: Pricing Setup */}
                                    <div className="d-flex align-items-center mb-3 pb-2 border-bottom mt-4">
                                        <span
                                            className="d-inline-flex align-items-center justify-content-center rounded-circle me-2"
                                            style={{ width: '28px', height: '28px', backgroundColor: '#e8f5e9', color: '#0D8D1E' }}
                                        >
                                            <i className="fas fa-calculator" style={{ fontSize: '0.85rem' }}></i>
                                        </span>
                                        <h6 className="fw-bold mb-0" style={{ color: '#0D8D1E', fontSize: '1rem', letterSpacing: '0.2px' }}>
                                            Pricing Setup
                                        </h6>
                                    </div>

                                    {/* Pricing Mode Interactive Cards */}
                                    <div className="row g-3 mb-4">
                                        <div className="col-md-6">
                                            <div
                                                className="p-3 rounded-3 border h-100"
                                                style={{
                                                    cursor: 'pointer',
                                                    borderColor: formService.pricing_mode === 'calculated' ? '#0D8D1E' : '#e2e8f0',
                                                    backgroundColor: formService.pricing_mode === 'calculated' ? '#f0fdf4' : '#fff',
                                                    transition: 'all 0.2s ease',
                                                    borderWidth: formService.pricing_mode === 'calculated' ? '2px' : '1px'
                                                }}
                                                onClick={() => setFormService({ ...formService, pricing_mode: 'calculated' })}
                                            >
                                                <div className="form-check mb-1">
                                                    <input
                                                        className="form-check-input"
                                                        type="radio"
                                                        name="pricingMode"
                                                        id="modeCalculated"
                                                        value="calculated"
                                                        checked={formService.pricing_mode === 'calculated'}
                                                        onChange={() => setFormService({ ...formService, pricing_mode: 'calculated' })}
                                                        style={{ accentColor: '#0D8D1E', cursor: 'pointer' }}
                                                    />
                                                    <label className="form-check-label fw-bold text-dark cursor-pointer ms-1" htmlFor="modeCalculated">
                                                        Calculated Estimate
                                                    </label>
                                                </div>
                                                <small className="text-secondary d-block ps-4">
                                                    Interactive formula based on client questionnaire answers and surcharges.
                                                </small>
                                            </div>
                                        </div>
                                        <div className="col-md-6">
                                            <div
                                                className="p-3 rounded-3 border h-100"
                                                style={{
                                                    cursor: 'pointer',
                                                    borderColor: formService.pricing_mode === 'inspection_only' ? '#0D8D1E' : '#e2e8f0',
                                                    backgroundColor: formService.pricing_mode === 'inspection_only' ? '#f0fdf4' : '#fff',
                                                    transition: 'all 0.2s ease',
                                                    borderWidth: formService.pricing_mode === 'inspection_only' ? '2px' : '1px'
                                                }}
                                                onClick={() => setFormService({ ...formService, pricing_mode: 'inspection_only' })}
                                            >
                                                <div className="form-check mb-1">
                                                    <input
                                                        className="form-check-input"
                                                        type="radio"
                                                        name="pricingMode"
                                                        id="modeInspectionOnly"
                                                        value="inspection_only"
                                                        checked={formService.pricing_mode === 'inspection_only'}
                                                        onChange={() => setFormService({ ...formService, pricing_mode: 'inspection_only' })}
                                                        style={{ accentColor: '#0D8D1E', cursor: 'pointer' }}
                                                    />
                                                    <label className="form-check-label fw-bold text-dark cursor-pointer ms-1" htmlFor="modeInspectionOnly">
                                                        Inspection Only
                                                    </label>
                                                </div>
                                                <small className="text-secondary d-block ps-4">
                                                    No upfront estimate; price will be determined and quoted after site inspection.
                                                </small>
                                            </div>
                                        </div>
                                    </div>

                                    {formService.pricing_mode === 'calculated' && (
                                        <>
                                            {/* Rates configuration */}
                                            <div className="p-3 rounded-3 border mb-4" style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
                                                <div className="row g-3">
                                                    <div className="col-md-6">
                                                        <label className="form-label fw-bold small text-dark mb-1">Base Rate (₱) *</label>
                                                        <div className="input-group">
                                                            <span className="input-group-text">₱</span>
                                                            <input
                                                                type="number"
                                                                className="form-control"
                                                                min="0"
                                                                step="any"
                                                                placeholder="0"
                                                                value={formService.rate === 0 && !isEditing ? '' : (formService.rate ?? '')}
                                                                onFocus={(e) => e.target.select()}
                                                                onChange={(e) => setFormService({ ...formService, rate: e.target.value })}
                                                            />
                                                        </div>
                                                        <small className="text-muted d-block mt-1" style={{ fontSize: '0.75rem' }}>
                                                            The primary per-unit price multiplied by factors.
                                                        </small>
                                                    </div>
                                                    <div className="col-md-6">
                                                        <label className="form-label fw-bold small text-dark mb-1">Fixed Fee (₱) (Optional)</label>
                                                        <div className="input-group">
                                                            <span className="input-group-text">₱</span>
                                                            <input
                                                                type="number"
                                                                className="form-control"
                                                                min="0"
                                                                step="any"
                                                                placeholder="0"
                                                                value={formService.fixed_fee === 0 && !isEditing ? '' : (formService.fixed_fee ?? '')}
                                                                onFocus={(e) => e.target.select()}
                                                                onChange={(e) => setFormService({ ...formService, fixed_fee: e.target.value })}
                                                            />
                                                        </div>
                                                        <small className="text-muted d-block mt-1" style={{ fontSize: '0.75rem' }}>
                                                            Always added flat (e.g. mobilization or base callout charge).
                                                        </small>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Dynamic Pricing Fields */}
                                            <div className="mb-4">
                                                <div className="d-flex justify-content-between align-items-center mb-3">
                                                    <div className="d-flex align-items-center">
                                                        <span
                                                            className="d-inline-flex align-items-center justify-content-center rounded-circle me-2"
                                                            style={{ width: '28px', height: '28px', backgroundColor: '#e8f5e9', color: '#0D8D1E' }}
                                                        >
                                                            <i className="fas fa-layer-group" style={{ fontSize: '0.85rem' }}></i>
                                                        </span>
                                                        <div>
                                                            <span className="fw-bold text-dark small d-block">
                                                                Pricing Factors / Fields (Client Questions)
                                                            </span>
                                                            <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                                                                {(formService.fields || []).length} factor{(formService.fields || []).length === 1 ? '' : 's'} configured
                                                            </small>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-cleaneco rounded-pill px-3 fw-bold shadow-sm"
                                                        onClick={addField}
                                                    >
                                                        <i className="fas fa-plus me-1"></i>Add Factor Field
                                                    </button>
                                                </div>

                                                {(formService.fields || []).length === 0 ? (
                                                    <div className="p-4 text-center text-muted bg-light rounded-3 border border-dashed mb-3">
                                                        <i className="fas fa-layer-group fa-2x mb-2 text-secondary opacity-50 d-block"></i>
                                                        <p className="mb-1 fw-bold small text-dark">No custom factors added yet.</p>
                                                        <p className="mb-0 small text-muted">
                                                            This service will charge a flat rate of ₱{(formService.rate || 0).toLocaleString()} with no extra client questions.
                                                        </p>
                                                    </div>
                                                ) : (
                                                    (formService.fields || []).map((field, fIdx) => (
                                                        <div
                                                            key={fIdx}
                                                            className="card border mb-3 shadow-none bg-white"
                                                            style={{ borderRadius: '12px', overflow: 'hidden', borderColor: '#e2e8f0' }}
                                                        >
                                                            <div className="card-header py-2 px-3 d-flex justify-content-between align-items-center" style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                                <div className="d-flex align-items-center">
                                                                    <span className="badge me-2" style={{ backgroundColor: '#e0f2fe', color: '#0369a1', fontSize: '0.75rem' }}>
                                                                        Factor #{fIdx + 1}
                                                                    </span>
                                                                    <span className="fw-bold small text-dark">
                                                                        {field.label || 'Untitled Factor'}
                                                                    </span>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-sm text-danger p-0 border-0 text-decoration-none fw-bold"
                                                                    style={{ fontSize: '0.8rem' }}
                                                                    onClick={() => removeField(fIdx)}
                                                                >
                                                                    <i className="fas fa-trash-alt me-1"></i>Delete
                                                                </button>
                                                            </div>
                                                            <div className="card-body p-3">
                                                                <div className="row g-3 mb-3">
                                                                    <div className="col-md-7">
                                                                        <label className="form-label small mb-1 fw-bold text-dark">Question / Label *</label>
                                                                        <input
                                                                            type="text"
                                                                            className="form-control form-control-sm"
                                                                            placeholder="e.g. Number of Septic Tanks"
                                                                            value={field.label}
                                                                            onChange={(e) => updateField(fIdx, { label: e.target.value })}
                                                                            required
                                                                        />
                                                                    </div>
                                                                    <div className="col-md-5">
                                                                        <label className="form-label small mb-1 fw-bold text-dark">Factor Type</label>
                                                                        <select
                                                                            className="form-select form-select-sm"
                                                                            value={field.type}
                                                                            onChange={(e) => updateField(fIdx, { type: e.target.value })}
                                                                        >
                                                                            <option value="number">Number Input (Multiplies Rate)</option>
                                                                            <option value="multiplier">Dropdown - Multiplier (e.g. Size ×1, ×2)</option>
                                                                            <option value="surcharge">Dropdown - Surcharge (e.g. Access +₱1,500)</option>
                                                                        </select>
                                                                    </div>
                                                                </div>

                                                                <div className="form-check mb-3 p-2 bg-light rounded-2 border">
                                                                    <input
                                                                        className="form-check-input ms-1"
                                                                        type="checkbox"
                                                                        id={`tripsCheck_${fIdx}`}
                                                                        checked={Boolean(field.counts_toward_trips)}
                                                                        onChange={(e) => updateField(fIdx, { counts_toward_trips: e.target.checked })}
                                                                        style={{ accentColor: '#0D8D1E' }}
                                                                    />
                                                                    <label className="form-check-label small ms-2 text-dark" htmlFor={`tripsCheck_${fIdx}`}>
                                                                        <strong>Counts toward trips</strong> — Multiplies truck trips for scheduling & fleet management
                                                                    </label>
                                                                </div>

                                                                {field.type === 'number' ? (
                                                                    <div className="row g-3">
                                                                         <div className="col-6">
                                                                            <label className="form-label small mb-1 text-muted">Minimum Value</label>
                                                                            <input
                                                                                type="number"
                                                                                className="form-control form-control-sm"
                                                                                value={field.min ?? 1}
                                                                                onFocus={(e) => e.target.select()}
                                                                                onChange={(e) => updateField(fIdx, { min: e.target.value === '' ? '' : parseInt(e.target.value) })}
                                                                            />
                                                                        </div>
                                                                        <div className="col-6">
                                                                            <label className="form-label small mb-1 text-muted">Default Value</label>
                                                                            <input
                                                                                type="number"
                                                                                className="form-control form-control-sm"
                                                                                value={field.default ?? 1}
                                                                                onFocus={(e) => e.target.select()}
                                                                                onChange={(e) => updateField(fIdx, { default: e.target.value === '' ? '' : parseInt(e.target.value) })}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="mt-2 p-3 bg-light rounded-3 border">
                                                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                                                            <span className="small fw-bold text-dark">
                                                                                <i className="fas fa-list me-1 text-secondary"></i>Dropdown Options
                                                                            </span>
                                                                            <button
                                                                                type="button"
                                                                                className="btn btn-sm btn-outline-cleaneco rounded-pill px-2 py-0 fw-bold"
                                                                                style={{ fontSize: '0.75rem' }}
                                                                                onClick={() => addOption(fIdx)}
                                                                            >
                                                                                <i className="fas fa-plus me-1"></i>Add Option
                                                                            </button>
                                                                        </div>
                                                                        {(field.options || []).map((opt, oIdx) => (
                                                                            <div key={oIdx} className="d-flex gap-2 align-items-center mb-2">
                                                                                <input
                                                                                    type="text"
                                                                                    className="form-control form-control-sm"
                                                                                    placeholder="Option Label"
                                                                                    style={{ flex: '3 1 180px', height: '34px' }}
                                                                                    value={opt.label}
                                                                                    onChange={(e) => updateOption(fIdx, oIdx, { label: e.target.value })}
                                                                                    required
                                                                                />
                                                                                {field.type === 'multiplier' ? (
                                                                                    <div className="input-group input-group-sm" style={{ flex: '2 1 120px', height: '34px' }}>
                                                                                        <span className="input-group-text">×</span>
                                                                                        <input
                                                                                            type="number"
                                                                                            step="0.1"
                                                                                            className="form-control"
                                                                                            placeholder="1"
                                                                                            value={opt.factor ?? ''}
                                                                                            onFocus={(e) => e.target.select()}
                                                                                            onChange={(e) => updateOption(fIdx, oIdx, { factor: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                                                                                        />
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="input-group input-group-sm" style={{ flex: '2 1 130px', height: '34px' }}>
                                                                                        <span className="input-group-text">+₱</span>
                                                                                        <input
                                                                                            type="number"
                                                                                            step="any"
                                                                                            className="form-control"
                                                                                            placeholder="0"
                                                                                            value={opt.amount === 0 ? '' : (opt.amount ?? '')}
                                                                                            onFocus={(e) => e.target.select()}
                                                                                            onChange={(e) => updateOption(fIdx, oIdx, { amount: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                                                                                        />
                                                                                    </div>
                                                                                )}

                                                                                {field.type === 'surcharge' && (
                                                                                    <div
                                                                                        className="d-flex align-items-center gap-1 ms-1 text-nowrap"
                                                                                        style={{ height: '34px' }}
                                                                                        title="Prompt client for a photo when this option is selected"
                                                                                    >
                                                                                        <input
                                                                                            className="form-check-input m-0"
                                                                                            type="checkbox"
                                                                                            id={`optPhoto_${fIdx}_${oIdx}`}
                                                                                            checked={Boolean(opt.requires_photo)}
                                                                                            onChange={(e) => updateOption(fIdx, oIdx, { requires_photo: e.target.checked })}
                                                                                            style={{ accentColor: '#0D8D1E', cursor: 'pointer', width: '16px', height: '16px' }}
                                                                                        />
                                                                                        <label
                                                                                            className="form-check-label small cursor-pointer m-0 ms-1 text-dark"
                                                                                            htmlFor={`optPhoto_${fIdx}_${oIdx}`}
                                                                                            style={{ lineHeight: '1', userSelect: 'none', fontSize: '0.85rem' }}
                                                                                        >
                                                                                            Photo
                                                                                        </label>
                                                                                    </div>
                                                                                )}

                                                                                <button
                                                                                    type="button"
                                                                                    className="btn btn-sm btn-outline-danger border-0 d-inline-flex align-items-center justify-content-center p-0"
                                                                                    style={{ width: '34px', height: '34px', borderRadius: '6px' }}
                                                                                    onClick={() => removeOption(fIdx, oIdx)}
                                                                                    disabled={(field.options || []).length <= 1}
                                                                                    title="Delete option"
                                                                                >
                                                                                    <i className="fas fa-times"></i>
                                                                                </button>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>

                                            {/* Live Starting Price Preview */}
                                            <div
                                                className="p-3 rounded-3 d-flex justify-content-between align-items-center mb-2"
                                                style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}
                                            >
                                                <div>
                                                    <span className="fw-bold text-success d-flex align-items-center">
                                                        <i className="fas fa-tag me-2"></i>Starting Price Preview
                                                    </span>
                                                    <small className="text-secondary">
                                                        Calculated automatically using initial/default selections
                                                    </small>
                                                </div>
                                                <div className="fs-3 fw-bold text-success">
                                                    ₱{currentStartingPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Modal Footer (Sticky Bottom) */}
                                <div className="service-modal-footer">
                                    <button
                                        type="button"
                                        className="btn btn-light rounded-pill px-4 fw-bold shadow-sm border"
                                        onClick={closeFormModal}
                                        disabled={isSaving}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-success rounded-pill px-4 fw-bold shadow-sm"
                                        style={{ backgroundColor: '#0D8D1E', borderColor: '#0D8D1E' }}
                                        disabled={isSaving}
                                    >
                                        {isSaving ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Service')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            , document.body)}
        </>
    );
}

export default ServiceManagement;