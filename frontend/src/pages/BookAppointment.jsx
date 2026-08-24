import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import HoldTimer from '../components/HoldTimer';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function BookAppointment() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: therapist, 2: date+slot, 3: hold+confirm
  const [therapists, setTherapists] = useState([]);
  const [selectedTherapist, setSelectedTherapist] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [holdData, setHoldData] = useState(null);
  const [error, setError] = useState('');

  // Restore active hold from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('activeHold');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (new Date(parsed.holdExpiresAt) > new Date()) {
          setHoldData(parsed);
          setStep(3);
        } else {
          localStorage.removeItem('activeHold');
        }
      } catch {
        localStorage.removeItem('activeHold');
      }
    }
  }, []);

  useEffect(() => {
    api.get('/therapists').then(({ data }) => setTherapists(data.therapists));
  }, []);

  // Set initial date to today
  useEffect(() => {
    const today = new Date();
    setSelectedDate(formatDateInput(today));
  }, []);

  const formatDateInput = (d) => {
    const year = typeof d.getUTCFullYear === 'function' ? d.getUTCFullYear() : d.getFullYear();
    const month = String((typeof d.getUTCMonth === 'function' ? d.getUTCMonth() : d.getMonth()) + 1).padStart(2, '0');
    const day = String(typeof d.getUTCDate === 'function' ? d.getUTCDate() : d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const fetchSlots = useCallback(async () => {
    if (!selectedTherapist || !selectedDate) return;
    setSlotsLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/therapists/${selectedTherapist.id}/slots?date=${selectedDate}`);
      setSlots(data.slots);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load slots');
    } finally {
      setSlotsLoading(false);
    }
  }, [selectedTherapist, selectedDate]);

  useEffect(() => {
    if (step === 2) fetchSlots();
  }, [step, selectedDate, fetchSlots]);

  const holdSlot = async (slot) => {
    setError('');
    try {
      const { data } = await api.post('/appointments/hold', {
        therapistId: selectedTherapist.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
      });
      const hold = {
        appointment: data.appointment,
        holdExpiresAt: data.appointment.holdExpiresAt,
        therapistName: selectedTherapist.name,
        slot,
      };
      localStorage.setItem('activeHold', JSON.stringify(hold));
      setHoldData(hold);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to hold slot');
    }
  };

  const onHoldExpired = () => {
    localStorage.removeItem('activeHold');
    setHoldData(null);
    setStep(2);
    setError('Hold expired. Please select another slot.');
    fetchSlots();
  };

  const onConfirmed = () => {
    localStorage.removeItem('activeHold');
    navigate('/patient');
  };

  const changeDate = (offset) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateUtc = new Date(Date.UTC(y, m - 1, d + offset));
    setSelectedDate(formatDateInput(dateUtc));
  };

  const getDateDisplayStr = () => {
    if (!selectedDate) return '';
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateUtc = new Date(Date.UTC(y, m - 1, d));
    return `${DAYS[dateUtc.getUTCDay()]}, ${dateUtc.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' })}`;
  };

  const getStepState = (s) => {
    if (s < step) return 'completed';
    if (s === step) return 'active';
    return '';
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Book Appointment</h1>
        <p className="page-subtitle">Select a therapist, pick a date, and book your session</p>
      </div>

      {/* Progress Steps */}
      <div className="booking-steps">
        <div className={`booking-step ${getStepState(1)}`}>
          <div className="step-number">{step > 1 ? '✓' : '1'}</div>
          <span>Therapist</span>
        </div>
        <div className="step-connector"></div>
        <div className={`booking-step ${getStepState(2)}`}>
          <div className="step-number">{step > 2 ? '✓' : '2'}</div>
          <span>Date & Slot</span>
        </div>
        <div className="step-connector"></div>
        <div className={`booking-step ${getStepState(3)}`}>
          <div className="step-number">3</div>
          <span>Confirm</span>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Step 1: Select Therapist */}
      {step === 1 && (
        <div className="section">
          <h2 className="section-title">Select a Therapist</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {therapists.map((t) => (
              <div
                key={t.id}
                className={`therapist-card ${selectedTherapist?.id === t.id ? 'selected' : ''}`}
                onClick={() => setSelectedTherapist(t)}
              >
                <div className="therapist-avatar">{t.name.charAt(0)}</div>
                <div className="therapist-info">
                  <h3>{t.name}</h3>
                  <p>{t.email}</p>
                </div>
              </div>
            ))}
          </div>
          {selectedTherapist && (
            <button className="btn btn-primary" style={{ marginTop: '24px' }} onClick={() => setStep(2)}>
              Continue →
            </button>
          )}
        </div>
      )}

      {/* Step 2: Select Date & Slot */}
      {step === 2 && (
        <div className="section">
          <button className="btn btn-secondary btn-sm" onClick={() => { setStep(1); setSlots([]); }} style={{ marginBottom: '16px' }}>
            ← Back
          </button>
          <h2 className="section-title">Select Date & Time Slot</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
            Booking with <strong style={{ color: 'var(--accent)' }}>{selectedTherapist.name}</strong>
          </p>

          {/* Date Navigation */}
          <div className="date-nav">
            <button className="btn btn-secondary btn-sm" onClick={() => changeDate(-1)}>←</button>
            <div className="date-display">{getDateDisplayStr()}</div>
            <button className="btn btn-secondary btn-sm" onClick={() => changeDate(1)}>→</button>
            <input
              type="date"
              className="form-input"
              style={{ width: 'auto' }}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={formatDateInput(new Date())}
            />
          </div>

          {/* Slots */}
          {slotsLoading ? (
            <div className="loading"><div className="spinner"></div></div>
          ) : slots.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <p>No available slots on this date</p>
              <p style={{ fontSize: '0.85rem', marginTop: '8px' }}>Try another date or check the therapist's schedule</p>
            </div>
          ) : (
            <div className="slots-grid">
              {slots.map((slot) => (
                <div
                  key={slot.startTime}
                  className="slot-card"
                  onClick={() => holdSlot(slot)}
                >
                  <div style={{ fontWeight: 600 }}>{slot.startTimeStr}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>to {slot.endTimeStr}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Hold & Confirm */}
      {step === 3 && holdData && (
        <HoldTimer
          holdData={holdData}
          onExpired={onHoldExpired}
          onConfirmed={onConfirmed}
        />
      )}
    </div>
  );
}
