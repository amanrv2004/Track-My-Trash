import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';

const Footer = () => {
  return (
    <footer className="bg-dark text-white py-4 mt-auto fixed-bottom">
      <Container>
        <Row>
          <Col className="text-center">
            <p>&copy; {new Date().getFullYear()} Track My Trash. All rights reserved.</p>
          </Col>
          <Col className='text-center'>
            <p>Follow Us on : Instrgram  Facebook  X</p>
          </Col>
        </Row>
      </Container>
    </footer>
  );
};

export default Footer;