import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from './Navbar';

export default function ProtectedRoute({ children, role }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (role && user.role !== role) {
    return <Navigate to={user.role === 'therapist' ? '/therapist' : '/patient'} />;
  }

  return (
    <div className="app-layout">
      <Navbar />
      <main className="page-container">
        {children}
      </main>
    </div>
  );
}
