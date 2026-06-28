import { useEffect, useState } from 'react';
import api from '../api/axiosConfig';
import '../assets/styles/orderdatabase.css'; 
import carousel4 from '../assets/styles/images/carousel4.png';
import AlertModal from '../components/AlertModal';

function AdminUsers() {
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
      const res = await api.get('/read.php?type=users');
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
      await api.put('/update.php', {
        type: 'user',
        id: editingUser,
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: formData.phone
      });

      setEditingUser(null);
      loadUsers();
      showAlert("Success", "User updated successfully", "success");
    } catch (err) {
      showAlert("Error", "Failed to update user", "error");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("⚠️ Are you sure you want to delete this user?")) return;

    try {
      // 🔥 USE POST INSTEAD OF DELETE
      const res = await api.post('/delete.php', {
        type: 'user',
        id: id
      });

      if (res.data.success) {
        showAlert("Success", "User deleted successfully", "success");
        loadUsers();
      } else {
        showAlert("Warning", res.data.message, "warning");
      }
    } catch (err) {
      showAlert("Error", "Cannot delete user with existing orders", "error");
    }
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
    <div>
      <img className="img-fluid banner-img" src={carousel4} alt="Banner" />

      <section className="section-bg">
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
                {users.length === 0 ? (
                  <tr>
                    <td colSpan="6">No users found.</td>
                  </tr>
                ) : (
                  users.map(user => (
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
