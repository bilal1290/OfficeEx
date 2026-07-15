import { useEffect, useMemo, useState } from 'react';
import { onValue, ref, set } from 'firebase/database';
import {
  filterAttendanceByMonth,
  formatAttendanceDateKey,
  canEmployeeSelfMarkAttendanceDate,
  normalizeAttendanceRecords,
  serializeAttendanceForDatabase,
} from '../lib/attendance';
import { db } from '../lib/firebase';
import type { AttendanceRecord, AttendanceStatus } from '../types';

export function useEmployeeAttendance(employeeId?: string) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(Boolean(employeeId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db || !employeeId) {
      setRecords([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const attendanceRef = ref(db, `employeeAttendance/${employeeId}`);
    const unsubscribe = onValue(
      attendanceRef,
      (snapshot) => {
        setRecords(
          normalizeAttendanceRecords(
            employeeId,
            snapshot.val() as Record<string, AttendanceRecord> | null,
          ),
        );
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Attendance listener error:', err);
        setError(
          err.message.includes('permission_denied')
            ? 'Unable to load attendance. Deploy the latest database rules.'
            : err.message,
        );
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [employeeId]);

  const markAttendance = async (
    date: string,
    status: AttendanceStatus,
    markedBy: string,
    note?: string,
    options?: { todayOnly?: boolean },
  ) => {
    if (!db || !employeeId) {
      throw new Error('Attendance is not available.');
    }

    if (options?.todayOnly && !canEmployeeSelfMarkAttendanceDate(date)) {
      throw new Error('You can only mark attendance for today.');
    }

    const record: AttendanceRecord = {
      id: date,
      employeeId,
      date,
      status,
      note: note?.trim() || undefined,
      markedAt: Date.now(),
      markedBy,
    };

    await set(
      ref(db, `employeeAttendance/${employeeId}/${date}`),
      serializeAttendanceForDatabase(record),
    );

    return record;
  };

  const markToday = async (
    status: AttendanceStatus,
    markedBy: string,
    note?: string,
  ) => markAttendance(formatAttendanceDateKey(new Date()), status, markedBy, note);

  return {
    records,
    loading,
    error,
    markAttendance,
    markToday,
    recordsForMonth: (year: number, month: number) =>
      filterAttendanceByMonth(records, year, month),
  };
}

export function useEmployeeAttendanceSummary(
  employeeId: string | undefined,
  year: number,
  month: number,
) {
  const { records, loading, error, markAttendance } = useEmployeeAttendance(employeeId);

  const monthRecords = useMemo(
    () => filterAttendanceByMonth(records, year, month),
    [records, year, month],
  );

  return {
    monthRecords,
    loading,
    error,
    markAttendance,
  };
}
