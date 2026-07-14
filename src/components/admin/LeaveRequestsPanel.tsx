import { useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLeaveRequestAdmin } from '../../hooks/useLeaveRequestAdmin';
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
import { Badge } from '../ui/Badge';

export function LeaveRequestsPanel() {
  const { user, permissions } = useAuth();
  const { pendingRequests, loading, error, reviewRequest } = useLeaveRequestAdmin();
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  if (!permissions.canManageEmployees) {
    return null;
  }

  const handleReview = async (
    requestId: string,
    employeeId: string,
    status: 'approved' | 'rejected',
  ) => {
    if (!user) return;

    const request = pendingRequests.find(
      (item) => item.id === requestId && item.employeeId === employeeId,
    );
    if (!request) return;

    setSubmittingId(requestId);
    setActionError('');

    try {
      await reviewRequest(request, status, user.uid, reviewNotes[requestId]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not update leave request.');
    } finally {
      setSubmittingId(null);
    }
  };

  if (loading) {
    return (
      <Card className="leave-admin-card">
        <div className="office-panel-loading">
          <div className="spinner" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="leave-admin-card">
      <CardHeader
        title="Leave requests"
        subtitle="Review employee paid and unpaid leave applications"
      />

      {error && <DataErrorBanner message={error} />}
      {actionError && <p className="form-error leave-admin-error">{actionError}</p>}

      {pendingRequests.length === 0 ? (
        <p className="leave-empty">No pending leave requests.</p>
      ) : (
        <ul className="leave-admin-list">
          {pendingRequests.map((request) => (
            <li key={request.id} className="leave-admin-item">
              <div className="leave-admin-main">
                <p className="leave-admin-name">{request.employeeName}</p>
                <p className="leave-admin-dates">
                  {request.startDate}
                  {request.endDate !== request.startDate ? ` → ${request.endDate}` : ''}
                </p>
                <div className="leave-admin-badges">
                  <Badge variant="info">{getLeaveTypeLabel(request.leaveType)}</Badge>
                  <Badge variant="warning">{getLeaveStatusLabel(request.status)}</Badge>
                  <span className="leave-admin-days">
                    {countLeaveDays(request.startDate, request.endDate)} day
                    {countLeaveDays(request.startDate, request.endDate) === 1 ? '' : 's'}
                  </span>
                </div>
                {request.reason && <p className="leave-item-reason">{request.reason}</p>}
                <p className="leave-admin-meta">Applied {formatDateTime(request.appliedAt)}</p>
                <Input
                  label="Review note (optional)"
                  value={reviewNotes[request.id] ?? ''}
                  onChange={(event) =>
                    setReviewNotes((current) => ({
                      ...current,
                      [request.id]: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="leave-admin-actions">
                <Button
                  size="sm"
                  onClick={() => handleReview(request.id, request.employeeId, 'approved')}
                  disabled={submittingId === request.id}
                >
                  <CheckCircle2 size={15} />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleReview(request.id, request.employeeId, 'rejected')}
                  disabled={submittingId === request.id}
                >
                  <XCircle size={15} />
                  Reject
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
