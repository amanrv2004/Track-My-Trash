import React, { useState, useEffect } from 'react';
import { Container, Card, Table, Button, Form, Alert, Modal } from 'react-bootstrap';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const UserManagementPage = () => {
  const { user } = useAuth(); // Assuming user is admin and has token
  const [users, setUsers] = useState([]);
  const [drivers, setDrivers] = useState([]); // Needed for filtering drivers if component uses it
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editUserData, setEditUserData] = useState({});
  const [filter, setFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, [user]); // Added user to dependency array

  const fetchUsers = async () => {
    try {
      const config = {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      };
      const usersRes = await axios.get(`${import.meta.env.VITE_SERVER_URL}/api/admin/users`, config);
      setUsers(usersRes.data);
      setDrivers(usersRes.data.filter(u => u.role === 'driver')); // Populate drivers list for potential use
    } catch (err) {
      setError(err.response?.data?.message || 'Error fetching users.');
    }
  };

  const handleEditUser = (userToEdit) => {
    setSelectedUser(userToEdit);
    setEditUserData({
      name: userToEdit.name,
      email: userToEdit.email,
      role: userToEdit.role,
      vehicleNumber: userToEdit.vehicleNumber || '', // Include for drivers
      phone: userToEdit.phone || '', // Include for drivers
    });
    setShowUserModal(true);
  };

  const handleUpdateUser = async () => {
    try {
      const config = {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
      };
      await axios.put(`${import.meta.env.VITE_SERVER_URL}/api/admin/users/${selectedUser._id}`, editUserData, config);
      setMessage('User updated successfully!');
      setShowUserModal(false);
      fetchUsers(); // Re-fetch data
    } catch (err) {
      setError(err.response?.data?.message || 'Error updating user.');
    }
  };

  const handleDeleteUser = async (id) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        const config = {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        };
        await axios.delete(`${import.meta.env.VITE_SERVER_URL}/api/admin/users/${id}`, config);
        setMessage('User deleted successfully!');
        fetchUsers();
      } catch (err) {
        setError(err.response?.data?.message || 'Error deleting user.');
      }
    }
  };

  const filteredUsers = users
    .filter(u => filter === 'All' || u.role === filter)
    .filter(u =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

  return (
    <Container className="my-5">
      <h2>User Management</h2>
      {message && <Alert variant="success">{message}</Alert>}
      {error && <Alert variant="danger">{error}</Alert>}

      <Card className="mb-4">
        <Card.Header>Filter and Search</Card.Header>
        <Card.Body>
          <Form className="d-flex">
            <Form.Group controlId="filterRole" className="me-3">
              <Form.Label>Filter by Role</Form.Label>
              <Form.Control as="select" value={filter} onChange={e => setFilter(e.target.value)}>
                <option value="All">All</option>
                <option value="resident">Resident</option>
                <option value="driver">Driver</option>
                <option value="admin">Admin</option>
              </Form.Control>
            </Form.Group>
            <Form.Group controlId="searchTerm">
              <Form.Label>Search by Name or Email</Form.Label>
              <Form.Control
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </Form.Group>
          </Form>
        </Card.Body>
      </Card>

      {/* User Management Table */}
      <Card className="mb-4">
        <Card.Header>Manage Users</Card.Header>
        <Card.Body>
          <Table striped bordered hover responsive>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u._id}>
                  <td>{u._id}</td>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>
                    <Button variant="info" size="sm" className="me-2" onClick={() => handleEditUser(u)}>Edit</Button>
                    {u.role !== 'admin' && (
                      <Button variant="danger" size="sm" onClick={() => handleDeleteUser(u._id)}>Delete</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      {/* User Edit Modal */}
      <Modal show={showUserModal} onHide={() => setShowUserModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Edit User</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3" controlId="editName">
              <Form.Label>Name</Form.Label>
              <Form.Control type="text" value={editUserData.name || ''} onChange={(e) => setEditUserData({ ...editUserData, name: e.target.value })} />
            </Form.Group>
            <Form.Group className="mb-3" controlId="editEmail">
              <Form.Label>Email</Form.Label>
              <Form.Control type="email" value={editUserData.email || ''} onChange={(e) => setEditUserData({ ...editUserData, email: e.target.value })} />
            </Form.Group>
            <Form.Group className="mb-3" controlId="editRole">
              <Form.Label>Role</Form.Label>
              <Form.Control as="select" value={editUserData.role || ''} onChange={(e) => setEditUserData({ ...editUserData, role: e.target.value })}>
                <option value="resident">Resident</option>
                <option value="driver">Driver</option>
                <option value="admin">Admin</option>
              </Form.Control>
            </Form.Group>
            {editUserData.role === 'driver' && (
              <>
                <Form.Group className="mb-3" controlId="editVehicleNumber">
                  <Form.Label>Vehicle Number</Form.Label>
                  <Form.Control type="text" value={editUserData.vehicleNumber || ''} onChange={(e) => setEditUserData({ ...editUserData, vehicleNumber: e.target.value })} />
                </Form.Group>
                <Form.Group className="mb-3" controlId="editPhone">
                  <Form.Label>Phone</Form.Label>
                  <Form.Control type="text" value={editUserData.phone || ''} onChange={(e) => setEditUserData({ ...editUserData, phone: e.target.value })} />
                </Form.Group>
              </>
            )}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowUserModal(false)}>Close</Button>
          <Button variant="primary" onClick={handleUpdateUser}>Save Changes</Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default UserManagementPage;