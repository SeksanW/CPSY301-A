// Functions only accessible to the admin. 
// Admin can view all users, register new users.
// Lock/unlock accounts.
import { useEffect, useState } from 'react';
import api from '../api/axios';
import Layout from '../components/Layout';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ username: '', name: '', email: '', password: '', role: 'user' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchUsers = () => {
    api.get('/auth/users').then(res => setUsers(res.data)).finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      await api.post('/auth/register', form);
      setSuccess('User registered.');
      setForm({ username: '', name: '', email: '', password: '', role: 'user' });
      setShowAdd(false);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to register user.');
    }
  };

  const toggleActive = async (userId) => {
    await api.patch(`/auth/users/${userId}/toggle-active`);
    fetchUsers();
  };

  return (
    <Layout>
      <div className="page-header">
        <h1>Manage Users</h1>
        <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? 'Cancel' : '+ Add User'}
        </button>
      </div>

      {success && <div className="alert alert-success">{success}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {showAdd && (
        <div className="card">
          <h2>Register New User</h2>
          <form onSubmit={handleAdd} className="add-form">
            <div className="form-row">
              <div className="form-group">
                <label>Username *</label>
                <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Full Name *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Password *</label>
                <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  <option value="user">Team Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <button type="submit" className="btn btn-primary">Register</button>
          </form>
        </div>
      )}

      <div className="card">
        {loading ? <p>Loading...</p> : (
          <table className="table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Online</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.user_id}>
                  <td>{u.username}</td>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td><span className={`role-badge role-${u.role}`}>{u.role}</span></td>
                  <td><span className={u.is_active ? 'status-active' : 'status-inactive'}>{u.is_active ? 'Active' : 'Locked'}</span></td>
                  <td>{u.is_online ? '🟢' : '⚫'}</td>
                  <td>
                    <button className="btn btn-outline btn-sm" onClick={() => toggleActive(u.user_id)}>
                      {u.is_active ? 'Lock' : 'Unlock'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}
