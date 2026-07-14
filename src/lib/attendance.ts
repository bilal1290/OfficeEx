import type { AttendanceRecord, AttendanceStatus } from '../types';

const VALID_STATUSES: AttendanceStatus[] = ['present', 'absent', 'half_day', 'leave'];

export function formatAttendanceDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseAttendanceDateKey(key: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

export function getAttendanceStatusLabel(status: AttendanceStatus): string {
  switch (status) {
    case 'present':
      return 'Present';
    case 'absent':
      return 'Absent';
    case 'half_day':
      return 'Half day';
    case 'leave':
      return 'Leave';
  }
}

export function normalizeAttendanceRecords(
  employeeId: string,
  data: Record<string, AttendanceRecord> | null | undefined,
): AttendanceRecord[] {
  if (!data) return [];

  return Object.entries(data)
    .map(([key, record]) => {
      const status = VALID_STATUSES.includes(record?.status) ? record.status : 'present';
      return {
        id: record?.id || key,
        employeeId: record?.employeeId || employeeId,
        date: record?.date || key,
        status,
        note: record?.note?.trim() || undefined,
        markedAt: record?.markedAt ?? Date.now(),
        markedBy: record?.markedBy ?? '',
      };
    })
    .filter((record) => parseAttendanceDateKey(record.date))
    .sort((left, right) => right.date.localeCompare(left.date));
}

export function filterAttendanceByMonth(
  records: AttendanceRecord[],
  year: number,
  month: number,
): AttendanceRecord[] {
  return records.filter((record) => {
    const parsed = parseAttendanceDateKey(record.date);
    return parsed?.year === year && parsed?.month === month;
  });
}

export function countAttendanceByStatus(
  records: AttendanceRecord[],
): Record<AttendanceStatus, number> {
  return records.reduce(
    (counts, record) => {
      counts[record.status] += 1;
      return counts;
    },
    { present: 0, absent: 0, half_day: 0, leave: 0 },
  );
}

export function serializeAttendanceForDatabase(
  record: AttendanceRecord,
): Record<string, string | number> {
  const payload: Record<string, string | number> = {
    id: record.id,
    employeeId: record.employeeId,
    date: record.date,
    status: record.status,
    markedAt: record.markedAt,
    markedBy: record.markedBy,
  };

  if (record.note) {
    payload.note = record.note;
  }

  return payload;
}

export function buildMonthDayKeys(year: number, month: number): string[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthKey = String(month).padStart(2, '0');
  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = String(index + 1).padStart(2, '0');
    return `${year}-${monthKey}-${day}`;
  });
}
