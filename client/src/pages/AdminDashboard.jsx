import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Card, Table, Button, Form, Alert, Modal, Nav } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import io from 'socket.io-client';
import MapComponent, { getCustomIcons } from '../components/MapComponent';
import L from 'leaflet';
import { Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const AdminDashboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [complaints, setComplaints] = useState([]);
  const [emergencyRequests, setEmergencyRequests] = useState([]);
  const [driverLocations, setDriverLocations] = useState({}); // {driverId: [lat, lng]}
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeEmergencyPickups, setActiveEmergencyPickups] = useState({}); // {requestId: requestObject}

  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const socketRef = useRef(null); // Use ref for socket instance

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) {
      navigate('/login');
    }

    if (user && user.role === 'admin') {
      // Initialize Socket.io
      socketRef.current = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:5002');
      socketRef.current.emit('join', 'admin'); // Admin joins 'admin' room

      // Listen for real-time updates
      socketRef.current.on('newComplaint', (newComplaint) => {
        setComplaints((prev) => [...prev, newComplaint]);
        setMessage('New complaint received!');
      });

      socketRef.current.on('newEmergencyRequest', (newRequest) => {
        setEmergencyRequests((prev) => [...prev, newRequest]);
        setMessage('New emergency request received!');
      });

      // Listen for updates to emergency requests
      socketRef.current.on('emergencyRequestUpdate', (updatedRequest) => {
        setEmergencyRequests((prev) =>
          prev.map((req) => (req._id === updatedRequest._id ? updatedRequest : req))
        );
        setMessage(`Emergency request ${updatedRequest._id} status updated to ${updatedRequest.status}!`);

        if (updatedRequest.status === 'assigned' || updatedRequest.status === 'in_progress') {
          setActiveEmergencyPickups((prev) => ({
            ...prev,
            [updatedRequest._id]: updatedRequest,
          }));
        } else {
          setActiveEmergencyPickups((prev) => {
            const newState = { ...prev };
            delete newState[updatedRequest._id];
            return newState;
          });
        }
      });

      socketRef.current.on('locationUpdate', ({ driverId, location }) => {
        setDriverLocations((prev) => ({
          ...prev,
          [driverId]: [location[1], location[0]], // Leaflet uses [lat, lng]
        }));
      });

      socketRef.current.on('driverStoppedLocation', ({ driverId }) => {
        setDriverLocations((prev) => {
          const newDriverLocations = { ...prev };
          delete newDriverLocations[driverId];
          return newDriverLocations;
        });
        setMessage(`Driver ${driverId} has stopped sharing location.`);
      });

      fetchData();
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [user, loading, navigate]);

  const fetchData = async () => {
    try {
      const config = {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      };
      const complaintsRes = await axios.get(`${import.meta.env.VITE_SERVER_URL}/api/complaints`, config); // Assuming this API exists
      setComplaints(complaintsRes.data);

      const emergencyRes = await axios.get(`${import.meta.env.VITE_SERVER_URL}/api/emergency-requests`, config); // Assuming this API exists
      setEmergencyRequests(emergencyRes.data);

    } catch (err) {
      setError(err.response?.data?.message || 'Error fetching data.');
    }
  };

  const handleComplaintStatusChange = async (id, status) => {
    try {
      const config = {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      };
      await axios.put(`${import.meta.env.VITE_SERVER_URL}/api/complaints/${id}`, { status }, config); // Assuming this API exists
      setMessage('Complaint status updated!');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Error updating complaint status.');
    }
  };

  const handleEmergencyRequestStatus = async (id, status, driverId = null) => {
    try {
      const config = {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      };
      await axios.put(`${import.meta.env.VITE_SERVER_URL}/api/emergency-requests/${id}`, { status, assignedDriver: driverId }, config); // Assuming this API exists
      setMessage('Emergency request status updated!');
      fetchData();
      // The Socket.io event for emergencyRequestUpdate is now handled by the backend
      // and will update the frontend states (emergencyRequests and activeEmergencyPickups)
      // upon receiving the update.
    } catch (err) {
      setError(err.response?.data?.message || 'Error updating emergency request status.');
    }
  };

  if (loading) {
    return <Container className="my-5 text-center">Loading...</Container>;
  }

  // Calculate dynamic map center and zoom
  const activeDriverLocations = Object.values(driverLocations);
  let mapCenter = [20.5937, 78.9629]; // Default to India coordinates
  let mapZoom = 5;

  if (activeDriverLocations.length > 0) {
    // For simplicity, center on the first driver.
    // A more advanced approach would calculate the centroid of all drivers.
    mapCenter = activeDriverLocations[0];
    mapZoom = 10; // Zoom in closer if drivers are present
  }

  return (
    <Container className="my-5">
      <Row>
        <Col>
          <h2>Admin Dashboard</h2>
          {message && <Alert variant="success">{message}</Alert>}
          {error && <Alert variant="danger">{error}</Alert>}
          {/* Emergency Pickup Requests */}
          <Card className="mb-4">
            <Card.Header>Emergency Pickup Requests</Card.Header>
            <Card.Body>
              <Table striped bordered hover responsive>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Resident</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {emergencyRequests.map(er => (
                    <tr key={er._id}>
                      <td>{er._id}</td>
                      <td>{er.resident?.name}</td>
                      <td>{er.reason}</td>
                      <td>{er.status}</td>
                      <td>
                        {er.status === 'pending' && (
                          <Form.Control as="select" onChange={(e) => handleEmergencyRequestStatus(er._id, 'assigned', e.target.value)} className="me-2">
                            <option value="">Assign Driver</option>
                            {/* The drivers state is not available in this simplified dashboard, it will be fetched in AssignDriverToHousePage */}
                          </Form.Control>
                        )}
                        <Button variant="success" size="sm" onClick={() => handleEmergencyRequestStatus(er._id, 'resolved')}>Resolve</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>

         

         
          {/* Live Tracking Map */}
          <Card className="mb-4">
            <Card.Header>Live Tracking Map</Card.Header>
            <Card.Body style={{ height: '500px' }}>
              {(() => {
                const customIcons = L ? getCustomIcons(L) : {};
                const houseIcon = customIcons.houseIcon;
                const assignedDriverIcon = customIcons.assignedDriverIcon;
                const emergencyHouseIcon = customIcons.emergencyHouseIcon;
                const emergencyDriverIcon = customIcons.emergencyDriverIcon;

                const mapMarkers = [];
                let currentMapCenter = [20.5937, 78.9629]; // Default to India
                let currentMapZoom = 5;

                if (Object.keys(activeEmergencyPickups).length > 0) {
                  // Display only active emergency pickups
                  const activeERs = Object.values(activeEmergencyPickups);
                  if (activeERs.length > 0) {
                    const firstER = activeERs[0];
                    currentMapCenter = [firstER.resident.house.location.coordinates[1], firstER.resident.house.location.coordinates[0]];
                    currentMapZoom = 13;

                    activeERs.forEach(er => {
                      if (er.resident && er.resident.house && er.resident.house.location) {
                        mapMarkers.push({
                          key: `er-res-${er._id}`,
                          position: [er.resident.house.location.coordinates[1], er.resident.house.location.coordinates[0]],
                          popupText: `Resident: ${er.resident.name} (Emergency)`,
                          icon: emergencyHouseIcon,
                        });
                      }
                      if (er.assignedDriver && driverLocations[er.assignedDriver._id]) {
                        mapMarkers.push({
                          key: `er-driver-${er._id}`,
                          position: driverLocations[er.assignedDriver._id],
                          popupText: `Driver: ${er.assignedDriver.name} (Emergency)`,
                          icon: emergencyDriverIcon,
                        });
                      }
                    });

                    // Adjust map center if both resident and driver are on map for one ER
                    if (mapMarkers.length === 2 && activeERs.length === 1) {
                      const resPos = mapMarkers[0].position;
                      const driverPos = mapMarkers[1].position;
                      currentMapCenter = [
                        (resPos[0] + driverPos[0]) / 2,
                        (resPos[1] + driverPos[1]) / 2,
                      ];
                      currentMapZoom = 12;
                    }
                  }
                } else if (Object.keys(driverLocations).length > 0) {
                  // Display all live drivers if no active emergencies
                  const activeDriverLocationsArray = Object.values(driverLocations);
                  currentMapCenter = activeDriverLocationsArray[0]; // Center on first driver
                  currentMapZoom = 10;

                  Object.entries(driverLocations).forEach(([driverId, coords]) => {
                    mapMarkers.push({
                      key: `driver-${driverId}`,
                      position: coords,
                      popupText: `Driver: ${driverId}`, // Will need to get driver name if available
                      icon: assignedDriverIcon,
                    });
                  });
                }
                
                return (
                  <MapComponent
                    center={currentMapCenter}
                    zoom={currentMapZoom}
                    markers={mapMarkers}
                  />
                );
              })()}
              {(Object.keys(activeEmergencyPickups).length === 0 && Object.keys(driverLocations).length === 0) && (
                <div className="d-flex justify-content-center align-items-center h-100">
                  <p>No active drivers or emergency pickups to display on map.</p>
                </div>
              )}
            </Card.Body>
          </Card>
          <Card className="mb-4">
            <Card.Header>Assign Driver to House</Card.Header>
            <Card.Body><Button variant="secondary" onClick={() => navigate('/admin/assign-driver-to-house')}>Assign Drivers</Button></Card.Body>
          </Card>
          
          <Card className="mb-4">
            <Card.Header>User Management</Card.Header>
            <Card.Body><Button variant="secondary" onClick={() => navigate('/admin/user-management')}>Manage Users</Button></Card.Body>
          </Card>
           {/* Complaint Management */}
          <Card className="mb-4">
            <Card.Header>Complaint Management</Card.Header>
            <Card.Body>
              <Table striped bordered hover responsive>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Resident</th>
                    <th>Subject</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {complaints.map(c => (
                    <tr key={c._id}>
                      <td>{c._id}</td>
                      <td>{c.resident?.name}</td>
                      <td>{c.subject}</td>
                      <td>{c.status}</td>
                      <td>
                        <Form.Control as="select" value={c.status} onChange={(e) => handleComplaintStatusChange(c._id, e.target.value)}>
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="resolved">Resolved</option>
                        </Form.Control>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
           

          {/* Other Admin Sections (Placeholders) */}
          <Card className="mb-4">
            <Card.Header>Payments & Subscriptions</Card.Header>
            <Card.Body><Button variant="secondary">Manage Payments</Button></Card.Body>
          </Card>
          <Card className="mb-4">
            <Card.Header>Analytics & Reports</Card.Header>
            <Card.Body><Button variant="secondary">View Reports</Button></Card.Body>
          </Card>
          <Card className="mb-4">
            <Card.Header>Export Data (CSV/PDF)</Card.Header>
            <Card.Body><Button variant="secondary">Export</Button></Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default AdminDashboard;
