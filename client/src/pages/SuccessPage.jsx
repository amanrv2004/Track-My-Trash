import React, { useEffect, useState } from 'react';
import { Container, Alert, Spinner } from 'react-bootstrap';
import { useLocation } from 'react-router-dom';
import axios from 'axios'; // Not directly used for session confirmation here, but common for other API calls

const SuccessPage = () => {
  const location = useLocation();
  const [message, setMessage] = useState('Processing your payment...');
  const [variant, setVariant] = useState('info');

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const sessionId = query.get('session_id');

    if (sessionId) {
      // In a real application, you might want to send this sessionId to your backend
      // to confirm the payment on the server-side as well, though Stripe webhooks
      // should ideally handle the fulfillment.
      // For this example, we'll just show success.
      setMessage('Payment successful! Your subscription is now active.');
      setVariant('success');
    } else {
      setMessage('Payment success page loaded without a session ID.');
      setVariant('warning');
    }
  }, [location]);

  return (
    <Container className="my-5 text-center">
      <Spinner animation="border" role="status" className="mb-3" />
      <Alert variant={variant}>
        {message}
      </Alert>
      <p>You can now return to your <a href="/resident/dashboard">dashboard</a>.</p>
    </Container>
  );
};

export default SuccessPage;