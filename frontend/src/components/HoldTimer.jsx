import { useState, useEffect, useRef } from 'react';
import api from '../api/client';

const FREQUENCIES = [
  { value: '', label: 'One-time (no recurrence)' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export default function HoldTimer({ holdData, onExpired, onConfirmed }) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [frequency, setFrequency] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const intervalRef = useRef(null);

  useEffect(() => {
    const updateTimer = () => {
      const expiresAt = new Date(holdData.holdExpiresAt).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));
      setSecondsLeft(remaining);

      if (remaining <= 0) {
        clearInterval(intervalRef.current);
        onExpired();
      }
    };

    updateTimer();
    intervalRef.current = setInterval(updateTimer, 1000);

    return () => clearInterval(intervalRef.current);
  }, [holdData.holdExpiresAt, onExpired]);

  const handleConfirm = async () => {
    setError('');
    setConfirming(true);

    try {
      const body = {
        appointmentId: holdData.appointment.id,
        idempotencyKey: `${holdData.appointment.patientId}:${holdData.appointment.startTime}:${Date.now()}`,
      };

      if (frequency) {
        body.recurrence = { frequency };
      }

      await api.post('/appointments/confirm', body);
      setSuccess('Appointment confirmed!');
      clearInterval(intervalRef.current);
      setTimeout(onConfirmed, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to confirm');
      setConfirming(false);
    }
  };

  const formatSlotTime = () => {
    const start = new Date(holdData.appointment.startTime);
    const end = new Date(holdData.appointment.endTime);
    const dateStr = start.toLocaleDateString('en-US', {
      timeZone: 'UTC',
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    const startStr = start.toLocaleTimeString('en-US', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: true });
    const endStr = end.toLocaleTimeString('en-US', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: true });
    return { dateStr, timeStr: `${startStr} – ${endStr}` };
  };

  const { dateStr, timeStr } = formatSlotTime();

  if (success) {
    return (
      <div className="hold-timer-container" style={{ borderColor: 'var(--success)' }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>✅</div>
        <h2 style={{ color: 'var(--success)', marginBottom: '8px' }}>Appointment Confirmed!</h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          {dateStr} • {timeStr}
        </p>
        {frequency && (
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
            Recurring: <strong>{frequency}</strong>
          </p>
        )}
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '16px' }}>
          Redirecting to dashboard...
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="hold-timer-container">
        <h2 style={{ marginBottom: '8px' }}>Slot Held</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>
          {holdData.therapistName || 'Therapist'}
        </p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          {dateStr} • {timeStr}
        </p>

        <div className={`hold-timer-value ${secondsLeft <= 15 ? 'expiring' : ''}`}>
          0:{String(secondsLeft).padStart(2, '0')}
        </div>
        <p className="hold-timer-label">Time remaining to confirm</p>

        {error && <div className="alert alert-error" style={{ marginTop: '16px' }}>{error}</div>}

        {/* Recurrence Selector */}
        <div style={{ marginTop: '24px', marginBottom: '16px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '12px' }}>
            Booking type:
          </p>
          <div className="recurrence-options">
            {FREQUENCIES.map((f) => (
              <button
                key={f.value}
                className={`recurrence-option ${frequency === f.value ? 'selected' : ''}`}
                onClick={() => setFrequency(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="hold-timer-actions">
          <button
            className="btn btn-primary btn-lg"
            onClick={handleConfirm}
            disabled={confirming || secondsLeft <= 0}
          >
            {confirming ? 'Confirming...' : `Confirm ${frequency ? frequency + ' ' : ''}Appointment`}
          </button>
        </div>
      </div>
    </div>
  );
}
