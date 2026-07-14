import { useEffect, useState } from 'react';
import { onValue, ref, set } from 'firebase/database';
import {
  normalizeLeaveRequests,
  serializeLeaveRequestForDatabase,
} from '../lib/leaves';
import { db } from '../lib/firebase';
import { generateId } from '../lib/utils';
import type { LeaveRequest, LeaveType } from '../types';

export function useEmployeeLeaveRequests(
  employeeId?: string,
  employeeName?: string,
) {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(Boolean(employeeId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db || !employeeId) {
      setRequests([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const requestsRef = ref(db, `employeeLeaveRequests/${employeeId}`);
    const unsubscribe = onValue(
      requestsRef,
      (snapshot) => {
        setRequests(
          normalizeLeaveRequests(
            employeeId,
            employeeName ?? 'Employee',
            snapshot.val() as Record<string, LeaveRequest> | null,
          ),
        );
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Leave requests listener error:', err);
        setError(
          err.message.includes('permission_denied')
            ? 'Unable to load leave requests. Deploy the latest database rules.'
            : err.message,
        );
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [employeeId, employeeName]);

  const applyLeave = async (input: {
    startDate: string;
    endDate: string;
    leaveType: LeaveType;
    reason?: string;
  }) => {
    if (!db || !employeeId) {
      throw new Error('Leave requests are not available.');
    }

    if (input.endDate < input.startDate) {
      throw new Error('End date must be on or after start date.');
    }

    const id = generateId();
    const request: LeaveRequest = {
      id,
      employeeId,
      employeeName: employeeName ?? 'Employee',
      startDate: input.startDate,
      endDate: input.endDate,
      leaveType: input.leaveType,
      reason: input.reason?.trim() || undefined,
      status: 'pending',
      appliedAt: Date.now(),
    };

    await set(
      ref(db, `employeeLeaveRequests/${employeeId}/${id}`),
      serializeLeaveRequestForDatabase(request),
    );

    return request;
  };

  return {
    requests,
    loading,
    error,
    applyLeave,
  };
}
