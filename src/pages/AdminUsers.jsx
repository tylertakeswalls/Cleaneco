import { useEffect, useState } from 'react';
import api from '../api/api';
import '../assets/styles/orderdatabase.css'; 
import carousel4 from '../assets/styles/images/carousel4.png';
import AlertModal from '../components/AlertModal';
import { useConfirm } from '../context/ConfirmContext';
import { useRef } from 'react';

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

  const handleApproveDeletion = async (id) => {
    const isConfirmed = await confirm({
      title: "Approve Deletion",
      text: "Approve account deletion? This will permanently delete the user.",
      confirmLabel: "Approve",
      confirmVariant: "danger"
    });

    if (isConfirmed) {
        try {
          const res = await api.delete('/users/' + id);
          if (res.data.success) {
            showAlert("Success", "User account deleted successfully.", "success");
            loadUsers();
          }
        } catch (err) {
          showAlert("Error", "Failed to approve deletion.", "error");
        }
    }
  };

  const handleRejectDeletion = async (id) => {
    const isConfirmed = await confirm({
      title: "Reject Deletion",
      text: "Reject account deletion? The user account will remain active.",
      confirmLabel: "Reject",
      confirmVariant: "secondary"
    });

    if (isConfirmed) {
        try {
          await api.put('/users/' + id, { delete_requested: false });
          showAlert("Success", "Account deletion request rejected.", "success");
          loadUsers();
        } catch (err) {
          showAlert("Error", "Failed to reject deletion request.", "error");
        }
    }
  };

  const deletionRequests = users.filter(user => user.delete_requested);
  const regularUsers = users.filter(user => !user.delete_requested);

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
        <div className="table-box mb-5">
          <h3 className="text-center text-danger mb-4">Account Deletion Requests</h3>

          <div className="table-container">
            <table className="table table-bordered text-center mb-0">
              <thead className="thead-light bg-danger text-white">
                <tr>
                  <th>Username</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {deletionRequests.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-muted py-4">No pending account deletion requests.</td>
                  </tr>
                ) : (
                  deletionRequests.map(user => (
                    <tr key={user.id}>
                      <td className="fw-bold">{user.username}</td>
                      <td>{user.first_name} {user.last_name}</td>
                      <td>{user.email}</td>
                      <td>
                        <button className="btn btn-sm btn-success me-2" onClick={() => handleApproveDeletion(user.id)}>
                          Approve (Delete)
                        </button>
                        <button className="btn btn-sm btn-secondary" onClick={() => handleRejectDeletion(user.id)}>
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="table-box">
          <h3 className="text-center mb-4">Registered Users</h3>

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
                {regularUsers.length === 0 ? (
                  <tr>
                    <td colSpan="6">No users found.</td>
                  </tr>
                ) : (
                  regularUsers.map(user => (
                    <tr key={user.id}>
                      <td>{user.username}</td>

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
                          `${user.first_name} ${user.last_name}`
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
