import type { LeaveRequest, LeaveRequestStatus, LeaveType } from '../types';

const VALID_LEAVE_TYPES: LeaveType[] = ['paid', 'unpaid'];
const VALID_LEAVE_STATUSES: LeaveRequestStatus[] = ['pending', 'approved', 'rejected'];

export function getLeaveTypeLabel(type: LeaveType): string {
  return type === 'paid' ? 'Paid leave' : 'Unpaid leave';
}

export function getLeaveStatusLabel(status: LeaveRequestStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending approval';
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
  }
}

export function countLeaveDays(startDate: string, endDate: string): number {
  const start = parseDateKey(startDate);
  const end = parseDateKey(endDate);
  if (!start || !end || end < start) return 0;
  const milliseconds = end.getTime() - start.getTime();
  return Math.floor(milliseconds / (1000 * 60 * 60 * 24)) + 1;
}

export function parseDateKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function normalizeLeaveRequests(
  employeeId: string,
  employeeName: string,
  data: Record<string, LeaveRequest> | null | undefined,
): LeaveRequest[] {
  if (!data) return [];

  return Object.entries(data)
    .map(([key, request]) => {
      const leaveType = VALID_LEAVE_TYPES.includes(request?.leaveType)
        ? request.leaveType
        : 'unpaid';
      const status = VALID_LEAVE_STATUSES.includes(request?.status)
        ? request.status
        : 'pending';

      return {
        id: request?.id || key,
        employeeId: request?.employeeId || employeeId,
        employeeName: request?.employeeName || employeeName,
        startDate: request?.startDate || key,
        endDate: request?.endDate || request?.startDate || key,
        leaveType,
        reason: request?.reason?.trim() || undefined,
        status,
        appliedAt: request?.appliedAt ?? Date.now(),
        reviewedAt: request?.reviewedAt,
        reviewedBy: request?.reviewedBy,
        reviewNote: request?.reviewNote?.trim() || undefined,
      };
    })
    .filter(
      (request) =>
        parseDateKey(request.startDate) &&
        parseDateKey(request.endDate) &&
        request.endDate >= request.startDate,
    )
    .sort((left, right) => right.appliedAt - left.appliedAt);
}

export function flattenLeaveRequests(
  data: Record<string, Record<string, LeaveRequest>> | null | undefined,
  employeeNames: Map<string, string>,
): LeaveRequest[] {
  if (!data) return [];

  return Object.entries(data).flatMap(([employeeId, requests]) =>
    normalizeLeaveRequests(
      employeeId,
      employeeNames.get(employeeId) ?? 'Employee',
      requests,
    ),
  );
}

export function serializeLeaveRequestForDatabase(
  request: LeaveRequest,
): Record<string, string | number> {
  const payload: Record<string, string | number> = {
    id: request.id,
    employeeId: request.employeeId,
    employeeName: request.employeeName,
    startDate: request.startDate,
    endDate: request.endDate,
    leaveType: request.leaveType,
    status: request.status,
    appliedAt: request.appliedAt,
  };

  if (request.reason) payload.reason = request.reason;
  if (request.reviewedAt != null) payload.reviewedAt = request.reviewedAt;
  if (request.reviewedBy) payload.reviewedBy = request.reviewedBy;
  if (request.reviewNote) payload.reviewNote = request.reviewNote;

  return payload;
}
