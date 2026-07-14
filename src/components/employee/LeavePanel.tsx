import { useState } from 'react';
import { Palmtree, Send } from 'lucide-react';
import { useEmployeeLeaveRequests } from '../../hooks/useEmployeeLeaveRequests';
import {
  countLeaveDays,
  getLeaveStatusLabel,
  getLeaveTypeLabel,
} from '../../lib/leaves';
import { formatDateTime } from '../../lib/datetime';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { DataErrorBanner } from '../ui/DataErrorBanner';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import type { LeaveType } from '../../types';

interface LeavePanelProps {
  employeeId: string;
  employeeName: string;
}

export function LeavePanel({ employeeId, employeeName }: LeavePanelProps) {
  const { requests, loading, error, applyLeave } = useEmployeeLeaveRequests(
    employeeId,
    employeeName,
  );
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [leaveType, setLeaveType] = useState<LeaveType>('paid');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    setSuccess('');

    if (!startDate || !endDate) {
      setFormError('Select start and end dates.');
      return;
    }

    setSubmitting(true);
    try {
      await applyLeave({ startDate, endDate, leaveType, reason });
      setSuccess('Leave request submitted for admin approval.');
      setStartDate('');
      setEndDate('');
      setReason('');
      setLeaveType('paid');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not submit leave request.');
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
    <div className="leave-panel">
      {error && <DataErrorBanner message={error} />}

      <Card className="leave-form-card">
        <CardHeader
          title="Apply for leave"
          subtitle="Submit paid or unpaid leave for administrator approval"
        />
        <form onSubmit={handleSubmit} className="leave-form">
          <div className="leave-form-grid">
            <Input
              label="Start date"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              required
            />
            <Input
              label="End date"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              required
            />
          </div>
          <Select
            label="Leave type"
            value={leaveType}
            onChange={(event) => setLeaveType(event.target.value as LeaveType)}
            options={[
              { value: 'paid', label: 'Paid leave' },
              { value: 'unpaid', label: 'Unpaid leave' },
            ]}
          />
          <Input
            label="Reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Optional note for your manager"
          />
          {startDate && endDate && endDate >= startDate && (
            <p className="form-hint">
              Duration: {countLeaveDays(startDate, endDate)} day
              {countLeaveDays(startDate, endDate) === 1 ? '' : 's'}
            </p>
          )}
          {formError && <p className="form-error">{formError}</p>}
          {success && <p className="form-success">{success}</p>}
          <Button type="submit" disabled={submitting}>
            <Send size={16} />
            {submitting ? 'Submitting...' : 'Submit leave request'}
          </Button>
        </form>
      </Card>

      <Card className="leave-list-card">
        <CardHeader title="Your leave requests" subtitle="Track approval status" />
        {requests.length === 0 ? (
          <p className="leave-empty">No leave requests yet.</p>
        ) : (
          <ul className="leave-list">
            {requests.map((request) => (
              <li key={request.id} className="leave-item">
                <div className="leave-item-main">
                  <div className="leave-item-title">
                    <Palmtree size={16} />
                    <span>
                      {request.startDate}
                      {request.endDate !== request.startDate
                        ? ` → ${request.endDate}`
                        : ''}
                    </span>
                  </div>
                  <p className="leave-item-meta">
                    {getLeaveTypeLabel(request.leaveType)} ·{' '}
                    {countLeaveDays(request.startDate, request.endDate)} day
                    {countLeaveDays(request.startDate, request.endDate) === 1 ? '' : 's'} ·{' '}
                    Applied {formatDateTime(request.appliedAt)}
                  </p>
                  {request.reason && <p className="leave-item-reason">{request.reason}</p>}
                  {request.reviewNote && (
                    <p className="leave-item-review">Admin note: {request.reviewNote}</p>
                  )}
                </div>
                <Badge
                  variant={
                    request.status === 'approved'
                      ? 'success'
                      : request.status === 'rejected'
                        ? 'default'
                        : 'warning'
                  }
                >
                  {getLeaveStatusLabel(request.status)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
