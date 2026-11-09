import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import api from '../api/api';
import '../assets/styles/servicemanagement.css';
import '../assets/styles/orderdatabase.css'; 
import carousel4 from '../assets/styles/images/carousel4.webp';
import AlertModal from '../components/AlertModal';
import { useConfirm } from '../context/ConfirmContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import reportHeaderImg from '../assets/styles/images/report_header.png';
import { formatName } from '../utils/formatName';
import { previewPdfBlob, formatPhoneNumber } from '../utils/helpers';

const emptySubAdminForm = {
  username: '',
  password: '',
  first_name: '',
  middle_name: '',
  last_name: '',
  email: '',
  phone: ''
};

function AdminUsers() {
  const confirm = useConfirm();
  const container = useRef();
  const [users, setUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({});
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubAdminModalOpen, setIsSubAdminModalOpen] = useState(false);
  const [subAdminForm, setSubAdminForm] = useState(emptySubAdminForm);
  const [isCreatingSubAdmin, setIsCreatingSubAdmin] = useState(false);



  const showAlert = (title, message, type = 'info') => {
      setModalConfig({ isOpen: true, title, message, type });
  };

  const closeAlert = () => {
      setModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const res = await api.get('/users?t=' + new Date().getTime());
      setUsers(res.data);
    } catch (err) {
      console.error("Failed to load users", err);
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user.id);
    setFormData(user);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let max = 100;
    if (name === 'first_name' || name === 'last_name') max = 50;
    if (name === 'phone') max = 25;
    setFormData({ ...formData, [name]: value.slice(0, max) });
  };

  const handleUpdate = async () => {
    try {
      await api.put('/users/' + editingUser, {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: formData.phone
      });

      setEditingUser(null);
      loadUsers();
      showAlert("Success", "User updated successfully", "success");
    } catch (err) {
      showAlert("Error", err.response?.data?.message || "Failed to update user", "error");
    }
  };

  const handleDelete = async (id) => {
    const isConfirmed = await confirm({
      title: "Confirm Deletion",
      text: "⚠️ Are you sure you want to delete this user?",
      confirmLabel: "Delete",
      confirmVariant: "danger"
    });
    
    if (isConfirmed) {
        try {
          const res = await api.delete('/users/' + id);

          if (res.data.success) {
            showAlert("Success", "User deleted successfully", "success");
            loadUsers();
          } else {
            showAlert("Warning", res.data.message, "warning");
          }
        } catch (err) {
          showAlert("Error", err.response?.data?.message || "Cannot delete user with existing orders", "error");
        }
    }
  };

  const handleReactivate = async (id) => {
    try {
      await api.put('/users/' + id, { inactive: false, last_login: Date.now() });
      showAlert("Success", "User account reactivated successfully.", "success");
      loadUsers();
    } catch (err) {
      showAlert("Error", "Failed to reactivate user.", "error");
    }
  };

  const openSubAdminModal = () => {
    setSubAdminForm(emptySubAdminForm);
    setIsSubAdminModalOpen(true);
  };

  const closeSubAdminModal = () => {
    setIsSubAdminModalOpen(false);
    setSubAdminForm(emptySubAdminForm);
  };

  const handleSubAdminFormChange = (e) => {
    const { name, value } = e.target;
    let finalVal = name === 'phone' ? formatPhoneNumber(value) : value;
    const maxMap = {
      username: 30,
      password: 64,
      first_name: 50,
      middle_name: 50,
      last_name: 50,
      email: 100,
      phone: 25
    };
    if (maxMap[name]) {
      finalVal = String(finalVal).slice(0, maxMap[name]);
    }
    setSubAdminForm(prev => ({ ...prev, [name]: finalVal }));
  };

  const handleCreateSubAdmin = async (e) => {
    e.preventDefault();
    setIsCreatingSubAdmin(true);
    try {
      const res = await api.post('/users/sub-admin', subAdminForm);
      if (res.data.success) {
        closeSubAdminModal();
        loadUsers();
        showAlert("Success", "Sub-Admin account created and ready for login!", "success");
      } else {
        showAlert("Warning", res.data.message || "Failed to create Sub-Admin", "warning");
      }
    } catch (err) {
      showAlert("Error", err.response?.data?.message || "Failed to create Sub-Admin account", "error");
    } finally {
      setIsCreatingSubAdmin(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase();
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = query === '' || 
      (user.username && user.username.toLowerCase().includes(query)) ||
      fullName.includes(query) ||
      (user.email && user.email.toLowerCase().includes(query)) ||
      (user.phone && user.phone.includes(query));

    const matchesRole = filterRole === '' || user.role === filterRole;
    const matchesStatus = filterStatus === '' || 
      (filterStatus === 'active' && !user.inactive) ||
      (filterStatus === 'inactive' && user.inactive);

    return matchesSearch && matchesRole && matchesStatus;
  });

  const totalUsersCount = users.length;
  const clientAccountsCount = users.filter(u => u.role === 'client').length;
  const adminAccountsCount = users.filter(u => u.role === 'admin').length;
  const inactiveAccountsCount = users.filter(u => u.inactive).length;

  const handleDownloadUsersReport = async () => {
    const doc = new jsPDF('portrait', 'mm', 'a4');

    const img = new Image();
    img.src = reportHeaderImg;
    await new Promise((resolve) => {
      img.onload = resolve;
    });
    
    doc.addImage(img, 'PNG', 0, 0, 210, 65);

    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.text("Registered Users Report", 14, 75);
    doc.setFont("times", "normal");
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 82);

    const tableColumn = ["Username", "Name", "Email", "Phone", "Role"];
    const tableRows = [];

    filteredUsers.forEach(user => {
      const roleLabel = user.role === 'admin'
        ? (user.admin_scope === 'sub_admin' ? 'Admin (Sub-Admin)' : 'Admin')
        : (user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '-');
      const userData = [
        user.username || '-',
        formatName(user),
        user.email || '-',
        user.phone || '-',
        roleLabel
      ];
      tableRows.push(userData);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 90,
      styles: { fontSize: 9 },
      headStyles: { fillColor: '#0D8D1E' }
    });

    previewPdfBlob(doc.output('blob'), `Registered_Users_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <>
    <AlertModal 
        isOpen={modalConfig.isOpen} 
        title={modalConfig.title} 
        message={modalConfig.message} 
        type={modalConfig.type} 
        onClose={closeAlert} 
    />
    <div ref={container}>
      <img className="img-fluid banner-img" src={carousel4} alt="Banner" />

      <section className="section-bg">
        <div className="table-box">
          <div className="text-center mb-4">
            <h3 className="fw-bold text-dark mb-1">Registered Users</h3>
            <p className="text-muted small mb-0">Overview of client accounts, administrative credentials, and user access records</p>
          </div>

          {/* Executive KPI Metric Cards */}
          <div className="row g-3 mb-4">
            <div className="col-12 col-sm-6 col-xl-3">
              <div className="db-kpi-card">
                <div className="d-flex align-items-center justify-content-between">
                  <span className="db-kpi-label">Total Users</span>
                  <div className="db-kpi-icon" style={{ backgroundColor: 'rgba(37, 99, 235, 0.12)', color: '#2563eb' }}>
                    <i className="fas fa-users"></i>
                  </div>
                </div>
                <div className="db-kpi-value text-dark">
                  {totalUsersCount}
                </div>
                <p className="db-kpi-subtext">
                  All System Accounts
                </p>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-xl-3">
              <div className="db-kpi-card">
                <div className="d-flex align-items-center justify-content-between">
                  <span className="db-kpi-label">Client Accounts</span>
                  <div className="db-kpi-icon" style={{ backgroundColor: 'rgba(13, 141, 30, 0.12)', color: '#0D8D1E' }}>
                    <i className="fas fa-user"></i>
                  </div>
                </div>
                <div className="db-kpi-value text-success">
                  {clientAccountsCount}
                </div>
                <p className="db-kpi-subtext">
                  Registered Customers
                </p>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-xl-3">
              <div className="db-kpi-card">
                <div className="d-flex align-items-center justify-content-between">
                  <span className="db-kpi-label">System Admins</span>
                  <div className="db-kpi-icon" style={{ backgroundColor: 'rgba(147, 51, 234, 0.12)', color: '#9333ea' }}>
                    <i className="fas fa-user-shield"></i>
                  </div>
                </div>
                <div className="db-kpi-value text-dark">
                  {adminAccountsCount}
                </div>
                <p className="db-kpi-subtext">
                  Administrative Access
                </p>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-xl-3">
              <div className="db-kpi-card">
                <div className="d-flex align-items-center justify-content-between">
                  <span className="db-kpi-label">Inactive Accounts</span>
                  <div className="db-kpi-icon" style={{ backgroundColor: 'rgba(217, 119, 6, 0.12)', color: '#d97706' }}>
                    <i className="fas fa-user-clock"></i>
                  </div>
                </div>
                <div className="db-kpi-value text-dark">
                  {inactiveAccountsCount}
                </div>
                <p className="db-kpi-subtext">
                  Requires Reactivation
                </p>
              </div>
            </div>
          </div>

          <div className="filters-container mb-3 d-flex gap-3 align-items-center flex-wrap">
            <input
              type="text"
              className="form-control m-0"
              style={{ width: '250px', height: '52px' }}
              maxLength={100}
              placeholder="Search user, name, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value.slice(0, 100))}
            />
            <select
              className="form-select m-0"
              style={{ width: '180px', height: '52px' }}
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
            >
              <option value="">All Roles</option>
              <option value="client">Client</option>
              <option value="admin">Admin</option>
            </select>
            <select
              className="form-select m-0"
              style={{ width: '180px', height: '52px' }}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <button
              className="btn btn-secondary m-0 d-flex align-items-center justify-content-center"
              style={{ borderRadius: '10px', padding: '0 20px', height: '52px' }}
              onClick={() => { setSearchQuery(''); setFilterRole(''); setFilterStatus(''); }}
            >
              Clear Filters
            </button>
            <div className="d-flex align-items-center gap-2 ms-auto flex-wrap">
              <button
                type="button"
                className="btn btn-primary m-0 d-flex align-items-center justify-content-center"
                style={{ borderRadius: '10px', padding: '0 20px', height: '52px', background: '#0D8D1E', border: 'none' }}
                onClick={openSubAdminModal}
              >
                <i className="fas fa-user-plus me-2"></i> Add Sub-Admin
              </button>
              <button 
                type="button"
                className="btn btn-primary m-0 d-flex align-items-center justify-content-center" 
                style={{ borderRadius: '10px', padding: '0 20px', height: '52px', background: '#0D8D1E', border: 'none' }} 
                onClick={handleDownloadUsersReport}
              >
                <i className="fas fa-file-pdf me-2"></i> Download Report
              </button>
            </div>
          </div>

          <div className="table-container">
            <table className="table table-bordered text-center align-middle mb-0">
              <thead className="thead-light">
                <tr>
                  <th style={{ whiteSpace: 'nowrap' }}>Username</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Name</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Email</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Phone</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Role</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-4 text-muted">No users found.</td>
                  </tr>
                ) : (
                  filteredUsers.map(user => (
                    <tr key={user.id} className={user.inactive ? 'table-warning' : ''}>
                      <td>{user.username} {user.inactive && <span className="badge bg-warning text-dark ms-1">Inactive</span>}</td>

                      <td>
                        {editingUser === user.id ? (
                          <>
                            <input
                              className="form-control mb-1"
                              name="first_name"
                              maxLength={50}
                              value={formData.first_name}
                              onChange={handleChange}
                            />
                            <input
                              className="form-control"
                              name="last_name"
                              maxLength={50}
                              value={formData.last_name}
                              onChange={handleChange}
                            />
                          </>
                        ) : (
                          formatName(user)
                        )}
                      </td>

                      <td>
                        {editingUser === user.id ? (
                          <input
                            className="form-control"
                            name="email"
                            maxLength={100}
                            value={formData.email}
                            onChange={handleChange}
                          />
                        ) : user.email}
                      </td>

                      <td>
                        {editingUser === user.id ? (
                          <input
                            className="form-control"
                            name="phone"
                            maxLength={25}
                            value={formData.phone}
                            onChange={handleChange}
                          />
                        ) : user.phone}
                      </td>

                      <td>
                        <span
                          className={`badge rounded-pill px-3 py-1 ${
                            user.role === 'admin'
                              ? (user.admin_scope === 'sub_admin' ? 'bg-primary text-white' : 'bg-dark text-white')
                              : 'bg-success text-white'
                          }`}
                          style={{ fontSize: '0.75rem', textTransform: 'capitalize' }}
                        >
                          {user.role === 'admin' && user.admin_scope === 'sub_admin' ? 'Admin (Sub-Admin)' : user.role}
                        </span>
                      </td>

                      <td>
                        {editingUser === user.id ? (
                          <>
                            <button className="btn-edit" onClick={handleUpdate}>
                              Save
                            </button>
                            <button
                              className="btn-delete"
                              onClick={() => setEditingUser(null)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            {user.inactive ? (
                              <button
                                className="btn-reactivate"
                                onClick={() => handleReactivate(user.id)}
                              >
                                Reactivate
                              </button>
                            ) : null}
                            <button
                              className="btn-edit"
                              onClick={() => handleEdit(user)}
                            >
                              Edit
                            </button>
                            <button
                              className="btn-delete"
                              onClick={() => handleDelete(user.id)}
                              disabled={user.role === 'admin' && user.admin_scope !== 'sub_admin'}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>

    {isSubAdminModalOpen && createPortal(
      <div
        className="service-modal-overlay"
        tabIndex="-1"
        onClick={closeSubAdminModal}
      >
        <div
          className="service-modal-dialog"
          style={{ maxWidth: '620px' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="service-modal-content shadow-lg">
            <div className="service-modal-header">
              <h5 className="modal-title">
                <i className="fas fa-user-shield me-2"></i>
                <span>Create Sub-Admin Account (Operations / Inspector)</span>
              </h5>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={closeSubAdminModal}
                aria-label="Close"
              ></button>
            </div>

            <form className="service-modal-form" onSubmit={handleCreateSubAdmin}>
              <div className="service-modal-body">
                <div className="alert alert-light border small text-secondary mb-3" style={{ backgroundColor: '#f8fafc' }}>
                  <i className="fas fa-info-circle text-success me-2"></i>
                  Sub-Admin accounts are assigned the <strong>Admin</strong> role with scoped access to <strong>All Orders</strong>, the <strong>Operations Calendar</strong>, and <strong>Services</strong> (read-only) only.
                </div>

                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <label className="form-label fw-bold small text-dark mb-1">Username <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      name="username"
                      className="form-control"
                      maxLength={30}
                      placeholder="e.g. inspector_juan"
                      value={subAdminForm.username}
                      onChange={handleSubAdminFormChange}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-bold small text-dark mb-1">Temporary Password <span className="text-danger">*</span></label>
                    <input
                      type="password"
                      name="password"
                      className="form-control"
                      minLength={6}
                      maxLength={64}
                      placeholder="Min. 6 characters"
                      value={subAdminForm.password}
                      onChange={handleSubAdminFormChange}
                      required
                    />
                  </div>
                </div>

                <div className="row g-3 mb-3">
                  <div className="col-md-4">
                    <label className="form-label fw-bold small text-dark mb-1">First Name <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      name="first_name"
                      className="form-control"
                      maxLength={50}
                      placeholder="First name"
                      value={subAdminForm.first_name}
                      onChange={handleSubAdminFormChange}
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-bold small text-dark mb-1">Middle Name</label>
                    <input
                      type="text"
                      name="middle_name"
                      className="form-control"
                      maxLength={50}
                      placeholder="Optional"
                      value={subAdminForm.middle_name}
                      onChange={handleSubAdminFormChange}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-bold small text-dark mb-1">Last Name <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      name="last_name"
                      className="form-control"
                      maxLength={50}
                      placeholder="Last name"
                      value={subAdminForm.last_name}
                      onChange={handleSubAdminFormChange}
                      required
                    />
                  </div>
                </div>

                <div className="row g-3 mb-2">
                  <div className="col-md-7">
                    <label className="form-label fw-bold small text-dark mb-1">Email Address <span className="text-danger">*</span></label>
                    <input
                      type="email"
                      name="email"
                      className="form-control"
                      maxLength={100}
                      placeholder="inspector@cleaneco.com"
                      value={subAdminForm.email}
                      onChange={handleSubAdminFormChange}
                      required
                    />
                  </div>
                  <div className="col-md-5">
                    <label className="form-label fw-bold small text-dark mb-1">Phone Number</label>
                    <input
                      type="text"
                      name="phone"
                      className="form-control"
                      maxLength={25}
                      placeholder="09XX XXX XXXX"
                      value={subAdminForm.phone}
                      onChange={handleSubAdminFormChange}
                    />
                  </div>
                </div>
              </div>

              <div className="service-modal-footer">
                <button
                  type="button"
                  className="btn btn-light rounded-pill px-4 fw-bold shadow-sm border"
                  onClick={closeSubAdminModal}
                  disabled={isCreatingSubAdmin}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-success rounded-pill px-4 fw-bold shadow-sm"
                  style={{ backgroundColor: '#0D8D1E', borderColor: '#0D8D1E' }}
                  disabled={isCreatingSubAdmin}
                >
                  {isCreatingSubAdmin ? 'Creating...' : 'Create Sub-Admin'}
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

export default AdminUsers;
