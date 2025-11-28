import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Card, Button, ListGroup, Alert, Form } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import MapComponent, { getCustomIcons } from '../components/MapComponent';
import L from 'leaflet';
import io from 'socket.io-client';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || 'your_stripe_public_key');

const ResidentDashboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [assignedDriver, setAssignedDriver] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [emergencyReason, setEmergencyReason] = useState('');
  const [emergencyPreferredTime, setEmergencyPreferredTime] = useState('');
  const [complaintSubject, setComplaintSubject] = useState('');
  const [complaintDescription, setComplaintDescription] = useState('');
  const [alertMessage, setAlertMessage] = useState(null);
  const [error, setError] = useState(null);
  const [notifications, setNotifications] = useState([]); // New state for notifications
  const [residentLocation, setResidentLocation] = useState(null); // New state for resident's house location
  const [driverPickupStatus, setDriverPickupStatus] = useState(null); // 'picked', 'not_picked', or null
  const [activeEmergencyRequest, setActiveEmergencyRequest] = useState(null); // New state for active emergency request
  const [status, setStatus] = useState('Connecting...');
  const [initialMapCenter, setInitialMapCenter] = useState(null); // New state for fixed map center
  const [initialMapZoom, setInitialMapZoom] = useState(null); // New state for fixed map zoom

  const socketRef = useRef(null); // Use ref for socket instance
  const locationPollingIntervalRef = useRef(null); // Use ref for polling interval

  useEffect(() => {
    // This effect handles socket connection and disconnection events
    if (socketRef.current) {
      socketRef.current.on('connect', () => {
        setStatus('Connected');
        console.log('Socket.io connected.');
      });

      socketRef.current.on('disconnect', () => {
        setStatus('Disconnected. Reconnecting...');
        console.log('Socket.io disconnected.');
      });
    }
  }, [socketRef.current]);

  useEffect(() => {
    console.log("ResidentDashboard useEffect triggered.");
    console.log("User object in ResidentDashboard:", user);
    console.log("Loading state in ResidentDashboard:", loading);

    if (!loading && (!user || user.role !== 'resident')) {
      console.log("Redirecting to login: User not authenticated or not a resident.");
      navigate('/login');
      return;
    }

    if (user && user.role === 'resident') {
      console.log("User is resident, initializing dashboard features.");
      // Set resident's registered house location and initial map view
      if (user.house && user.house.location && user.house.location.coordinates) {
        const resLoc = [user.house.location.coordinates[1], user.house.location.coordinates[0]];
        setResidentLocation(resLoc);
        // Set initial map center and zoom based on resident's house
        if (!initialMapCenter || !initialMapZoom) {
          setInitialMapCenter(resLoc);
          setInitialMapZoom(15); // A reasonable zoom level for a house
        }
        console.log("Resident location set:", resLoc);
      } else {
        console.log("User house location not available in user object:", user.house);
        // Fallback for initial map center if resident house not available
        if (!initialMapCenter || !initialMapZoom) {
          setInitialMapCenter([20.5937, 78.9629]); // Default to India
          setInitialMapZoom(5);
        }
      }

      // Initialize socket here and manage its lifecycle
      socketRef.current = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:5002');

      // Join rooms
      socketRef.current.emit('join', user._id); // Join own user ID room
      if (user.house) {
        socketRef.current.emit('join', user.house._id); // Join house ID room
      }

      // Fetch assigned driver details
      const fetchAssignedDriver = async () => {
        try {
          const { data } = await axios.get(`${import.meta.env.VITE_SERVER_URL}/api/resident/driver`);
          setAssignedDriver(data);
          if (data && data._id) {
            socketRef.current.emit('join', data._id); // Join assigned driver's ID room
          }
        } catch (err) {
          console.error('Error fetching assigned driver:', err);
          setError('Failed to fetch assigned driver details.');
        }
      };

      fetchAssignedDriver();

      // Listen for pickup status updates
      socketRef.current.on('pickupStatus', (data) => {
        console.log('Socket: Received pickupStatus:', data);
        if (user.house && data.houseId === user.house._id) { // Ensure it's for this resident's house, use _id
          setAlertMessage(`Pickup status for your house updated: ${data.status}`);
          setDriverPickupStatus(data.status); // Update new state
        }
      });

      // Listen for emergency request events
      socketRef.current.on('emergencyRequestUpdate', (data) => {
        console.log('Socket: Received emergencyRequestUpdate:', data);
        if (data.resident === user._id) { // Ensure it's for this resident
          if (data.status === 'assigned' || data.status === 'in_progress') { // Assuming 'in_progress' is driver confirmed
            setActiveEmergencyRequest(data);
            setAlertMessage(`Emergency request (ID: ${data._id}) is now ${data.status} by driver!`);
            setNotifications((prevNotifications) => [
              ...prevNotifications,
              { message: `Emergency request (ID: ${data._id}) is ${data.status}!`, timestamp: new Date() },
            ]);
          } else if (data.status === 'resolved' || data.status === 'cancelled') {
            setActiveEmergencyRequest(null); // Clear active emergency request
            setAlertMessage(`Your emergency request (ID: ${data._id}) has been ${data.status}.`);
            setNotifications((prevNotifications) => [
              ...prevNotifications,
              { message: `Emergency request (ID: ${data._id}) ${data.status}!`, timestamp: new Date() },
            ]);
          }
        }
      });

      // Listen for emergency request resolution (old event, might be replaced by emergencyRequestUpdate)
      socketRef.current.on('emergencyRequestResolved', (data) => {
        console.log('Socket: Received emergencyRequestResolved (old):', data);
        setAlertMessage(`Your emergency request (ID: ${data._id}) has been resolved.`);
        setNotifications((prevNotifications) => [
          ...prevNotifications,
          { message: `Emergency request (ID: ${data._id}) resolved!`, timestamp: new Date() },
        ]);
        setActiveEmergencyRequest(null); // Ensure cleared on old event too
      });
      
      // Listen for admin irregularity alerts (e.g., if relevant to resident)
      socketRef.current.on('irregularityAlert', (data) => {
        console.log('Socket: Received irregularityAlert:', data);
        setAlertMessage(`Admin Alert: ${data.message}`);
        setNotifications((prevNotifications) => [
          ...prevNotifications,
          { message: `Admin Alert: ${data.message}`, timestamp: new Date() },
        ]);
      });

      // Listen for proximity alerts
      socketRef.current.on('proximityAlert', (data) => {
        console.log('Socket: Received proximityAlert:', data);
        setNotifications((prevNotifications) => [
          ...prevNotifications,
          { message: data.message, timestamp: data.timestamp },
        ]);
        setAlertMessage(data.message); // Also show as a temporary alert
      });

      // Listen for driver assigned event
      socketRef.current.on('driverAssigned', (data) => {
        console.log('Socket: Received driverAssigned:', data);
        setAssignedDriver(data.driver);
        setNotifications((prevNotifications) => [
          ...prevNotifications,
          { message: data.message, timestamp: new Date() },
        ]);
        setAlertMessage(data.message);
      });

      // Listen for driver unassigned event
      socketRef.current.on('driverUnassigned', (data) => {
        console.log('Socket: Received driverUnassigned:', data);
        setAssignedDriver(null);
        setDriverLocation(null);
        setNotifications((prevNotifications) => [
          ...prevNotifications,
          { message: data.message, timestamp: new Date() },
        ]);
        setAlertMessage(data.message); // Also show as a temporary alert
      });

      return () => {
        if (socketRef.current) {
          socketRef.current.disconnect();
        }
      };
    }
  }, [user, loading, navigate]);

  // Polling for assigned driver's location every 3 seconds
  useEffect(() => {
    if (assignedDriver && user) {
      const fetchDriverLocation = async () => {
        try {
          const config = {
            headers: {
              Authorization: `Bearer ${user.token}`,
            },
          };
          const { data } = await axios.get(`${import.meta.env.VITE_SERVER_URL}/api/resident/assigned-driver-location`, config);
          // Backend returns [longitude, latitude], Leaflet needs [latitude, longitude]
          setDriverLocation([data[1], data[0]]);
        } catch (err) {
          console.error('Error fetching assigned driver location:', err);
          // setError(err.response?.data?.message || 'Failed to fetch driver location.');
          setDriverLocation(null); // Clear driver location on error
        }
      };

      // Fetch immediately and then every 3 seconds
      fetchDriverLocation();
      locationPollingIntervalRef.current = setInterval(fetchDriverLocation, 3000);
    } else {
      // Clear interval if no driver assigned or user logs out
      if (locationPollingIntervalRef.current) {
        clearInterval(locationPollingIntervalRef.current);
        locationPollingIntervalRef.current = null;
      }
      setDriverLocation(null);
    }

    return () => {
      if (locationPollingIntervalRef.current) {
        clearInterval(locationPollingIntervalRef.current);
        locationPollingIntervalRef.current = null;
      }
    };
  }, [assignedDriver, user]); // Re-run when assignedDriver or user changes

  // New useEffect to handle driver location updates when assignedDriver changes
  useEffect(() => {
    if (socketRef.current && assignedDriver) {
      const handleLocationUpdate = (data) => {
        console.log('Socket: Received locationUpdate in new effect:', data);
        if (data.driverId === assignedDriver._id) {
          setDriverLocation([data.location[1], data.location[0]]);
          console.log('Driver location updated for map (new effect):', [data.location[1], data.location[0]]);
        }
      };
      socketRef.current.on('locationUpdate', handleLocationUpdate);

      return () => {
        socketRef.current.off('locationUpdate', handleLocationUpdate);
      };
    } else if (socketRef.current && assignedDriver === null) {
      // Clear driver location if driver is unassigned
      setDriverLocation(null);
    }
  }, [assignedDriver]);

  const handleSubscribe = async (plan) => {
    console.log(`Subscribing to ${plan} plan.`);
    try {
      const stripe = await stripePromise;
      const response = await axios.post(`${import.meta.env.VITE_SERVER_URL}/api/payments/create-checkout-session`, {
        plan,
        userId: user._id,
        userEmail: user.email,
      });
      const session = response.data;
      const result = await stripe.redirectToCheckout({
        sessionId: session.id,
      });
      if (result.error) {
        setError(result.error.message);
      }
    } catch (error) {
      setError(error.response?.data?.message || error.message);
    }
  };

  const handleEmergencyRequest = async (e) => {
    e.preventDefault();
    console.log('Submitting emergency request:', { emergencyReason, emergencyPreferredTime });
    try {
      await axios.post(`${import.meta.env.VITE_SERVER_URL}/api/emergency-requests`, {
        resident: user._id,
        reason: emergencyReason,
        preferredTime: emergencyPreferredTime,
        house: user.house._id // Assuming user.house contains the house ID
      });
      setAlertMessage('Emergency request submitted successfully!');
      setEmergencyReason('');
      setEmergencyPreferredTime('');
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  };

  const handleFileComplaint = async (e) => {
    e.preventDefault(); // Prevent default if event object is present

    console.log('Submitting complaint:', { complaintSubject, complaintDescription });
    try {
      await axios.post(`${import.meta.env.VITE_SERVER_URL}/api/complaints`, {
        resident: user._id,
        subject: complaintSubject,
        description: complaintDescription,
      });
      setAlertMessage('Complaint submitted successfully!');
      setComplaintSubject('');
      setComplaintDescription('');
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  };

  if (loading) {
    return <Container className="my-5 text-center">Loading...</Container>;
  }

  return (
    <Container className="my-5">
      <Row>
        <Col md={8}>
          <h2>Resident Dashboard</h2>
          {alertMessage && <Alert variant="info">{alertMessage}</Alert>}
          {error && <Alert variant="danger">{error}</Alert>}
          <Alert variant={status === 'Connected' ? 'success' : 'warning'}>{status}</Alert>

          {/* Live Map */}
          <Card className="mb-4">
            <Card.Header>Map View</Card.Header>
            <Card.Body style={{ height: '400px' }}>
              {(driverLocation || residentLocation) ? (
                (() => {
                  const customIcons = L ? getCustomIcons(L) : {};
                  const houseIcon = customIcons.houseIcon;
                  const assignedDriverIcon = customIcons.assignedDriverIcon;
                  const emergencyHouseIcon = customIcons.emergencyHouseIcon;
                  const emergencyDriverIcon = customIcons.emergencyDriverIcon;

                  const mapMarkers = [];
                  let mapCenter = null;
                  let mapZoom = 13;

                  if (residentLocation) {
                    mapMarkers.push({ position: residentLocation, popupText: `Your House: ${user.house?.houseNo}`, icon: activeEmergencyRequest ? emergencyHouseIcon : houseIcon });
                    mapCenter = residentLocation;
                  }
                  if (driverLocation) {
                    mapMarkers.push({ position: driverLocation, popupText: `Driver: ${assignedDriver?.name}`, icon: activeEmergencyRequest ? emergencyDriverIcon : assignedDriverIcon });
                    mapCenter = driverLocation; // Default to driver if both exist, or resident location if only resident exists
                  }

                  if (residentLocation && driverLocation) {
                    // Calculate center between two points
                    mapCenter = [
                      (residentLocation[0] + driverLocation[0]) / 2,
                      (residentLocation[1] + driverLocation[1]) / 2,
                    ];
                    // You might want to adjust zoom level here based on distance between points
                    mapZoom = 12; // Example: zoom out slightly if both are visible
                  } else if (residentLocation) {
                    mapCenter = residentLocation;
                    mapZoom = 13;
                  } else if (driverLocation) {
                    mapCenter = driverLocation;
                    mapZoom = 13;
                  }


                  return (
                    <Card className="mb-4">
            <Card.Header>Notifications</Card.Header>
            <Card.Body>
              {notifications.length > 0 ? (
                <ListGroup variant="flush">
                  {notifications.map((notification, index) => (
                    <ListGroup.Item key={index}>
                      {notification.message}
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              ) : (
                <Alert variant="info">No new notifications.</Alert>
              )}
            </Card.Body>
          </Card>
                    
                    <MapComponent
                      center={initialMapCenter || [0,0]} // Use fixed initial map center
                      zoom={initialMapZoom || 5} // Use fixed initial map zoom
                      markers={mapMarkers}
                    />
                  );
                })()
              ) : (
                <div className="d-flex justify-content-center align-items-center h-100">
                  <p>No location data available to display on map.</p>
                </div>
              )}
            </Card.Body>
          </Card>

          {/* Placeholder Sections */}
          <Card className="mb-4">
            <Card.Header>Pickup Status</Card.Header>
            <Card.Body>
              {driverPickupStatus === 'picked' ? (
                <Alert variant="success">Driver marked pickup as: **PICKED**</Alert>
              ) : driverPickupStatus === 'not_picked' ? (
                <Alert variant="warning">Driver marked pickup as: **NOT PICKED**</Alert>
              ) : (
                <Alert variant="info">Waiting for driver to update pickup status.</Alert>
              )}
            </Card.Body>
          </Card>

          {/* New dedicated File a Complaint section */}
          <Card className="mb-4">
            <Card.Header>File a Complaint</Card.Header>
            <Card.Body>
              <Form onSubmit={handleFileComplaint}>
                <Form.Group className="mb-3" controlId="complaintSubject">
                  <Form.Label>Subject</Form.Label>
                  <Form.Control
                    type="text"
                    value={complaintSubject}
                    onChange={(e) => setComplaintSubject(e.target.value)}
                    placeholder="e.g., Missed pickup, Driver behavior"
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3" controlId="complaintDescription">
                  <Form.Label>Description</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={complaintDescription}
                    onChange={(e) => setComplaintDescription(e.target.value)}
                    placeholder="Provide details about your complaint"
                    required
                  />
                </Form.Group>
                <Button variant="danger" type="submit">
                  Submit Complaint
                </Button>
              </Form>
            </Card.Body>
          </Card>


          {/* Emergency Pickup Request */}
          <Card className="mb-4">
            <Card.Header>Emergency Garbage Pickup Request</Card.Header>
            <Card.Body>
              <Form onSubmit={handleEmergencyRequest}>
                <Form.Group className="mb-3" controlId="emergencyReason">
                  <Form.Label>Reason</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={emergencyReason}
                    onChange={(e) => setEmergencyReason(e.target.value)}
                    placeholder="e.g., Party, extra garbage, event"
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3" controlId="emergencyPreferredTime">
                  <Form.Label>Preferred Arrival Time (Optional)</Form.Label>
                  <Form.Control
                    type="text"
                    value={emergencyPreferredTime}
                    onChange={(e) => setEmergencyPreferredTime(e.target.value)}
                    placeholder="e.g., ASAP, by 5 PM"
                  />
                </Form.Group>
                <Button variant="danger" type="submit">
                  Submit Emergency Request
                </Button>
              </Form>
            </Card.Body>
          </Card>

          <Card className="mb-4">
            <Card.Header>Payment Plans</Card.Header>
            <Card.Body>
              <p>Choose your subscription plan:</p>
              <Button variant="success" className="me-2" onClick={() => handleSubscribe('monthly')}>
                Monthly Plan ($10/month)
              </Button>
              <Button variant="primary" onClick={() => handleSubscribe('yearly')}>
                Yearly Plan ($100/year)
              </Button>
            </Card.Body>
          </Card>

          <Card className="mb-4">
            <Card.Header>Invoices & Payment History</Card.Header>
            <Card.Body>
              <p>View your past invoices and payment records.</p>
              <Button variant="secondary">View History</Button>
            </Card.Body>
          </Card>

          <Card className="mb-4">
            <Card.Header>Complaint History</Card.Header>
            <Card.Body>
              <p>Track the status of your submitted complaints.</p>
              <Button variant="secondary">View Complaints</Button>
            </Card.Body>
          </Card>
        </Col>

        <Col md={4}>
          {/* Driver Details */}
          <Card className="mb-4">
            <Card.Header>Your Assigned Driver</Card.Header>
            <Card.Body>
              {assignedDriver ? (
                <ListGroup variant="flush">
                  <ListGroup.Item><strong>Name:</strong> {assignedDriver.name}</ListGroup.Item>
                  <ListGroup.Item><strong>Vehicle:</strong> {assignedDriver.vehicleNumber}</ListGroup.Item>
                  <ListGroup.Item><strong>Phone:</strong> {assignedDriver.phone}</ListGroup.Item>
                </ListGroup>
              ) : (
                <Alert variant="info">No driver assigned yet.</Alert>
              )}
            </Card.Body>
          </Card>

          

          {/* Resident Profile */}
          <Card className="mb-4">
            <Card.Header>My Profile</Card.Header>
            <Card.Body>
              {user ? (
                <ListGroup variant="flush">
                  <ListGroup.Item><strong>Name:</strong> {user.name}</ListGroup.Item>
                  <ListGroup.Item><strong>Email:</strong> {user.email}</ListGroup.Item>
                  <ListGroup.Item><strong>Role:</strong> {user.role}</ListGroup.Item>
                  {user.house && (
                    <>
                      <ListGroup.Item><strong>House No:</strong> {user.house.houseNo}</ListGroup.Item>
                      <ListGroup.Item><strong>Block:</strong> {user.house.block}</ListGroup.Item>
                      <ListGroup.Item><strong>Sector:</strong> {user.house.sector}</ListGroup.Item>
                      <ListGroup.Item><strong>Latitude:</strong> {user.house.location?.coordinates[1]}</ListGroup.Item>
                      <ListGroup.Item><strong>Longitude:</strong> {user.house.location?.coordinates[0]}</ListGroup.Item>
                    </>
                  )}
                  <ListGroup.Item><strong>Subscription Status:</strong> {user.isSubscribed ? 'Active' : 'Inactive'}</ListGroup.Item>
                </ListGroup>
              ) : (
                <Alert variant="info">Profile data not available.</Alert>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default ResidentDashboard;
