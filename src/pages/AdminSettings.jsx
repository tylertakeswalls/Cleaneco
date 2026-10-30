import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';
import { useRef } from 'react';

function AdminSettings() {
  const container = useRef();
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ show: false, type: '', message: '' });

  const [truckTeams, setTruckTeams] = useState([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [loadingTeams, setLoadingTeams] = useState(true);

  const [unavailableDates, setUnavailableDates] = useState([]);
  const [newUnavailDate, setNewUnavailDate] = useState({ date: '', reason: '' });
  const [loadingDates, setLoadingDates] = useState(true);

  useEffect(() => {
    fetchTruckTeams();
    fetchUnavailableDates();
  }, []);

  const fetchUnavailableDates = async () => {
    try {
      const res = await api.get('/unavailable-dates');
      if (res.data) {
        setUnavailableDates(res.data);
      }
    } catch (err) {
      console.error('Error fetching unavailable dates:', err);
    } finally {
      setLoadingDates(false);
    }
  };

  const fetchTruckTeams = async () => {
    try {
      const res = await api.get('/settings/truck-teams');
      if (res.data.success) {
        setTruckTeams(res.data.truck_teams || []);
      }
    } catch (err) {
      console.error('Error fetching truck teams:', err);
    } finally {
      setLoadingTeams(false);
    }
  };

  const saveTruckTeams = async (teams) => {
    try {
      const res = await api.put('/settings/truck-teams', { truck_teams: teams });
      if (res.data.success) {
        showAlert(res.data.warning ? 'warning' : 'success', res.data.warning || 'Truck teams updated successfully!');
      } else {
        showAlert('error', 'Failed to update truck teams.');
      }
    } catch (err) {
      console.error(err);
      showAlert('error', 'Error updating truck teams.');
    }
  };

  const addTruckTeam = () => {
    if (!newTeamName.trim()) return;
    const newTeam = {
      id: `truck-${Date.now()}`,
      name: newTeamName.trim(),
      status: 'available'
    };
    const updated = [...truckTeams, newTeam];
    setTruckTeams(updated);
    setNewTeamName('');
    saveTruckTeams(updated);
  };

  const toggleTruckStatus = (index) => {
    const updated = truckTeams.map((team, idx) => {
      if (idx !== index) return team;
      const currentStatus = typeof team === 'string' ? 'available' : team.status;
      const nextStatus = currentStatus === 'available' ? 'unavailable' : 'available';
      return typeof team === 'string'
        ? { id: `truck-${Date.now()}`, name: team, status: nextStatus }
        : { ...team, status: nextStatus };
    });
    setTruckTeams(updated);
    saveTruckTeams(updated);
  };

  const removeTruckTeam = (indexToRemove) => {
    const updated = truckTeams.filter((_, index) => index !== indexToRemove);
    setTruckTeams(updated);
    saveTruckTeams(updated);
  };

  const addUnavailableDate = async () => {
    if (!newUnavailDate.date) {
      showAlert('error', 'Date is required.');
      return;
    }
    try {
      const res = await api.post('/unavailable-dates', newUnavailDate);
      if (res.data.success) {
        showAlert('success', 'Date marked as unavailable.');
        setUnavailableDates([...unavailableDates, res.data.data].sort((a, b) => new Date(a.date) - new Date(b.date)));
        setNewUnavailDate({ date: '', reason: '' });
      }
    } catch (err) {
      console.error(err);
      showAlert('error', err.response?.data?.message || 'Error adding unavailable date.');
    }
  };

  const removeUnavailableDate = async (id) => {
    try {
      const res = await api.delete(`/unavailable-dates/${id}`);
      if (res.data.success) {
        showAlert('success', 'Date unblocked successfully.');
        setUnavailableDates(unavailableDates.filter(d => d._id !== id));
      }
    } catch (err) {
      console.error(err);
      showAlert('error', 'Error removing unavailable date.');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
    } else {
      showAlert('error', 'Please select a valid PDF file.');
      setSelectedFile(null);
    }
  };

  // Removed fetchTerms since we don't display the text anymore.
  // The user can view the existing PDF by clicking a link.
  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      showAlert('error', 'Please select a PDF file first.');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('tosPdf', selectedFile);

      const response = await api.post('/settings/tos/upload', formData);
      
      if (response.data.success) {
        showAlert('success', 'Terms and Conditions PDF updated successfully!');
        setSelectedFile(null);
        document.getElementById('tosPdfInput').value = '';
      } else {
        showAlert('error', response.data.message || 'Failed to update Terms and Conditions.');
      }
    } catch (error) {
      console.error('Error updating TOS:', error);
      showAlert('error', 'An error occurred while saving.');
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (type, message) => {
    setAlert({ show: true, type, message });
    setTimeout(() => setAlert({ show: false, type: '', message: '' }), 5000);
  };

  return (
    <div ref={container} className="container-fluid bg-light min-vh-100 py-5">
      <div className="container">
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h2 className="fw-bold text-dark mb-1" style={{ letterSpacing: '-1px' }}>Site Settings</h2>
            <p className="text-secondary mb-0">Manage global website configuration and policies.</p>
          </div>
          <Link to="/admin" className="btn btn-secondary shadow-sm rounded-3 px-4 fw-bold">
            <i className="fas fa-arrow-left me-2"></i> Back to Dashboard
          </Link>
        </div>

        {alert.show && (
          <div className={`alert alert-${alert.type === 'success' ? 'success' : alert.type === 'warning' ? 'warning' : 'danger'} alert-dismissible fade show shadow-sm`} role="alert">
            <i className={`fas fa-${alert.type === 'success' ? 'check-circle' : 'exclamation-circle'} me-2`}></i>
            {alert.message}
            <button type="button" className="btn-close" onClick={() => setAlert({ show: false, type: '', message: '' })}></button>
          </div>
        )}

        <div className="card glass-panel shadow-sm border-0 glass-panel" style={{ borderRadius: '1.25rem' }}>
          <div className="card-body p-5">
            <h4 className="fw-bold mb-4 text-dark" style={{ letterSpacing: '-0.5px' }}>
              <i className="fas fa-file-contract me-2" style={{ color: '#0D8D1E' }}></i> Terms and Conditions
            </h4>
            <p className="text-muted mb-4">Upload a PDF document containing the terms and conditions that users must agree to before registering. This will replace the existing terms instantly.</p>

            <form onSubmit={handleSave}>
              <div className="form-group mb-4">
                <label className="form-label fw-bold">Terms and Conditions PDF</label>
                <input
                  id="tosPdfInput"
                  type="file"
                  className="form-control form-control-lg"
                  accept="application/pdf"
                  onChange={handleFileChange}
                />
                <div className="form-text mt-2">
                  <a href={`${api.defaults.baseURL}/settings/tos/pdf`} target="_blank" rel="noreferrer" className="text-decoration-none">
                    <i className="fas fa-external-link-alt me-1"></i> View Current Terms and Conditions PDF
                  </a>
                </div>
              </div>
              <div className="d-flex justify-content-end mt-4">
                <button 
                  type="submit" 
                  className="btn btn-success shadow-sm fw-bold px-5 py-2" 
                  style={{ borderRadius: '0.5rem', background: '#0D8D1E' }}
                  disabled={loading || !selectedFile}
                >
                  {loading ? (
                    <><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Uploading...</>
                  ) : (
                    <><i className="fas fa-upload me-2"></i> Upload PDF</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="card glass-panel shadow-sm border-0 glass-panel mt-4" style={{ borderRadius: '1.25rem' }}>
          <div className="card-body p-5">
            <h4 className="fw-bold mb-4 text-dark" style={{ letterSpacing: '-0.5px' }}>
              <i className="fas fa-truck me-2" style={{ color: '#0D8D1E' }}></i> Truck Teams
            </h4>
            <p className="text-muted mb-4">Manage the list of available truck teams for deployment.</p>

            {loadingTeams ? (
              <p>Loading truck teams...</p>
            ) : (
              <div>
                <ul className="list-group mb-4">
                  {truckTeams.map((team, index) => {
                    const teamName = typeof team === 'string' ? team : team.name;
                    const isAvailable = typeof team === 'string' ? true : team.status !== 'unavailable';
                    return (
                      <li key={(typeof team === 'object' && team.id) || index} className="list-group-item d-flex justify-content-between align-items-center p-3">
                        <div className="d-flex align-items-center gap-3">
                          <i className="fas fa-truck fs-5" style={{ color: isAvailable ? '#0D8D1E' : '#dc3545' }}></i>
                          <div>
                            <span className="fw-bold d-block text-dark">{teamName}</span>
                            <span className={`badge ${isAvailable ? 'bg-success' : 'bg-danger'}`} style={{ fontSize: '0.75rem' }}>
                              {isAvailable ? 'Available' : 'Unavailable (Maintenance)'}
                            </span>
                          </div>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                          <button 
                            type="button"
                            className={`btn btn-sm fw-bold ${isAvailable ? 'btn-outline-danger' : 'btn-outline-success'}`}
                            onClick={() => toggleTruckStatus(index)}
                            title={isAvailable ? "Mark Unavailable" : "Mark Available"}
                          >
                            {isAvailable ? (
                              <><i className="fas fa-toggle-on me-1"></i> Set Unavailable</>
                            ) : (
                              <><i className="fas fa-toggle-off me-1"></i> Set Available</>
                            )}
                          </button>
                          <button 
                            type="button"
                            className="btn btn-sm btn-outline-secondary" 
                            onClick={() => removeTruckTeam(index)}
                            title="Remove Team"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      </li>
                    );
                  })}
                  {truckTeams.length === 0 && (
                    <li className="list-group-item text-muted">No truck teams configured.</li>
                  )}
                </ul>

                <div className="d-flex align-items-stretch gap-2">
                  <input 
                    type="text" 
                    className="form-control m-0" 
                    placeholder="New Truck Team Name" 
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addTruckTeam()}
                  />
                  <button className="btn btn-success fw-bold m-0 d-flex align-items-center justify-content-center text-nowrap" type="button" onClick={addTruckTeam} style={{ background: '#0D8D1E', borderRadius: '0.5rem', minWidth: '130px', padding: '0 20px', border: 'none' }}>
                    <i className="fas fa-plus me-2" style={{ fontSize: '0.9rem' }}></i> Add Team
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card glass-panel shadow-sm border-0 glass-panel mt-4" style={{ borderRadius: '1.25rem' }}>
          <div className="card-body p-5">
            <h4 className="fw-bold mb-4 text-dark" style={{ letterSpacing: '-0.5px' }}>
              <i className="fas fa-calendar-times me-2" style={{ color: '#0D8D1E' }}></i> Unavailable Dates
            </h4>
            <p className="text-muted mb-4">Block specific dates (e.g. holidays, teambuilding) to prevent clients from booking services on those days.</p>

            {loadingDates ? (
              <p>Loading unavailable dates...</p>
            ) : (
              <div>
                <ul className="list-group mb-4">
                  {unavailableDates.map((item) => (
                    <li key={item._id} className="list-group-item d-flex justify-content-between align-items-center">
                      <div>
                        <span className="fw-bold">{new Date(item.date).toLocaleDateString()}</span>
                        {item.reason && <span className="text-muted ms-2">- {item.reason}</span>}
                      </div>
                      <button 
                        className="btn btn-sm btn-outline-danger" 
                        onClick={() => removeUnavailableDate(item._id)}
                      >
                        <i className="fas fa-unlock me-1"></i> Unblock
                      </button>
                    </li>
                  ))}
                  {unavailableDates.length === 0 && (
                    <li className="list-group-item text-muted">No dates are currently blocked.</li>
                  )}
                </ul>

                <div className="d-flex flex-column flex-md-row align-items-stretch gap-2">
                  <input 
                    type="date" 
                    className="form-control m-0" 
                    style={{ flex: '0 0 auto', width: 'auto', minWidth: '180px' }}
                    value={newUnavailDate.date}
                    onChange={(e) => setNewUnavailDate({ ...newUnavailDate, date: e.target.value })}
                  />
                  <input 
                    type="text" 
                    className="form-control m-0" 
                    style={{ flex: '1 1 auto' }}
                    placeholder="Reason (Optional, e.g. Teambuilding)" 
                    value={newUnavailDate.reason}
                    onChange={(e) => setNewUnavailDate({ ...newUnavailDate, reason: e.target.value })}
                    onKeyPress={(e) => e.key === 'Enter' && addUnavailableDate()}
                  />
                  <button className="btn btn-warning fw-bold m-0 d-flex align-items-center justify-content-center text-nowrap" type="button" onClick={addUnavailableDate} style={{ borderRadius: '0.5rem', border: 'none', minWidth: '130px', padding: '0 20px' }}>
                    <i className="fas fa-ban me-2" style={{ fontSize: '0.9rem' }}></i> Block
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminSettings;
