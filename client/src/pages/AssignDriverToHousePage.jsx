import React, { useState, useEffect } from 'react';
import { Container, Card, Form, Button, Alert, Table } from 'react-bootstrap';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AssignDriverToHousePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [allHouses, setAllHouses] = useState([]); // To store all houses with assignments
  const [drivers, setDrivers] = useState([]);
  const [selectedBlock, setSelectedBlock] = useState('');
  const [selectedSector, setSelectedSector] = useState('');
  const [assignDriverId, setAssignDriverId] = useState('');
  const [unassignBlock, setUnassignBlock] = useState(''); // New state for unassign form
  const [unassignSector, setUnassignSector] = useState(''); // New state for unassign form
  const [unassignSpecificDriverId, setUnassignSpecificDriverId] = useState(''); // New state for specific driver unassignment
  const [uniqueBlocks, setUniqueBlocks] = useState([]);
    const [uniqueSectors, setUniqueSectors] = useState([]);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);
  
    const fetchHousesAndDrivers = async () => {
      try {
        const config = {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        };
        // Fetch houses and populate assigned driver and resident
        const housesRes = await axios.get(`${import.meta.env.VITE_SERVER_URL}/api/houses/with-details`, config); // Assuming a new endpoint for houses with details
        setAllHouses(housesRes.data);
  
        // Extract unique blocks and sectors
        const blocks = [...new Set(housesRes.data.map(h => h.block))].sort();
        const sectors = [...new Set(housesRes.data.map(h => h.sector))].sort();
        setUniqueBlocks(['', ...blocks]); // Add empty option
        setUniqueSectors(['', ...sectors]); // Add empty option
  
        const usersRes = await axios.get(`${import.meta.env.VITE_SERVER_URL}/api/admin/users`, config);
        setDrivers(usersRes.data.filter(u => u.role === 'driver'));
      } catch (err) {
        setError(err.response?.data?.message || 'Error fetching houses or drivers.');
      }
    };
  
    useEffect(() => {
      if (user && user.token) {
        fetchHousesAndDrivers();
      }
    }, [user]);
  
    const handleAssignDriver = async (e) => {
      e.preventDefault();
      setError(null);
      setMessage(null);
  
      if (!selectedBlock && !selectedSector) {
        setError('Please select either a Block or a Sector to assign the driver.');
        return;
      }
  
      try {
        const config = {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.token}`,
          },
        };
        await axios.post(`${import.meta.env.VITE_SERVER_URL}/api/admin/assign-driver-to-area`, {
          block: selectedBlock || undefined, // Send undefined if not selected
          sector: selectedSector || undefined, // Send undefined if not selected
          driverId: assignDriverId
        }, config);
        setMessage('Driver assigned successfully to the selected area!');
        setSelectedBlock('');
        setSelectedSector('');
        setAssignDriverId('');
        fetchHousesAndDrivers(); // Re-fetch data to update the list
      } catch (err) {
        setError(err.response?.data?.message || 'Error assigning driver.');
      }
    };
  
    const handleUnassignDriver = async (houseId) => {
      if (window.confirm('Are you sure you want to unassign the driver from this house?')) {
        try {
          const config = {
            headers: {
              Authorization: `Bearer ${user.token}`,
            },
          };
          await axios.put(`${import.meta.env.VITE_SERVER_URL}/api/admin/houses/${houseId}/unassign-driver`, {}, config);
          setMessage('Driver unassigned successfully!');
          fetchHousesAndDrivers(); // Re-fetch data to update the list
        } catch (err) {
          setError(err.response?.data?.message || 'Error unassigning driver.');
        }
      }
    };
  
      const handleUnassignDriverFromArea = async (e) => {
        e.preventDefault();
        setError(null);
        setMessage(null);
    
        if (!unassignBlock && !unassignSector) {
          setError('Please select either a Block or a Sector to unassign drivers from.');
          return;
        }
    
        try {
          const config = {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${user.token}`,
            },
          };
          await axios.put(`${import.meta.env.VITE_SERVER_URL}/api/admin/unassign-driver-from-area`, {
            block: unassignBlock || undefined,
            sector: unassignSector || undefined,
            driverId: unassignSpecificDriverId || undefined, // Include specific driver ID
          }, config);
          setMessage('Drivers unassigned successfully from the selected area!');
          setUnassignBlock('');
          setUnassignSector('');
          setUnassignSpecificDriverId(''); // Clear specific driver selection
          fetchHousesAndDrivers();
        } catch (err) {
          setError(err.response?.data?.message || 'Error unassigning drivers from area.');
        }
      };
  return (
    <Container className="my-5">
      <h2>Driver Assignment Management</h2>
      {message && <Alert variant="success">{message}</Alert>}
      {error && <Alert variant="danger">{error}</Alert>}

      <Card className="mb-4">
        <Card.Header>Assign Driver to Block/Sector</Card.Header>
        <Card.Body>
          <Form onSubmit={handleAssignDriver}>
            <Form.Group className="mb-3">
              <Form.Label>Select Block (Optional)</Form.Label>
              <Form.Control as="select" value={selectedBlock} onChange={(e) => setSelectedBlock(e.target.value)}>
                {uniqueBlocks.map(block => (
                  <option key={block || 'all-blocks'} value={block}>{block || 'All Blocks'}</option>
                ))}
              </Form.Control>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Select Sector (Optional)</Form.Label>
              <Form.Control as="select" value={selectedSector} onChange={(e) => setSelectedSector(e.target.value)}>
                {uniqueSectors.map(sector => (
                  <option key={sector || 'all-sectors'} value={sector}>{sector || 'All Sectors'}</option>
                ))}
              </Form.Control>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Select Driver</Form.Label>
              <Form.Control as="select" value={assignDriverId} onChange={(e) => setAssignDriverId(e.target.value)} required>
                <option value="">Choose Driver...</option>
                {drivers.map(d => (
                  <option key={d._id} value={d._id}>
                    {d.name} ({d.email})
                  </option>
                ))}
              </Form.Control>
            </Form.Group>
            <Button type="submit" variant="primary">Assign Driver to Area</Button>
          </Form>
        </Card.Body>
      </Card>

      <Card className="mb-4">
        <Card.Header>Unassign Driver from Block/Sector</Card.Header>
        <Card.Body>
          <Form onSubmit={handleUnassignDriverFromArea}>
            <Form.Group className="mb-3">
              <Form.Label>Select Block (Optional)</Form.Label>
              <Form.Control as="select" value={unassignBlock} onChange={(e) => setUnassignBlock(e.target.value)}>
                {uniqueBlocks.map(block => (
                  <option key={block || 'all-blocks-unassign'} value={block}>{block || 'All Blocks'}</option>
                ))}
              </Form.Control>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Select Sector (Optional)</Form.Label>
              <Form.Control as="select" value={unassignSector} onChange={(e) => setUnassignSector(e.target.value)}>
                {uniqueSectors.map(sector => (
                  <option key={sector || 'all-sectors-unassign'} value={sector}>{sector || 'All Sectors'}</option>
                ))}
              </Form.Control>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Select Specific Driver (Optional)</Form.Label>
              <Form.Control as="select" value={unassignSpecificDriverId} onChange={(e) => setUnassignSpecificDriverId(e.target.value)}>
                <option value="">Any Driver...</option>
                {drivers.map(d => (
                  <option key={d._id} value={d._id}>
                    {d.name} ({d.email})
                  </option>
                ))}
              </Form.Control>
            </Form.Group>
            <Button type="submit" variant="warning">Unassign Driver from Area</Button>
          </Form>
        </Card.Body>
      </Card>



      <Card>
        <Card.Header>Assigned Houses Overview</Card.Header>
        <Card.Body>
          <Table striped bordered hover responsive>
            <thead>
              <tr>
                <th>House No.</th>
                <th>Block</th>
                <th>Sector</th>
                <th>Resident</th>
                <th>Assigned Driver</th>
                <th>Assignment Expiry</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {allHouses.map(house => (
                <tr key={house._id}>
                  <td>{house.houseNo}</td>
                  <td>{house.block}</td>
                  <td>{house.sector}</td>
                  <td>{house.resident?.name || 'N/A'}</td>
                  <td>{house.assignedDriver?.name || 'N/A'}</td>
                  <td>{house.assignmentExpiryDate ? new Date(house.assignmentExpiryDate).toLocaleDateString() : 'N/A'}</td>
                  <td>
                    {house.assignedDriver && (
                      <Button variant="danger" size="sm" onClick={() => handleUnassignDriver(house._id)}>Unassign Driver</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default AssignDriverToHousePage;