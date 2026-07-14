import { useMemo, useState } from 'react';
import { CalendarDays, Gift, MinusCircle, Palmtree, Wallet } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useEmployeePayslips } from '../hooks/useEmployeePayslips';
import { AttendancePanel } from '../components/employee/AttendancePanel';
import { LeavePanel } from '../components/employee/LeavePanel';
import { MONTHS } from '../lib/constants';
import { Card, CardHeader } from '../components/ui/Card';
import { DataErrorBanner } from '../components/ui/DataErrorBanner';
import { Select } from '../components/ui/Select';
import { clsx } from '../lib/utils';
import type { EmployeePayslip } from '../types';

type PortalTab = 'salary' | 'attendance' | 'leaves';

function PayslipBreakdown({ payslip }: { payslip: EmployeePayslip }) {
  const { formatNative, formatDisplay, convertToDisplay, displayCurrency } = useCurrency();
  const currency = payslip.currency ?? displayCurrency;

  const lines = [
    { label: 'Base salary', value: payslip.baseSalary, icon: CalendarDays, tone: 'neutral' },
    { label: 'Leave days', value: `${payslip.leaveDays}`, icon: Palmtree, tone: 'muted' },
    {
      label: 'Leave deduction',
      value: -payslip.leaveDeduction,
      icon: MinusCircle,
      tone: 'danger',
    },
    { label: 'Bonus', value: payslip.bonus, icon: Gift, tone: 'success' },
    {
      label: 'Other deductions',
      value: -payslip.otherDeductions,
      icon: MinusCircle,
      tone: 'danger',
    },
  ];

  const netDisplay = convertToDisplay(payslip.netAmount, currency);

  return (
    <div className="payslip-breakdown">
      <div className="payslip-breakdown-grid">
        {lines.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className={`payslip-line payslip-line-${tone}`}>
            <span className="payslip-line-label">
              <Icon size={15} />
              {label}
            </span>
            <span className="payslip-line-value">
              {typeof value === 'number'
                ? formatNative(Math.abs(value), currency)
                : value}
            </span>
          </div>
        ))}
      </div>

      <div className="payslip-net">
        <div>
          <span className="payslip-net-label">Net payable</span>
          <strong className="payslip-net-value">{formatNative(payslip.netAmount, currency)}</strong>
          {currency !== displayCurrency && (
            <span className="payslip-net-converted">≈ {formatDisplay(netDisplay)}</span>
          )}
        </div>
        <span className={`payslip-status ${payslip.paid ? 'paid' : 'unpaid'}`}>
          {payslip.paid ? 'Paid' : 'Pending payment'}
        </span>
      </div>

      {payslip.note && <p className="payslip-note">{payslip.note}</p>}
    </div>
  );
}

function SalaryTab({ employeeId }: { employeeId: string }) {
  const { payslips, loading, error } = useEmployeePayslips(employeeId);
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState<number | 'all'>('all');

  const yearOptions = useMemo(() => {
    const years = new Set(payslips.map((item) => item.year));
    years.add(currentYear);
    return Array.from(years)
      .sort((left, right) => right - left)
      .map((value) => ({ value: String(value), label: String(value) }));
  }, [payslips, currentYear]);

  const filteredPayslips = useMemo(
    () =>
      payslips.filter((payslip) => {
        if (payslip.year !== year) return false;
        if (month !== 'all' && payslip.month !== month) return false;
        return true;
      }),
    [payslips, year, month],
  );

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="employee-portal-tab">
      {error && <DataErrorBanner message={error} />}

      <Card className="my-salary-hero">
        <CardHeader
          title="Salary breakdown"
          subtitle="Base pay, leaves, bonuses, and net amount published by admin"
        />
        <div className="my-salary-filters">
          <Select
            label="Year"
            value={String(year)}
            onChange={(event) => setYear(Number(event.target.value))}
            options={yearOptions}
          />
          <Select
            label="Month"
            value={String(month)}
            onChange={(event) => {
              const value = event.target.value;
              setMonth(value === 'all' ? 'all' : Number(value));
            }}
            options={[
              { value: 'all', label: 'All months' },
              ...MONTHS.map((item) => ({
                value: String(item.value),
                label: item.label,
              })),
            ]}
          />
        </div>
      </Card>

      {filteredPayslips.length === 0 ? (
        <Card className="my-salary-empty">
          <p>No salary records yet for this period.</p>
          <span>Your administrator publishes payslips when monthly payroll is saved.</span>
        </Card>
      ) : (
        <div className="my-salary-list">
          {filteredPayslips.map((payslip) => (
            <Card key={payslip.id} className="my-salary-card">
              <CardHeader
                title={`${MONTHS.find((item) => item.value === payslip.month)?.label} ${payslip.year}`}
                subtitle={payslip.employeeName}
              />
              <PayslipBreakdown payslip={payslip} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export function EmployeePortalPage() {
  const { profile } = useAuth();
  const employeeId = profile?.employeeId;
  const [tab, setTab] = useState<PortalTab>('salary');

  if (!employeeId) {
    return (
      <Card className="my-salary-empty">
        <p>Your employee profile is not linked yet.</p>
        <span>Ask an administrator to verify and link your account.</span>
      </Card>
    );
  }

  return (
    <div className="employee-portal-page">
      <Card className="employee-portal-hero">
        <CardHeader
          title="Employee portal"
          subtitle={`Welcome, ${profile?.displayName ?? 'Employee'}`}
        />
        <div className="employee-portal-tabs" role="tablist" aria-label="Employee portal">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'salary'}
            className={clsx('employee-portal-tab-btn', tab === 'salary' && 'active')}
            onClick={() => setTab('salary')}
          >
            <Wallet size={16} />
            Salary
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'attendance'}
            className={clsx('employee-portal-tab-btn', tab === 'attendance' && 'active')}
            onClick={() => setTab('attendance')}
          >
            <CalendarDays size={16} />
            Attendance
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'leaves'}
            className={clsx('employee-portal-tab-btn', tab === 'leaves' && 'active')}
            onClick={() => setTab('leaves')}
          >
            <Palmtree size={16} />
            Leaves
          </button>
        </div>
      </Card>

      {tab === 'salary' ? (
        <SalaryTab employeeId={employeeId} />
      ) : tab === 'attendance' ? (
        <AttendancePanel employeeId={employeeId} />
      ) : (
        <LeavePanel employeeId={employeeId} employeeName={profile?.displayName ?? 'Employee'} />
      )}
    </div>
  );
}
