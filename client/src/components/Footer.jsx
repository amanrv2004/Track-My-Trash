import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';

const Footer = () => {
  return (
    <footer className="bg-dark text-white py-3 mt-auto custom-footer">
      <Container>
        <Row>
          <Col className="text-center">
            <p>&copy; {new Date().getFullYear()} Track My Trash. All rights reserved.</p>
            </br>
          <p>Aman Raj Verma </p>
          </Col>
        </Row>
      </Container>
    </footer>
  );
};

export default Footer;
