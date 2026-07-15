import { useMemo, useState } from 'react';
import { CalendarCheck2, CircleCheck, Clock3, Palmtree, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useEmployeeAttendance } from '../../hooks/useEmployeeAttendance';
import {
  buildMonthDayKeys,
  countAttendanceByStatus,
  formatAttendanceDateKey,
  getAttendanceStatusLabel,
  parseAttendanceDateKey,
} from '../../lib/attendance';
import { MONTHS } from '../../lib/constants';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { DataErrorBanner } from '../ui/DataErrorBanner';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { clsx } from '../../lib/utils';
import type { AttendanceStatus } from '../../types';

const STATUS_OPTIONS: Array<{
  value: AttendanceStatus;
  label: string;
  icon: typeof CircleCheck;
}> = [
  { value: 'present', label: 'Present', icon: CircleCheck },
  { value: 'half_day', label: 'Half day', icon: Clock3 },
  { value: 'leave', label: 'Leave', icon: Palmtree },
  { value: 'absent', label: 'Absent', icon: XCircle },
];

interface AttendancePanelProps {
  employeeId: string;
  readOnly?: boolean;
  /** When true, employees can only view history and mark today. */
  restrictToToday?: boolean;
}

export function AttendancePanel({
  employeeId,
  readOnly = false,
  restrictToToday = false,
}: AttendancePanelProps) {
  const { user } = useAuth();
  const { records, loading, error, markAttendance } = useEmployeeAttendance(employeeId);
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState(formatAttendanceDateKey(today));
  const [status, setStatus] = useState<AttendanceStatus>('present');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');

  const monthRecords = useMemo(
    () =>
      records.filter((record) => {
        const parsed = parseAttendanceDateKey(record.date);
        return parsed?.year === year && parsed?.month === month;
      }),
    [records, year, month],
  );

  const recordByDate = useMemo(
    () => new Map(monthRecords.map((record) => [record.date, record])),
    [monthRecords],
  );

  const monthSummary = useMemo(
    () => countAttendanceByStatus(monthRecords),
    [monthRecords],
  );

  const dayKeys = useMemo(() => buildMonthDayKeys(year, month), [year, month]);
  const todayKey = formatAttendanceDateKey(today);

  const yearOptions = useMemo(() => {
    const years = new Set(records.map((record) => parseAttendanceDateKey(record.date)?.year));
    years.add(today.getFullYear());
    return Array.from(years)
      .filter((value): value is number => value != null)
      .sort((left, right) => right - left)
      .map((value) => ({ value: String(value), label: String(value) }));
  }, [records, today]);

  const handleSelectDate = (dateKey: string) => {
    if (restrictToToday && dateKey !== todayKey) {
      return;
    }

    setSelectedDate(dateKey);
    const existing = recordByDate.get(dateKey);
    setStatus(existing?.status ?? 'present');
    setNote(existing?.note ?? '');
    setFormError('');
    setSuccess('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (readOnly || !user) return;

    setSubmitting(true);
    setFormError('');
    setSuccess('');

    try {
      await markAttendance(selectedDate, status, user.uid, note, {
        todayOnly: restrictToToday,
      });
      setSuccess(`Attendance saved for ${selectedDate}.`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save attendance.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="office-panel-loading">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="attendance-panel">
      {error && <DataErrorBanner message={error} />}

      <Card className="attendance-summary-card">
        <CardHeader
          title="Monthly summary"
          subtitle={`${MONTHS.find((item) => item.value === month)?.label} ${year}`}
        />
        <div className="attendance-summary-grid">
          <div className="attendance-summary-item present">
            <span>Present</span>
            <strong>{monthSummary.present}</strong>
          </div>
          <div className="attendance-summary-item half">
            <span>Half day</span>
            <strong>{monthSummary.half_day}</strong>
          </div>
          <div className="attendance-summary-item leave">
            <span>Leave</span>
            <strong>{monthSummary.leave}</strong>
          </div>
          <div className="attendance-summary-item absent">
            <span>Absent</span>
            <strong>{monthSummary.absent}</strong>
          </div>
        </div>
      </Card>

      <Card className="attendance-controls-card">
        <div className="attendance-filters">
          <Select
            label="Year"
            value={String(year)}
            onChange={(event) => setYear(Number(event.target.value))}
            options={yearOptions}
          />
          <Select
            label="Month"
            value={String(month)}
            onChange={(event) => setMonth(Number(event.target.value))}
            options={MONTHS.map((item) => ({
              value: String(item.value),
              label: item.label,
            }))}
          />
        </div>

        <div className="attendance-calendar">
          {dayKeys.map((dateKey) => {
            const parsed = parseAttendanceDateKey(dateKey);
            const record = recordByDate.get(dateKey);
            const isSelected = selectedDate === dateKey;
            const isToday = dateKey === todayKey;
            const isFuture = dateKey > todayKey;
            const isPast = dateKey < todayKey;
            const isLockedForEmployee = restrictToToday && dateKey !== todayKey;

            return (
              <button
                key={dateKey}
                type="button"
                className={clsx(
                  'attendance-day',
                  record && `attendance-day-${record.status}`,
                  isSelected && 'attendance-day-selected',
                  isToday && 'attendance-day-today',
                  isFuture && 'attendance-day-future',
                  isPast && restrictToToday && 'attendance-day-past',
                )}
                onClick={() => handleSelectDate(dateKey)}
                disabled={isFuture || isLockedForEmployee}
                title={
                  isLockedForEmployee
                    ? 'Only today can be updated'
                    : undefined
                }
              >
                <span className="attendance-day-number">{parsed?.day}</span>
                <span className="attendance-day-status">
                  {record ? getAttendanceStatusLabel(record.status) : '—'}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {!readOnly && (
        <Card className="attendance-form-card">
          <CardHeader
            title="Mark attendance"
            subtitle={
              restrictToToday
                ? `Today only: ${todayKey}`
                : `Selected date: ${selectedDate}`
            }
          />
          {restrictToToday && selectedDate !== todayKey && (
            <p className="attendance-restriction-note">
              Attendance can only be marked for today. Past days are read-only.
            </p>
          )}
          <form onSubmit={handleSubmit} className="attendance-form">
            <div className="attendance-status-options">
              {STATUS_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  className={clsx(
                    'attendance-status-btn',
                    status === value && 'attendance-status-btn-active',
                    `attendance-status-btn-${value}`,
                  )}
                  onClick={() => setStatus(value)}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
            <Input
              label="Note (optional)"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Reason for leave, late arrival, etc."
            />
            {formError && <p className="form-error">{formError}</p>}
            {success && <p className="form-success">{success}</p>}
            <Button
              type="submit"
              disabled={
                submitting ||
                selectedDate > todayKey ||
                (restrictToToday && selectedDate !== todayKey)
              }
            >
              <CalendarCheck2 size={16} />
              {submitting ? 'Saving...' : 'Save attendance'}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
