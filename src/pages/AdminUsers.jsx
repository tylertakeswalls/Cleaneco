import { useEffect, useState } from 'react';
import api from '../api/api';
import '../assets/styles/orderdatabase.css'; 
import carousel4 from '../assets/styles/images/carousel4.png';
import AlertModal from '../components/AlertModal';
import { useConfirm } from '../context/ConfirmContext';
import { useRef } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import reportHeaderImg from '../assets/styles/images/report_header.png';
import { formatName } from '../utils/formatName';

function AdminUsers() {
  const confirm = useConfirm();
  const container = useRef();
  const [users, setUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({});
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', type: 'info' });



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
    setFormData({ ...formData, [e.target.name]: e.target.value });
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

    users.forEach(user => {
      const userData = [
        user.username || '-',
        formatName(user),
        user.email || '-',
        user.phone || '-',
        user.role || '-'
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

    doc.save(`Registered_Users_Report_${new Date().toISOString().split('T')[0]}.pdf`);
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
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h3 className="m-0">Registered Users</h3>
            <button className="btn btn-primary d-flex align-items-center justify-content-center" style={{ borderRadius: '10px', padding: '0 20px', height: '40px', background: '#0D8D1E', border: 'none' }} onClick={handleDownloadUsersReport}>
              <i className="fas fa-file-pdf me-2"></i> Download Report
            </button>
          </div>

          <div className="table-container">
            <table className="table table-bordered text-center mb-0">
              <thead className="thead-light">
                <tr>
                  <th>Username</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan="6">No users found.</td>
                  </tr>
                ) : (
                  users.map(user => (
                    <tr key={user.id} className={user.inactive ? 'table-warning' : ''}>
                      <td>{user.username} {user.inactive && <span className="badge bg-warning text-dark ms-1">Inactive</span>}</td>

                      <td>
                        {editingUser === user.id ? (
                          <>
                            <input
                              className="form-control mb-1"
                              name="first_name"
                              value={formData.first_name}
                              onChange={handleChange}
                            />
                            <input
                              className="form-control"
                              name="last_name"
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
                            value={formData.phone}
                            onChange={handleChange}
                          />
                        ) : user.phone}
                      </td>

                      <td>{user.role}</td>

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
                              disabled={user.role === 'admin'}
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
    </>
  );
}

export default AdminUsers;
