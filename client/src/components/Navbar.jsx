import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Navbar, Nav, Container, NavDropdown } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';

const AppNavbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Determine the dashboard path based on user role
  const getDashboardPath = () => {
    if (!user) return '/';
    switch (user.role) {
      case 'resident':
        return '/resident/dashboard';
      case 'driver':
        return '/driver/dashboard';
      case 'admin':
        return '/admin/dashboard';
      default:
        return '/';
    }
  };

  const dashboardPath = getDashboardPath();

  return (
    <Navbar bg="dark" variant="dark" expand="lg">
      <Container>
        <Navbar.Brand as={Link} to={dashboardPath}>Track My Trash</Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="ms-auto">
            {user ? (
              <NavDropdown title={user.name || user.email} id="username-nav-dropdown">
                {user.role === 'resident' && (
                  <NavDropdown.Item as={Link} to="/resident/dashboard">Dashboard</NavDropdown.Item>
                )}
                {user.role === 'driver' && (
                  <NavDropdown.Item as={Link} to="/driver/dashboard">Dashboard</NavDropdown.Item>
                )}
                {user.role === 'admin' && (
                  <>
                    <NavDropdown.Item as={Link} to="/admin/dashboard">Dashboard</NavDropdown.Item>
                    <NavDropdown.Item as={Link} to="/admin/assign-driver-to-house">Assign Driver to House</NavDropdown.Item>
                    <NavDropdown.Item as={Link} to="/admin/register-driver">Register Driver</NavDropdown.Item>
                    <NavDropdown.Item as={Link} to="/admin/user-management">User Management</NavDropdown.Item>  
                  </>
                )}
                <NavDropdown.Item onClick={handleLogout}>Logout</NavDropdown.Item>
              </NavDropdown>
            ) : (
              <>
                <Nav.Link as={Link} to="/login">Login</Nav.Link>
                <Nav.Link as={Link} to="/register/resident">Register</Nav.Link>
              </>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default AppNavbar;