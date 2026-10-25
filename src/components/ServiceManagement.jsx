import React, { useState, useEffect, useCallback } from 'react';
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
    rate: 0,
    fixed_fee: 0,
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

    // Dynamic field manipulation
    const addField = () => {
        const nextIdx = (formService.fields || []).length + 1;
        const newField = {
            key: `field_${nextIdx}`,
            label: `New Factor ${nextIdx}`,
            type: 'number',
            min: 1,
            default: 1,
            counts_toward_trips: false,
            options: []
        };
        setFormService(prev => ({
            ...prev,
            fields: [...(prev.fields || []), newField]
        }));
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
                        { value: 'standard', label: 'Standard', factor: 1, amount: 0, requires_photo: false },
                        { value: 'large', label: 'Large', factor: 2, amount: 0, requires_photo: false }
                    ];
                    merged.default = 'standard';
                } else if (updates.type === 'surcharge' && (!merged.options || merged.options.length === 0)) {
                    merged.options = [
                        { value: 'standard', label: 'Standard Access', factor: 1, amount: 0, requires_photo: false },
                        { value: 'difficult', label: 'Difficult Access', factor: 1, amount: 1500, requires_photo: true }
                    ];
                    merged.default = 'standard';
                }
            }

            // Automatically format key if label is changed and key was derived
            if (updates.label && (!current.key || current.key.startsWith('field_'))) {
                merged.key = updates.label.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '');
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
            opts.push({
                value: `option_${optIdx}`,
                label: `Option ${optIdx}`,
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
            opts[optionIndex] = { ...opts[optionIndex], ...updates };
            field.options = opts;
            updated[fieldIndex] = field;
            return { ...prev, fields: updated };
        });
    };

    const removeOption = (fieldIndex, optionIndex) => {
        setFormService(prev => {
            const updated = [...(prev.fields || [])];
            const field = { ...updated[fieldIndex] };
            field.options = (field.options || []).filter((_, i) => i !== optionIndex);
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
        try {
            if (isEditing) {
                const response = await api.put(`/services/${formService.id}`, formService);
                if (response.data.success) {
                    showAlert("Success", "Service updated successfully", "success");
                    closeFormModal();
                    fetchServices();
                } else {
                    showAlert("Warning", response.data.message || "Failed to update service", "warning");
                }
            } else {
                const response = await api.post('/services', formService);
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
            {isFormModalOpen && (
                <div
                    className="modal show d-block"
                    tabIndex="-1"
                    style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}
                >
                    <div className="modal-dialog modal-lg modal-dialog-scrollable">
                        <div className="modal-content border-0 shadow-lg">
                            <div className="modal-header bg-success text-white">
                                <h5 className="modal-title fw-bold">
                                    <i className="fas fa-sliders-h me-2"></i>
                                    {isEditing ? `Edit Service: ${formService.name}` : 'Add New Service & Pricing Configuration'}
                                </h5>
                                <button type="button" className="btn-close btn-close-white" onClick={closeFormModal}></button>
                            </div>
                            <form onSubmit={handleSaveService}>
                                <div className="modal-body p-4">
                                    {/* General Information */}
                                    <h6 className="fw-bold text-success border-bottom pb-2 mb-3">General Information</h6>
                                    <div className="row mb-3">
                                        <div className="col-md-8">
                                            <label className="form-label fw-bold small">Service Name *</label>
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
                                            <label className="form-label fw-bold small">Status</label>
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

                                    <div className="mb-4">
                                        <label className="form-label fw-bold small">Description</label>
                                        <textarea
                                            className="form-control"
                                            rows="2"
                                            placeholder="Briefly describe what this service includes..."
                                            value={formService.description}
                                            onChange={(e) => setFormService({ ...formService, description: e.target.value })}
                                        />
                                    </div>

                                    {/* Pricing Setup */}
                                    <h6 className="fw-bold text-success border-bottom pb-2 mb-3">Pricing Setup</h6>
                                    <div className="mb-3">
                                        <label className="form-label fw-bold small d-block">Pricing Mode</label>
                                        <div className="d-flex gap-4">
                                            <div className="form-check">
                                                <input
                                                    className="form-check-input"
                                                    type="radio"
                                                    name="pricingMode"
                                                    id="modeCalculated"
                                                    value="calculated"
                                                    checked={formService.pricing_mode === 'calculated'}
                                                    onChange={() => setFormService({ ...formService, pricing_mode: 'calculated' })}
                                                />
                                                <label className="form-check-label" htmlFor="modeCalculated">
                                                    <strong>Calculated Estimate</strong> (Formula based on client inputs)
                                                </label>
                                            </div>
                                            <div className="form-check">
                                                <input
                                                    className="form-check-input"
                                                    type="radio"
                                                    name="pricingMode"
                                                    id="modeInspectionOnly"
                                                    value="inspection_only"
                                                    checked={formService.pricing_mode === 'inspection_only'}
                                                    onChange={() => setFormService({ ...formService, pricing_mode: 'inspection_only' })}
                                                />
                                                <label className="form-check-label" htmlFor="modeInspectionOnly">
                                                    <strong>Inspection Only</strong> (No initial estimate; price quoted after site visit)
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    {formService.pricing_mode === 'calculated' && (
                                        <>
                                            <div className="row mb-3 bg-light p-3 rounded border">
                                                <div className="col-md-6">
                                                    <label className="form-label fw-bold small">Base Rate (₱) *</label>
                                                    <input
                                                        type="number"
                                                        className="form-control"
                                                        min="0"
                                                        step="1"
                                                        placeholder="e.g. 8000"
                                                        value={formService.rate}
                                                        onChange={(e) => setFormService({ ...formService, rate: parseFloat(e.target.value) || 0 })}
                                                    />
                                                    <small className="text-muted">The primary per-unit price multiplied by factors.</small>
                                                </div>
                                                <div className="col-md-6">
                                                    <label className="form-label fw-bold small">Fixed Fee (₱) (Optional)</label>
                                                    <input
                                                        type="number"
                                                        className="form-control"
                                                        min="0"
                                                        step="1"
                                                        placeholder="e.g. 0"
                                                        value={formService.fixed_fee}
                                                        onChange={(e) => setFormService({ ...formService, fixed_fee: parseFloat(e.target.value) || 0 })}
                                                    />
                                                    <small className="text-muted">Always added flat (e.g. mobilization charge).</small>
                                                </div>
                                            </div>

                                            {/* Dynamic Pricing Fields */}
                                            <div className="mb-3">
                                                <div className="d-flex justify-content-between align-items-center mb-2">
                                                    <label className="form-label fw-bold small mb-0">
                                                        Pricing Factors / Fields (Client Questions)
                                                    </label>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-success"
                                                        onClick={addField}
                                                    >
                                                        <i className="fas fa-plus me-1"></i>Add Field
                                                    </button>
                                                </div>

                                                {(formService.fields || []).length === 0 ? (
                                                    <div className="p-3 text-center text-muted bg-light rounded border border-dashed">
                                                        No pricing fields added yet. This service will charge a flat rate of ₱{formService.rate || 0}.
                                                    </div>
                                                ) : (
                                                    (formService.fields || []).map((field, fIdx) => (
                                                        <div key={fIdx} className="card border mb-3 shadow-none bg-white">
                                                            <div className="card-header bg-light py-2 d-flex justify-content-between align-items-center">
                                                                <span className="fw-bold small text-dark">
                                                                    Factor #{fIdx + 1}: {field.label || 'Untitled'}
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-link text-danger p-0 text-decoration-none small"
                                                                    onClick={() => removeField(fIdx)}
                                                                >
                                                                    <i className="fas fa-trash me-1"></i>Remove
                                                                </button>
                                                            </div>
                                                            <div className="card-body p-3">
                                                                <div className="row g-2 mb-2">
                                                                    <div className="col-md-6">
                                                                        <label className="form-label small mb-1 fw-bold">Question / Label</label>
                                                                        <input
                                                                            type="text"
                                                                            className="form-control form-control-sm"
                                                                            placeholder="e.g. Number of Septic Tanks"
                                                                            value={field.label}
                                                                            onChange={(e) => updateField(fIdx, { label: e.target.value })}
                                                                            required
                                                                        />
                                                                    </div>
                                                                    <div className="col-md-6">
                                                                        <label className="form-label small mb-1 fw-bold">Factor Type</label>
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

                                                                <div className="form-check mb-2">
                                                                    <input
                                                                        className="form-check-input"
                                                                        type="checkbox"
                                                                        id={`tripsCheck_${fIdx}`}
                                                                        checked={Boolean(field.counts_toward_trips)}
                                                                        onChange={(e) => updateField(fIdx, { counts_toward_trips: e.target.checked })}
                                                                    />
                                                                    <label className="form-check-label small" htmlFor={`tripsCheck_${fIdx}`}>
                                                                        <strong>Counts toward trips</strong> (Multiplies truck trips for scheduling)
                                                                    </label>
                                                                </div>

                                                                {field.type === 'number' ? (
                                                                    <div className="row g-2">
                                                                        <div className="col-6">
                                                                            <label className="form-label small mb-1">Minimum Value</label>
                                                                            <input
                                                                                type="number"
                                                                                className="form-control form-control-sm"
                                                                                value={field.min ?? 1}
                                                                                onChange={(e) => updateField(fIdx, { min: parseInt(e.target.value) || 1 })}
                                                                            />
                                                                        </div>
                                                                        <div className="col-6">
                                                                            <label className="form-label small mb-1">Default Value</label>
                                                                            <input
                                                                                type="number"
                                                                                className="form-control form-control-sm"
                                                                                value={field.default ?? 1}
                                                                                onChange={(e) => updateField(fIdx, { default: parseInt(e.target.value) || 1 })}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="mt-3 p-2 bg-light rounded border">
                                                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                                                            <span className="small fw-bold">Dropdown Options</span>
                                                                            <button
                                                                                type="button"
                                                                                className="btn btn-xs btn-outline-primary"
                                                                                style={{ fontSize: '0.75rem', padding: '2px 8px' }}
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
                                                                                    style={{ flex: 3 }}
                                                                                    value={opt.label}
                                                                                    onChange={(e) => updateOption(fIdx, oIdx, { label: e.target.value })}
                                                                                    required
                                                                                />
                                                                                {field.type === 'multiplier' ? (
                                                                                    <div className="input-group input-group-sm" style={{ flex: 2 }}>
                                                                                        <span className="input-group-text">×</span>
                                                                                        <input
                                                                                            type="number"
                                                                                            step="0.1"
                                                                                            className="form-control"
                                                                                            placeholder="Factor"
                                                                                            value={opt.factor ?? 1}
                                                                                            onChange={(e) => updateOption(fIdx, oIdx, { factor: parseFloat(e.target.value) || 1 })}
                                                                                        />
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="input-group input-group-sm" style={{ flex: 2 }}>
                                                                                        <span className="input-group-text">+₱</span>
                                                                                        <input
                                                                                            type="number"
                                                                                            step="1"
                                                                                            className="form-control"
                                                                                            placeholder="Amount"
                                                                                            value={opt.amount ?? 0}
                                                                                            onChange={(e) => updateOption(fIdx, oIdx, { amount: parseFloat(e.target.value) || 0 })}
                                                                                        />
                                                                                    </div>
                                                                                )}

                                                                                {field.type === 'surcharge' && (
                                                                                    <div className="form-check mb-0 ms-1" title="Prompt client for a photo when this option is selected">
                                                                                        <input
                                                                                            className="form-check-input"
                                                                                            type="checkbox"
                                                                                            id={`optPhoto_${fIdx}_${oIdx}`}
                                                                                            checked={Boolean(opt.requires_photo)}
                                                                                            onChange={(e) => updateOption(fIdx, oIdx, { requires_photo: e.target.checked })}
                                                                                        />
                                                                                        <label className="form-check-label small" htmlFor={`optPhoto_${fIdx}_${oIdx}`}>
                                                                                            Photo
                                                                                        </label>
                                                                                    </div>
                                                                                )}

                                                                                <button
                                                                                    type="button"
                                                                                    className="btn btn-sm btn-outline-danger"
                                                                                    onClick={() => removeOption(fIdx, oIdx)}
                                                                                    disabled={(field.options || []).length <= 1}
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
                                            <div className="p-3 rounded bg-success bg-opacity-10 border border-success d-flex justify-content-between align-items-center">
                                                <div>
                                                    <span className="fw-bold text-success d-block">Starting Price Preview:</span>
                                                    <small className="text-muted">Calculated automatically using initial/default selections</small>
                                                </div>
                                                <div className="fs-4 fw-bold text-success">
                                                    ₱{currentStartingPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                                <div className="modal-footer bg-light">
                                    <button type="button" className="btn btn-secondary" onClick={closeFormModal} disabled={isSaving}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-success" disabled={isSaving}>
                                        {isSaving ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Service')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default ServiceManagement;