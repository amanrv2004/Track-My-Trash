import React from 'react';
import { Container, Alert } from 'react-bootstrap';
import { Link } from 'react-router-dom';

const CancelPage = () => {
  return (
    <Container className="my-5 text-center">
      <Alert variant="danger">
        <h4>Payment Cancelled!</h4>
        <p>Your payment process was interrupted or cancelled.</p>
        <p>You can try again from your <Link to="/resident/dashboard">dashboard</Link>.</p>
      </Alert>
    </Container>
  );
};

export default CancelPage;