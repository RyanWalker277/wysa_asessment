import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="navbar">
      <Link to={user.role === 'therapist' ? '/therapist' : '/patient'} className="navbar-brand">
        <span>Wysa</span> Appointments
      </Link>
      <div className="navbar-info">
        <span className="navbar-role">{user.role}</span>
        <span className="navbar-user">{user.name}</span>
        <button className="btn btn-secondary btn-sm" onClick={logout}>
          Logout
        </button>
      </div>
    </nav>
  );
}
