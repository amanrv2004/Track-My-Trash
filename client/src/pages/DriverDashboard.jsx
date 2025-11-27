import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Card, Button, ListGroup, Alert, Modal } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import io from 'socket.io-client';
import MapComponent, { getCustomIcons } from '../components/MapComponent';
import L from 'leaflet';

const DriverDashboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [currentLocation, setCurrentLocation] = useState(null);
  const [route, setRoute] = useState(null);
  const [emergencyRequests, setEmergencyRequests] = useState([]);
  const [selectedResident, setSelectedResident] = useState(null);
  const [showResidentModal, setShowResidentModal] = useState(false);
  const [error, setError] = useState(null);
  const [alertMessage, setAlertMessage] = useState(null);
  const [status, setStatus] = useState('Connecting...');
  // Initialize isSendingLiveLocation from localStorage
  const [isSendingLiveLocation, setIsSendingLiveLocation] = useState(() => {
    const saved = localStorage.getItem('isSendingLiveLocation');
    return saved ? JSON.parse(saved) : false;
  });
  const [notifications, setNotifications] = useState([]); // New state for notifications
  const [initialMapCenter, setInitialMapCenter] = useState(null); // New state for fixed map center
  const [initialMapZoom, setInitialMapZoom] = useState(null); // New state for fixed map zoom

  const locationIntervalRef = useRef(null);
  const socket = useRef(null);

  // Effect to save isSendingLiveLocation to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('isSendingLiveLocation', JSON.stringify(isSendingLiveLocation));
  }, [isSendingLiveLocation]);

  // Effect for Socket.io connection status
  useEffect(() => {
    if (socket.current) {
      socket.current.on('connect', () => {
        setStatus('Connected');
        console.log('Socket.io connected.');
      });

      socket.current.on('disconnect', () => {
        setStatus('Disconnected. Reconnecting...');
        console.log('Socket.io disconnected.');
      });
    }
  }, [socket.current]);

  // Main effect for driver dashboard functionalities
  useEffect(() => {
    console.log('DriverDashboard useEffect triggered.');
    console.log('User:', user, 'Loading:', loading);

    if (!loading && (!user || user.role !== 'driver')) {
      console.log('Redirecting to login: User not authenticated or not a driver.');
      navigate('/login');
      return;
    }

    if (user && user.role === 'driver') {
      console.log('User is driver, initializing dashboard features.');
      // Initialize Socket.io if not already
      if (!socket.current) {
        socket.current = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:5002');
        socket.current.emit('join', user._id); // Join room for driver's own updates
        console.log('Socket.io initialized and joined room:', user._id);
      }

      socket.current.on('emergencyRequest', (request) => {
        setEmergencyRequests((prev) => [...prev, request]);
        setAlertMessage(`New Emergency Request from ${request.resident.name}!`);
        setNotifications((prevNotifications) => [
          ...prevNotifications,
          { message: `New Emergency Request from ${request.resident.name}!`, timestamp: new Date() },
        ]);
        console.log('New emergency request received:', request);
      });

      // Listen for driver unassigned event
      socket.current.on('driverUnassigned', (data) => {
        setAlertMessage(data.message);
        setNotifications((prevNotifications) => [
          ...prevNotifications,
          { message: data.message, timestamp: new Date() },
        ]);
        console.log('Driver Unassigned Alert:', data.message);
        // Optionally, re-fetch the route if an unassignment could affect it
        // fetchRoute();
      });

      // Fetch assigned route
      const fetchRoute = async () => {
        try {
          console.log('Fetching assigned route...');
          const { data } = await axios.get(`${import.meta.env.VITE_SERVER_URL}/api/driver/route`);
          setRoute(data);
          console.log('Assigned route fetched:', data);
        } catch (err) {
          console.error('Error fetching route:', err);
          setError(err.response?.data?.message || 'Failed to fetch assigned route.');
        }
      };
      fetchRoute();
    }

    return () => {
      console.log('DriverDashboard cleanup function running.');
      // Disconnect socket only if it was initialized in this effect
      if (socket.current) {
        socket.current.disconnect();
        socket.current = null; // Clear the ref
        console.log('Socket.io disconnected.');
      }
    };
  }, [user, loading, navigate]); // Dependencies for the main effect

  // Effect for handling live location sending
  useEffect(() => {
    if (isSendingLiveLocation && user) {
      if (!navigator.geolocation) {
        setError('Geolocation is not supported by your browser.');
        return;
      }

      console.log('Starting live location sending...');
      locationIntervalRef.current = setInterval(() => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setCurrentLocation({ latitude, longitude });

            // Set initial map center and zoom only once
            if (!initialMapCenter || !initialMapZoom) {
              setInitialMapCenter([latitude, longitude]);
              setInitialMapZoom(15); // Fixed zoom level
            }

            console.log('GPS Location updated:', { latitude, longitude });
            // Send location to backend via API
            axios.post(`${import.meta.env.VITE_SERVER_URL}/api/driver/location`, { latitude, longitude })
              .then(() => console.log('Location sent to backend successfully.'))
              .catch(err => {
                console.error('Error sending location to backend:', err);
                setError('Failed to send location updates.');
              });
          },
          (err) => {
            console.error('Error getting GPS location:', err);
            setError('Unable to get GPS location. Real-time tracking may be affected.');
          },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 2000 } // timeout set to 2 seconds
        );
      }, 2000); // Send location every 2 seconds
    } else {
      console.log('Stopping live location sending.');
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }
      setCurrentLocation(null); // Clear current location
      setInitialMapCenter(null); // Clear initial map center
      setInitialMapZoom(null); // Clear initial map zoom

      // Inform backend that location sharing has stopped
      axios.post(`${import.meta.env.VITE_SERVER_URL}/api/driver/stop-location`)
        .then(() => console.log('Backend informed: Location sharing stopped.'))
        .catch(err => console.error('Error informing backend about stopped location sharing:', err));
    }

    return () => {
      console.log('Live location sending cleanup.');
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }
    };
  }, [isSendingLiveLocation, user, initialMapCenter, initialMapZoom]); // Re-run when isSendingLiveLocation, user, or initialMapCenter/Zoom changes

  const handleMarkPickup = async (houseId, status) => {
    try {
      await axios.put(`${import.meta.env.VITE_SERVER_URL}/api/driver/pickup/${houseId}`, { status });
      setAlertMessage(`House ${houseId} marked as ${status}.`);
      setRoute(prevRoute => {
        if (!prevRoute) return prevRoute;
        // Filter out the house that was just marked as picked or not_picked
        const updatedHouses = prevRoute.houses.filter(h => h.house._id.toString() !== houseId);
        return { ...prevRoute, houses: updatedHouses };
      });
      setRoute(prevRoute => {
        if (!prevRoute) return prevRoute;
        // Filter out the house that was just marked as picked or not_picked
        const updatedHouses = prevRoute.houses.filter(h => h.house._id !== houseId);
        return { ...prevRoute, houses: updatedHouses };
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update pickup status.');
    }
  };

  const handleViewResidentDetails = (resident) => {
    setSelectedResident(resident);
    setShowResidentModal(true);
  };

  const handleCloseResidentModal = () => {
    setShowResidentModal(false);
    setSelectedResident(null);
  };

  if (loading) {
    return <Container className="my-5 text-center">Loading...</Container>;
  }

  return (
    <Container className="my-5">
      <Row>
        <Col md={8}>
          <h2>Driver Dashboard</h2>
          {alertMessage && <Alert variant="info">{alertMessage}</Alert>}
          {error && <Alert variant="danger">{error}</Alert>}
          <Alert variant={status === 'Connected' ? 'success' : 'warning'}>{status}</Alert>

          {/* Live Location Controls */}
          <Card className="mb-4">
            <Card.Header>Live Location Sharing</Card.Header>
            <Card.Body>
              {isSendingLiveLocation ? (
                <>
                  <p className="text-success">Live location is being shared.</p>
                  <Button variant="warning" onClick={() => setIsSendingLiveLocation(false)}>Stop Sharing Location</Button>
                </>
              ) : (
                <>
                  <p className="text-muted">Live location sharing is currently off.</p>
                  <Button variant="primary" onClick={() => setIsSendingLiveLocation(true)}>Start Sharing Location</Button>
                </>
              )}
              {currentLocation && (
                <p className="mt-3">
                  Last recorded: Lat: {currentLocation.latitude.toFixed(5)}, Lng: {currentLocation.longitude.toFixed(5)}
                </p>
              )}
            </Card.Body>
          </Card>

          {/* Current GPS Location Map */}
          <Card className="mb-4">
            <Card.Header>Your Current Location</Card.Header>
            <Card.Body style={{ height: '300px' }}>
              {(() => {
                const customIcons = L ? getCustomIcons(L) : {};
                const driverIcon = customIcons.assignedDriverIcon;
                return (
                  <MapComponent
                    center={initialMapCenter || [20.5937, 78.9629]} // Use initialMapCenter or default
                    zoom={initialMapZoom || 5} // Use initialMapZoom or default
                    markers={currentLocation ? [{ key: "driver-location", position: [currentLocation.latitude, currentLocation.longitude], popupText: `You are here`, icon: driverIcon }] : []}
                  />
                );
              })()}
              {!initialMapCenter && ( // Check initialMapCenter to determine if location has been set at least once
                <div className="d-flex justify-content-center align-items-center h-100">
                  <p>Turn on live location sharing to see your position on the map.</p>
                </div>
              )}
            </Card.Body>
          </Card>

          {/* Assigned Route */}
          <Card className="mb-4">
            <Card.Header>Your Daily Route</Card.Header>
            <Card.Body>
              {route ? (
                <div>
                  <h4>Status: {route.status}</h4>
                  <h5>Houses to Pick Up:</h5>
                  <ListGroup>
                    {route.houses.map((houseEntry) => (
                      houseEntry.house && (
                        <ListGroup.Item key={houseEntry.house._id} className="d-flex justify-content-between align-items-center">
                          <div>
                            {houseEntry.house.houseNo}, {houseEntry.house.block}, {houseEntry.house.sector}
                            <Button variant="link" size="sm" onClick={() => handleViewResidentDetails(houseEntry.house.resident)}>
                              View Resident
                            </Button>
                          </div>
                          <div>
                            <Button variant="success" size="sm" className="me-2" onClick={() => handleMarkPickup(houseEntry.house._id, 'picked')}>Picked</Button>
                            <Button variant="danger" size="sm" onClick={() => handleMarkPickup(houseEntry.house._id, 'not_picked')}>Not Picked</Button>
                          </div>
                        </ListGroup.Item>
                      )
                    ))}
                  </ListGroup>
                </div>
              ) : (
                <Alert variant="info">No route assigned for today or loading...</Alert>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col md={4}>
          {/* Emergency Pickup Requests */}
          <Card className="mb-4">
            <Card.Header>Emergency Requests</Card.Header>
            <Card.Body>
              {emergencyRequests.length > 0 ? (
                <ListGroup>
                  {emergencyRequests.map((request, index) => (
                    <ListGroup.Item key={index}>
                      <strong>From:</strong> {request.resident.name}<br />
                      <strong>Reason:</strong> {request.reason}<br />
                      <strong>Time:</strong> {request.preferredTime || 'ASAP'}
                      {/* Add buttons to accept/decline or view details */}
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              ) : (
                <Alert variant="info">No new emergency requests.</Alert>
              )}
            </Card.Body>
          </Card>

          {/* Daily Route Summary */}
          <Card className="mb-4">
            <Card.Header>Route Summary</Card.Header>
            <Card.Body>
              <p>Total Houses: {route?.houses.length || 0}</p>
              <p>Pending Pickups: {route?.houses.filter(h => h.pickupStatus !== 'picked').length || 0}</p>
            </Card.Body>
          </Card>

          {/* Notifications */}
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
        </Col>
      </Row>

      {/* Resident Details Modal */}
      <Modal show={showResidentModal} onHide={handleCloseResidentModal}>
        <Modal.Header closeButton>
          <Modal.Title>Resident Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedResident && (
            <ListGroup variant="flush">
              <ListGroup.Item><strong>Name:</strong> {selectedResident.name}</ListGroup.Item>
              <ListGroup.Item><strong>Email:</strong> {selectedResident.email}</ListGroup.Item>
              {/* Add more resident details if available and needed */}
            </ListGroup>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseResidentModal}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default DriverDashboard;