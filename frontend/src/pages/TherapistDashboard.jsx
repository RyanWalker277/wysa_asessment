import { useState, useEffect } from 'react';
import api from '../api/client';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const STATUS_OPTIONS = ['scheduled', 'completed', 'no_show', 'cancelled'];

export default function TherapistDashboard() {
  const [activeTab, setActiveTab] = useState('appointments');
  const [appointments, setAppointments] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('upcoming');
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [newSlot, setNewSlot] = useState({ dayOfWeek: 1, startTime: '', endTime: '' });
  const [scheduleMsg, setScheduleMsg] = useState('');

  useEffect(() => {
    fetchAppointments();
    fetchSchedule();
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

  const fetchSchedule = async () => {
    try {
      const { data } = await api.get('/schedules');
      setSchedule(data.schedules);
    } catch (err) {
      console.error('Failed to fetch schedule:', err);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/appointments/${id}/status`, { status });
      fetchAppointments();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update status');
    }
  };

  const addSlot = () => {
    if (!newSlot.startTime || !newSlot.endTime) {
      alert('Please enter start and end times');
      return;
    }
    setSchedule([...schedule, { ...newSlot, id: `new-${Date.now()}` }]);
    setNewSlot({ dayOfWeek: newSlot.dayOfWeek, startTime: '', endTime: '' });
  };

  const removeSlot = (index) => {
    setSchedule(schedule.filter((_, i) => i !== index));
  };

  const saveSchedule = async () => {
    setScheduleLoading(true);
    setScheduleMsg('');
    try {
      const { data } = await api.put('/schedules', {
        slots: schedule.map((s) => ({
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
        })),
      });
      setSchedule(data.schedules);
      setScheduleMsg('Schedule saved! Existing bookings are not affected.');
    } catch (err) {
      setScheduleMsg(err.response?.data?.error || 'Failed to save schedule');
    } finally {
      setScheduleLoading(false);
    }
  };

  const now = new Date();
  const filtered = appointments.filter((a) => {
    if (filter === 'upcoming') return new Date(a.startTime) >= now && a.status !== 'cancelled';
    if (filter === 'today') {
      const aptDate = new Date(a.startTime);
      return aptDate.toDateString() === now.toDateString() && a.status !== 'cancelled';
    }
    if (filter === 'past') return new Date(a.startTime) < now;
    return true;
  });

  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const formatTime = (d) => new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const isInWindow = (apt) => {
    const start = new Date(apt.startTime);
    const end = new Date(apt.endTime);
    return now >= start && now <= end;
  };

  // Group schedule by day
  const scheduleByDay = {};
  schedule.forEach((s, i) => {
    if (!scheduleByDay[s.dayOfWeek]) scheduleByDay[s.dayOfWeek] = [];
    scheduleByDay[s.dayOfWeek].push({ ...s, originalIndex: i });
  });

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Therapist Dashboard</h1>
        <p className="page-subtitle">Manage your appointments and schedule</p>
      </div>

      {/* Main Tabs */}
      <div className="tabs" style={{ maxWidth: '400px' }}>
        <button className={`tab ${activeTab === 'appointments' ? 'active' : ''}`} onClick={() => setActiveTab('appointments')}>
          Appointments
        </button>
        <button className={`tab ${activeTab === 'schedule' ? 'active' : ''}`} onClick={() => setActiveTab('schedule')}>
          Schedule
        </button>
      </div>

      {/* Appointments Tab */}
      {activeTab === 'appointments' && (
        <div>
          <div className="tabs">
            <button className={`tab ${filter === 'today' ? 'active' : ''}`} onClick={() => setFilter('today')}>Today</button>
            <button className={`tab ${filter === 'upcoming' ? 'active' : ''}`} onClick={() => setFilter('upcoming')}>Upcoming</button>
            <button className={`tab ${filter === 'past' ? 'active' : ''}`} onClick={() => setFilter('past')}>Past</button>
            <button className={`tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
          </div>

          {loading ? (
            <div className="loading"><div className="spinner"></div></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <p>No {filter} appointments</p>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'auto' }}>
              <table className="appointment-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Patient</th>
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
                      <td>{apt.patient.name}</td>
                      <td><span className={`badge badge-${apt.status}`}>{apt.status}</span></td>
                      <td>
                        {apt.recurrence ? (
                          <span className="badge badge-recurring">🔁 {apt.recurrence.frequency}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>One-time</span>
                        )}
                      </td>
                      <td className="actions">
                        {apt.status === 'scheduled' && (isInWindow(apt) || new Date(apt.endTime) < now) && (
                          <>
                            <button className="btn btn-success btn-sm" onClick={() => updateStatus(apt.id, 'completed')}>
                              Complete
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => updateStatus(apt.id, 'no_show')}>
                              No-show
                            </button>
                          </>
                        )}
                        {apt.status === 'scheduled' && (
                          <button className="btn btn-danger btn-sm" onClick={() => updateStatus(apt.id, 'cancelled')}>
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Schedule Tab */}
      {activeTab === 'schedule' && (
        <div>
          {scheduleMsg && (
            <div className={`alert ${scheduleMsg.includes('Failed') ? 'alert-error' : 'alert-success'}`}>
              {scheduleMsg}
            </div>
          )}

          {/* Existing Schedule Grouped by Day */}
          {[1, 2, 3, 4, 5, 6, 0].map((day) => {
            const daySlots = scheduleByDay[day];
            if (!daySlots || daySlots.length === 0) return null;
            return (
              <div key={day} className="schedule-day">
                <div className="schedule-day-header">{DAYS[day]}</div>
                {daySlots.map((s) => (
                  <div key={s.originalIndex} className="schedule-slot-row">
                    <span style={{ fontSize: '0.9rem', minWidth: '120px' }}>
                      {s.startTime} – {s.endTime}
                    </span>
                    <button className="btn btn-danger btn-sm" onClick={() => removeSlot(s.originalIndex)}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            );
          })}

          {schedule.length === 0 && (
            <div className="empty-state" style={{ padding: '24px' }}>
              <p>No schedule slots defined</p>
            </div>
          )}

          {/* Add New Slot */}
          <div className="card" style={{ marginTop: '24px' }}>
            <h3 className="card-title" style={{ marginBottom: '16px' }}>Add Slot</h3>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Day</label>
                <select
                  className="form-select"
                  value={newSlot.dayOfWeek}
                  onChange={(e) => setNewSlot({ ...newSlot, dayOfWeek: parseInt(e.target.value) })}
                >
                  {DAYS.map((d, i) => (
                    <option key={i} value={i}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Start</label>
                <input
                  type="time"
                  className="form-input"
                  value={newSlot.startTime}
                  onChange={(e) => setNewSlot({ ...newSlot, startTime: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">End</label>
                <input
                  type="time"
                  className="form-input"
                  value={newSlot.endTime}
                  onChange={(e) => setNewSlot({ ...newSlot, endTime: e.target.value })}
                />
              </div>
              <button className="btn btn-primary" onClick={addSlot}>Add</button>
            </div>
          </div>

          {/* Save Button */}
          <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
            <button className="btn btn-primary btn-lg" onClick={saveSchedule} disabled={scheduleLoading}>
              {scheduleLoading ? 'Saving...' : 'Save Schedule'}
            </button>
            <button className="btn btn-secondary" onClick={fetchSchedule}>
              Reset
            </button>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '8px' }}>
            ⓘ Updating your schedule does not affect any existing bookings.
          </p>
        </div>
      )}
    </div>
  );
}
