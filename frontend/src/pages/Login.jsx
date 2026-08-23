import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login(email, password);
      navigate(user.role === 'therapist' ? '/therapist' : '/patient');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (email) => {
    setEmail(email);
    setPassword('password123');
    setError('');
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">
          <h1>Wysa</h1>
          <p>Appointment Booking System</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '12px', textAlign: 'center' }}>
            Demo Credentials
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => fillCredentials('therapist@wysa.com')}>
              🩺 Dr. Sarah Johnson (Therapist)
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => fillCredentials('patient1@wysa.com')}>
              👤 Alice Smith (Patient)
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => fillCredentials('patient2@wysa.com')}>
              👤 Bob Wilson (Patient)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
