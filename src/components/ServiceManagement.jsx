import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axiosConfig';
import '../assets/styles/servicemanagement.css';
import '../assets/styles/orderdatabase.css';
import carousel7 from '../assets/styles/images/carousell7.png';
import AlertModal from './AlertModal';
import { useConfirm } from '../context/ConfirmContext';

function ServiceManagement() {
    const confirm = useConfirm();
    const [services, setServices] = useState([]);
    const [editingService, setEditingService] = useState(null);
    const [newService, setNewService] = useState({
        name: '',
        description: '',
        base_price: 0,
        status: 'available'
    });
    const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', type: 'info' });

    const showAlert = (title, message, type = 'info') => {
        setModalConfig({ isOpen: true, title, message, type });
    };

    const closeAlert = () => {
        setModalConfig(prev => ({ ...prev, isOpen: false }));
    };



    const [filterName, setFilterName] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    const fetchServices = useCallback(async () => {
        try {
            const response = await api.get('/services');
            setServices(response.data);
        } catch (error) {
            console.error('Error fetching services:', error);
            showAlert("Error", "Failed to load services", "error");
        }
    }, []);

    // Fetch services on component mount
    useEffect(() => {
        fetchServices();
    }, [fetchServices]);

    const handleAddService = async (e) => {
        e.preventDefault();
        try {
            const response = await api.post('/services', newService);
            if (response.data.success) {
                showAlert("Success", "Service added successfully", "success");
                setNewService({ name: '', description: '', base_price: 0, status: 'available' });
                fetchServices();
            } else {
                showAlert("Warning", response.data.message || "Failed to add service", "warning");
            }
        } catch (error) {
            console.error('Error adding service:', error);
            showAlert("Error", error.response?.data?.message || "Failed to add service", "error");
        }
    };

    const handleUpdateService = async (e) => {
        e.preventDefault();
        try {
            const response = await api.put('/services/' + editingService.id, editingService);
            if (response.data.success) {
                showAlert("Success", "Service updated successfully", "success");
                setEditingService(null);
                fetchServices();
            } else {
                showAlert("Warning", response.data.message || "Failed to update service", "warning");
            }
        } catch (error) {
            console.error('Error updating service:', error);
            showAlert("Error", error.response?.data?.message || "Failed to update service", "error");
        }
    };

    const promptDelete = async (id) => {
        const isConfirmed = await confirm({
            title: "Confirm Deletion",
            text: "Are you sure you want to delete this service?",
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
                showAlert("Error", error.response?.data?.message || "Failed to delete service", "error");
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
                        <h3 className="text-center mb-4">Service Management</h3>

                        {/* Add New Service Form */}
                        <div className="card mb-4">
                            <div className="card-header">
                                <h4>Add New Service</h4>
                            </div>
                            <div className="card-body">
                                <form onSubmit={handleAddService}>
                                    <div className="row">
                                        <div className="col-md-4">
                                            <div className="form-group">
                                                <label>Service Name *</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    value={newService.name}
                                                    onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div className="col-md-4">
                                            <div className="form-group">
                                                <label>Base Price (₱)</label>
                                                <input
                                                    type="number"
                                                    className="form-control"
                                                    value={newService.base_price}
                                                    onChange={(e) => setNewService({ ...newService, base_price: parseFloat(e.target.value) || 0 })}
                                                    step="0.01"
                                                />
                                            </div>
                                        </div>
                                        <div className="col-md-4">
                                            <div className="form-group">
                                                <label>Status</label>
                                                <select
                                                    className="form-control"
                                                    value={newService.status}
                                                    onChange={(e) => setNewService({ ...newService, status: e.target.value })}
                                                >
                                                    <option value="available">Available</option>
                                                    <option value="unavailable">Unavailable</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>Description</label>
                                        <textarea
                                            className="form-control"
                                            rows="2"
                                            value={newService.description}
                                            onChange={(e) => setNewService({ ...newService, description: e.target.value })}
                                        />
                                    </div>
                                    <button type="submit" className="btn btn-success">
                                        Add Service
                                    </button>
                                </form>
                            </div>
                        </div>

                        {/* Services List */}
                        <div className="card">
                            <div className="card-header">
                                <h4>Services List</h4>
                            </div>
                            <div className="card-body">
                                <div className="filters-container mb-3 d-flex gap-3 align-items-center">
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
                                    <button className="btn btn-secondary m-0 d-flex align-items-center justify-content-center" style={{ borderRadius: '10px', padding: '0 20px', height: '38px' }} onClick={() => { setFilterName(''); setFilterStatus(''); }}>
                                        Clear Filters
                                    </button>
                                </div>
                                <div className="table-responsive">
                                    <table className="table table-striped">
                                        <thead>
                                            <tr>
                                                <th>ID</th>
                                                <th>Name</th>
                                                <th>Description</th>
                                                <th>Base Price</th>
                                                <th>Status</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredServices.length === 0 ? (
                                                <tr>
                                                    <td colSpan="6" className="text-center">No services found.</td>
                                                </tr>
                                            ) : (
                                                filteredServices.map(service => (
                                                    <tr key={service.id}>
                                                        <td>{service.id}</td>
                                                        <td>
                                                            {editingService?.id === service.id ? (
                                                                <input
                                                                    type="text"
                                                                    className="form-control"
                                                                    value={editingService.name}
                                                                    onChange={(e) => setEditingService({ ...editingService, name: e.target.value })}
                                                                />
                                                            ) : (
                                                                service.name
                                                            )}
                                                        </td>
                                                        <td>
                                                            {editingService?.id === service.id ? (
                                                                <textarea
                                                                    className="form-control"
                                                                    value={editingService.description}
                                                                    onChange={(e) => setEditingService({ ...editingService, description: e.target.value })}
                                                                />
                                                            ) : (
                                                                service.description || '-'
                                                            )}
                                                        </td>
                                                        <td>
                                                            {editingService?.id === service.id ? (
                                                                <input
                                                                    type="number"
                                                                    className="form-control"
                                                                    value={editingService.base_price}
                                                                    onChange={(e) => setEditingService({ ...editingService, base_price: parseFloat(e.target.value) || 0 })}
                                                                    step="0.01"
                                                                />
                                                            ) : (
                                                                `₱${parseFloat(service.base_price).toFixed(2)}`
                                                            )}
                                                        </td>
                                                        <td>
                                                            <span className={`badge text-capitalize ${service.status === 'available' ? 'bg-success' : 'bg-danger'}`}>
                                                                {service.status}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            {editingService?.id === service.id ? (
                                                                <div className="d-flex gap-2 justify-content-center">
                                                                    <button
                                                                        className="btn btn-sm btn-success"
                                                                        onClick={handleUpdateService}
                                                                    >
                                                                        Save
                                                                    </button>
                                                                    <button
                                                                        className="btn btn-sm btn-secondary"
                                                                        onClick={() => setEditingService(null)}
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div className="d-flex gap-2 justify-content-center align-items-center">
                                                                    <button
                                                                        className="btn btn-sm btn-primary text-nowrap"
                                                                        onClick={() => setEditingService(service)}
                                                                    >
                                                                        Edit
                                                                    </button>

                                                                    <button
                                                                        className={`btn btn-sm text-nowrap ${service.status === 'available' ? 'btn-warning' : 'btn-success'}`}
                                                                        onClick={() => toggleServiceStatus(service)}
                                                                    >
                                                                        {service.status === 'available' ? 'Make Unavailable' : 'Make Available'}
                                                                    </button>

                                                                    <button
                                                                        className="btn btn-sm btn-danger text-nowrap"
                                                                        onClick={() => promptDelete(service.id)}
                                                                    >
                                                                        Delete
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </>
    );
}

export default ServiceManagement;