import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import PatientDashboard from './pages/PatientDashboard';
import BookAppointment from './pages/BookAppointment';
import TherapistDashboard from './pages/TherapistDashboard';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={user.role === 'therapist' ? '/therapist' : '/patient'} /> : <Login />} />
      <Route path="/patient" element={<ProtectedRoute role="patient"><PatientDashboard /></ProtectedRoute>} />
      <Route path="/patient/book" element={<ProtectedRoute role="patient"><BookAppointment /></ProtectedRoute>} />
      <Route path="/therapist" element={<ProtectedRoute role="therapist"><TherapistDashboard /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to={user ? (user.role === 'therapist' ? '/therapist' : '/patient') : '/login'} />} />
    </Routes>
  );
}
