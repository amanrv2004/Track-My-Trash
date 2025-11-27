import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ResidentRegisterPage from './pages/ResidentRegisterPage.jsx';
import ResidentDashboard from './pages/ResidentDashboard.jsx';
import DriverDashboard from './pages/DriverDashboard.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import SuccessPage from './pages/SuccessPage.jsx';
import CancelPage from './pages/CancelPage.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import AppNavbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';

import ProtectedRoute from './components/ProtectedRoute.jsx';

import RegisterDriverPage from './pages/RegisterDriverPage.jsx';
import AssignDriverToHousePage from './pages/AssignDriverToHousePage.jsx';
import UserManagementPage from './pages/UserManagementPage.jsx';

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppNavbar />
        <main className="py-3">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register/resident" element={<ResidentRegisterPage />} />
            <Route path="/payment/success" element={<SuccessPage />} />
            <Route path="/payment/cancel" element={<CancelPage />} />
            {/* Protected Routes */}
            <Route element={<ProtectedRoute allowedRoles={['resident']} />}>
              <Route path="/resident/dashboard" element={<ResidentDashboard />} />
            </Route>
            <Route element={<ProtectedRoute allowedRoles={['driver']} />}>
              <Route path="/driver/dashboard" element={<DriverDashboard />} />
            </Route>
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/user-management" element={<UserManagementPage />} />
              <Route path="/admin/register-driver" element={<RegisterDriverPage />} />
              <Route path="/admin/assign-driver-to-house" element={<AssignDriverToHousePage />} />
            </Route>
            {/* Add more routes as needed */}
          </Routes>
        </main>
        <Footer />
      </AuthProvider>
    </Router>
  );
}

export default App;
