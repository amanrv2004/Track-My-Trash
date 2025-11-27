import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import MapComponent from '../components/MapComponent'; // Import MapComponent

const HomePage = () => {
  const [mapCenter, setMapCenter] = useState([20.5937, 78.9629]); // Default to India coordinates
  const [mapZoom, setMapZoom] = useState(5); // Default zoom for India

  useEffect(() => {
    // Attempt to get user's current location if not logged in
    // (We assume if you're on HomePage, you're likely not logged in,
    // though AuthContext check could be added if needed)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setMapCenter([position.coords.latitude, position.coords.longitude]);
          setMapZoom(13); // Zoom in closer for user's location
        },
        (error) => {
          console.error("Error getting user location:", error);
          // If error, map remains centered on India
        }
      );
    }
  }, []); // Run once on component mount

  return (
    <Container className="my-5">
      <Row className="justify-content-center text-center">
        <Col md={10}>
          <h1 className="display-4 mb-3">Welcome to Track My Trash!</h1>
          <p className="lead mb-4">Your Smart Waste Management System. Connecting residents, drivers, and admin for a cleaner city.</p>
          <div className="d-grid gap-2 d-md-flex justify-content-md-center mb-5">
            <Link to="/login" className="btn btn-primary btn-lg">Login</Link>
            <Link to="/register/resident" className="btn btn-outline-secondary btn-lg">Register as Resident</Link>
          </div>
        </Col>
      </Row>

      <Row className="justify-content-center mb-5">
        <Col md={10}>
          <Card>
            <Card.Body>
              <Card.Title className="text-center mb-3">Live Map Overview</Card.Title>
              <div style={{ height: '400px' }}>
                <MapComponent center={mapCenter} zoom={mapZoom} />
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="justify-content-center text-center">
        <Col md={10}>
          <h2>Key Features:</h2>
          <Row className="mt-4">
            <Col md={4}>
              <Card className="mb-3">
                <Card.Body>
                  <Card.Title>Real-time Tracking</Card.Title>
                  <Card.Text>Track your assigned driver live on the map.</Card.Text>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="mb-3">
                <Card.Body>
                  <Card.Title>Emergency Pickups</Card.Title>
                  <Card.Text>Request urgent pickups for special events.</Card.Text>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="mb-3">
                <Card.Body>
                  <Card.Title>Smart Management</Card.Title>
                  <Card.Text>Efficient routing and administration tools.</Card.Text>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>
    </Container>
  );
};

export default HomePage;