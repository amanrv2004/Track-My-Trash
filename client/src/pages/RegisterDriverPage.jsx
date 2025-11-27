import React, { useState } from 'react';
import { Container, Card, Form, Button, Alert } from 'react-bootstrap';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const RegisterDriverPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverEmail, setNewDriverEmail] = useState('');
  const [newDriverPassword, setNewDriverPassword] = useState('');
  const [newDriverVehicleNumber, setNewDriverVehicleNumber] = useState('');
  const [newDriverPhone, setNewDriverPhone] = useState('');

  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const handleDriverRegister = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const config = {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
      };
      await axios.post(`${import.meta.env.VITE_SERVER_URL}/api/users/register/driver`, {
        name: newDriverName,
        email: newDriverEmail,
        password: newDriverPassword,
        vehicleNumber: newDriverVehicleNumber,
        phone: newDriverPhone,
      }, config);
      setMessage('Driver registered successfully!');
      setNewDriverName('');
      setNewDriverEmail('');
      setNewDriverPassword('');
      setNewDriverVehicleNumber('');
      setNewDriverPhone('');
      // Optionally navigate back to admin dashboard or show a list of drivers
    } catch (err) {
      setError(err.response?.data?.message || 'Error registering driver.');
    }
  };

  return (
    <Container className="my-5">
      <Card>
        <Card.Header>Register New Driver</Card.Header>
        <Card.Body>
          {message && <Alert variant="success">{message}</Alert>}
          {error && <Alert variant="danger">{error}</Alert>}
          <Form onSubmit={handleDriverRegister}>
            <Form.Group className="mb-3" controlId="newDriverName">
              <Form.Label>Name</Form.Label>
              <Form.Control type="text" placeholder="Enter name" value={newDriverName} onChange={(e) => setNewDriverName(e.target.value)} required />
            </Form.Group>
            <Form.Group className="mb-3" controlId="newDriverEmail">
              <Form.Label>Email</Form.Label>
              <Form.Control type="email" placeholder="Enter email" value={newDriverEmail} onChange={(e) => setNewDriverEmail(e.target.value)} required />
            </Form.Group>
            <Form.Group className="mb-3" controlId="newDriverPassword">
              <Form.Label>Password</Form.Label>
              <Form.Control type="password" placeholder="Enter password" value={newDriverPassword} onChange={(e) => setNewDriverPassword(e.target.value)} required />
            </Form.Group>
            <Form.Group className="mb-3" controlId="newDriverVehicleNumber">
              <Form.Label>Vehicle Number</Form.Label>
              <Form.Control type="text" placeholder="Enter vehicle number" value={newDriverVehicleNumber} onChange={(e) => setNewDriverVehicleNumber(e.target.value)} required />
            </Form.Group>
            <Form.Group className="mb-3" controlId="newDriverPhone">
              <Form.Label>Phone Number</Form.Label>
              <Form.Control type="text" placeholder="Enter phone number" value={newDriverPhone} onChange={(e) => setNewDriverPhone(e.target.value)} required />
            </Form.Group>
            <Button variant="primary" type="submit">Register Driver</Button>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default RegisterDriverPage;