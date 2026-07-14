import { useEffect, useMemo, useState } from 'react';
import { onValue, ref, set } from 'firebase/database';
import { useEmployees } from './useEmployees';
import {
  flattenLeaveRequests,
  serializeLeaveRequestForDatabase,
} from '../lib/leaves';
import { db } from '../lib/firebase';
import type { LeaveRequest, LeaveRequestStatus } from '../types';

export function useLeaveRequestAdmin() {
  const { employees } = useEmployees();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const employeeNames = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee.name])),
    [employees],
  );

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const requestsRef = ref(db, 'employeeLeaveRequests');
    const unsubscribe = onValue(
      requestsRef,
      (snapshot) => {
        setRequests(
          flattenLeaveRequests(
            snapshot.val() as Record<string, Record<string, LeaveRequest>> | null,
            employeeNames,
          ),
        );
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Admin leave requests listener error:', err);
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [employeeNames]);

  const reviewRequest = async (
    request: LeaveRequest,
    status: Exclude<LeaveRequestStatus, 'pending'>,
    reviewedBy: string,
    reviewNote?: string,
  ) => {
    if (!db) throw new Error('Database is not configured');

    const updated: LeaveRequest = {
      ...request,
      status,
      reviewedAt: Date.now(),
      reviewedBy,
      reviewNote: reviewNote?.trim() || undefined,
    };

    await set(
      ref(db, `employeeLeaveRequests/${request.employeeId}/${request.id}`),
      serializeLeaveRequestForDatabase(updated),
    );

    return updated;
  };

  const pendingRequests = useMemo(
    () => requests.filter((request) => request.status === 'pending'),
    [requests],
  );

  return {
    requests,
    pendingRequests,
    loading,
    error,
    reviewRequest,
  };
}
