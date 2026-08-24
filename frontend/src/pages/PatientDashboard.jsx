import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

export default function PatientDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('upcoming');

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      const { data } = await api.get('/appointments');
      setAppointments(data.appointments);
    } catch (err) {
      console.error('Failed to fetch appointments:', err);
    } finally {
      setLoading(false);
    }
  };

  const cancelAppointment = async (id) => {
    if (!confirm('Cancel this appointment?')) return;
    try {
      await api.patch(`/appointments/${id}/cancel`);
      fetchAppointments();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to cancel');
    }
  };

  const cancelSeries = async (recurrenceId) => {
    if (!confirm('Cancel the entire recurring series? All future appointments will be cancelled.')) return;
    try {
      await api.patch(`/appointments/recurrences/${recurrenceId}/cancel`);
      fetchAppointments();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to cancel series');
    }
  };

  const now = new Date();
  const filtered = appointments.filter((a) => {
    if (filter === 'upcoming') {
      return new Date(a.startTime) >= now && a.status !== 'cancelled';
    }
    if (filter === 'past') {
      return new Date(a.startTime) < now;
    }
    if (filter === 'cancelled') {
      return a.status === 'cancelled';
    }
    return true;
  });

  const formatDate = (d) => {
    return new Date(d).toLocaleDateString('en-US', {
      timeZone: 'UTC',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (d) => {
    return new Date(d).toLocaleTimeString('en-US', {
      timeZone: 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">My Appointments</h1>
          <p className="page-subtitle">View and manage your therapy sessions</p>
        </div>
        <Link to="/patient/book" className="btn btn-primary">
          + Book Appointment
        </Link>
      </div>

      <div className="tabs">
        <button className={`tab ${filter === 'upcoming' ? 'active' : ''}`} onClick={() => setFilter('upcoming')}>
          Upcoming
        </button>
        <button className={`tab ${filter === 'past' ? 'active' : ''}`} onClick={() => setFilter('past')}>
          Past
        </button>
        <button className={`tab ${filter === 'cancelled' ? 'active' : ''}`} onClick={() => setFilter('cancelled')}>
          Cancelled
        </button>
        <button className={`tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          All
        </button>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner"></div></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📅</div>
          <p>No {filter} appointments found</p>
          {filter === 'upcoming' && (
            <Link to="/patient/book" className="btn btn-primary" style={{ marginTop: '16px' }}>
              Book Your First Appointment
            </Link>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table className="appointment-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Therapist</th>
                <th>Status</th>
                <th>Type</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((apt) => (
                <tr key={apt.id}>
                  <td>{formatDate(apt.startTime)}</td>
                  <td>{formatTime(apt.startTime)} – {formatTime(apt.endTime)}</td>
                  <td>{apt.therapist.name}</td>
                  <td><span className={`badge badge-${apt.status}`}>{apt.status}</span></td>
                  <td>
                    {apt.recurrence ? (
                      <span className="badge badge-recurring">
                        🔁 {apt.recurrence.frequency}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>One-time</span>
                    )}
                  </td>
                  <td className="actions">
                    {apt.status === 'scheduled' && new Date(apt.startTime) > now && (
                      <>
                        <button className="btn btn-danger btn-sm" onClick={() => cancelAppointment(apt.id)}>
                          Cancel
                        </button>
                        {apt.recurrence && apt.recurrence.status === 'active' && (
                          <button className="btn btn-danger btn-sm" onClick={() => cancelSeries(apt.recurrence.id)}>
                            Cancel Series
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
