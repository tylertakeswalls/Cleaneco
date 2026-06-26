import React, { useState, useEffect } from 'react';
import api from '../api/axiosConfig';
import '../assets/styles/servicemanagement.css';

function ServiceManagement() {
    const [services, setServices] = useState([]);
    const [editingService, setEditingService] = useState(null);
    const [newService, setNewService] = useState({
        name: '',
        description: '',
        base_price: 0,
        status: 'available'
    });

    // Fetch services on component mount
    useEffect(() => {
        fetchServices();
    }, []);

    const fetchServices = async () => {
        try {
            const response = await api.get('/services.php');
            setServices(response.data);
        } catch (error) {
            console.error('Error fetching services:', error);
            alert('Failed to load services');
        }
    };

    const handleAddService = async (e) => {
        e.preventDefault();
        try {
            await api.post('/submit.php', {
                type: 'service',
                ...newService
            });
            alert('Service added successfully');
            setNewService({ name: '', description: '', base_price: 0, status: 'available' });
            fetchServices();
        } catch (error) {
            console.error('Error adding service:', error);
            alert('Failed to add service');
        }
    };

    const handleUpdateService = async (e) => {
        e.preventDefault();
        try {
            await api.put('/update.php', {
                type: 'service',
                id: editingService.id,
                ...editingService
            });
            alert('Service updated successfully');
            setEditingService(null);
            fetchServices();
        } catch (error) {
            console.error('Error updating service:', error);
            alert('Failed to update service');
        }
    };

    const handleDeleteService = async (id) => {
        if (!window.confirm('Are you sure you want to delete this service?')) return;
        
        try {
            await api.delete('/delete.php', { 
                data: { 
                    type: 'service',
                    id 
                }
            });
            alert('Service deleted successfully');
            fetchServices();
        } catch (error) {
            console.error('Error deleting service:', error);
            alert(error.response?.data?.message || 'Failed to delete service');
        }
    };

    const toggleServiceStatus = async (service) => {
        const newStatus = service.status === 'available' ? 'unavailable' : 'available';
        try {
            await api.put('/update.php', {
                type: 'service',
                id: service.id,
                status: newStatus
            });
            alert(`Service marked as ${newStatus}`);
            fetchServices();
        } catch (error) {
            console.error('Error updating service status:', error);
            alert('Failed to update service status');
        }
    };

    return (
        <div className="service-management">
            <h2>Service Management</h2>
            
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
                                        onChange={(e) => setNewService({...newService, name: e.target.value})}
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
                                        onChange={(e) => setNewService({...newService, base_price: parseFloat(e.target.value) || 0})}
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
                                        onChange={(e) => setNewService({...newService, status: e.target.value})}
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
                                onChange={(e) => setNewService({...newService, description: e.target.value})}
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
                                {services.map(service => (
                                    <tr key={service.id}>
                                        <td>{service.id}</td>
                                        <td>
                                            {editingService?.id === service.id ? (
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    value={editingService.name}
                                                    onChange={(e) => setEditingService({...editingService, name: e.target.value})}
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
                                                    onChange={(e) => setEditingService({...editingService, description: e.target.value})}
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
                                                    onChange={(e) => setEditingService({...editingService, base_price: parseFloat(e.target.value) || 0})}
                                                    step="0.01"
                                                />
                                            ) : (
                                                `₱${parseFloat(service.base_price).toFixed(2)}`
                                            )}
                                        </td>
                                        <td>
                                            <span className={`badge ${service.status === 'available' ? 'bg-success' : 'bg-danger'}`}>
                                                {service.status}
                                            </span>
                                        </td>
                                        <td>
                                            {editingService?.id === service.id ? (
                                                <>
                                                    <button 
                                                        className="btn btn-sm btn-success me-2"
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
                                                </>
                                            ) : (
                                                <div className="action-buttons">
                                                    <button 
                                                        className="btn btn-sm btn-primary"
                                                        onClick={() => setEditingService(service)}
                                                    >
                                                        Edit
                                                    </button>

                                                    <button 
                                                        className={`btn btn-sm ${service.status === 'available' ? 'btn-warning' : 'btn-success'}`}
                                                        onClick={() => toggleServiceStatus(service)}
                                                    >
                                                        {service.status === 'available' ? 'Make Unavailable' : 'Make Available'}
                                                    </button>

                                                    <button 
                                                        className="btn btn-sm btn-danger"
                                                        onClick={() => handleDeleteService(service.id)}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ServiceManagement;