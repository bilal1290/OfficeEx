import { Card, CardHeader } from '../ui/Card';
import { useCurrency } from '../../context/CurrencyContext';
import { COMPANY_SHARE_RATE } from '../../lib/constants';
import type { OwnerPayable } from '../../types';

interface OwnerPayablesCardProps {
  payables: OwnerPayable[];
  compact?: boolean;
}

export function OwnerPayablesCard({ payables, compact }: OwnerPayablesCardProps) {
  const { formatDisplay, displayCurrency } = useCurrency();

  return (
    <Card className="payables-card overview-payables">
      <CardHeader
        title="Payables"
        subtitle={`${COMPANY_SHARE_RATE * 100}% company share minus owner expenses · ${displayCurrency}`}
      />

      <div className="overview-payables-mobile" aria-label="Payables">
        {payables.length === 0 ? (
          <p className="overview-empty">No payable records for this period</p>
        ) : (
          payables.map((payable) => (
            <article key={payable.ownerId} className="overview-payable-item">
              <p className="overview-payable-name">{payable.ownerName}</p>
              <dl className="overview-payable-rows">
                <div className="overview-payable-row">
                  <dt>Gross income</dt>
                  <dd>{formatDisplay(payable.grossIncome)}</dd>
                </div>
                <div className="overview-payable-row">
                  <dt>Company share ({COMPANY_SHARE_RATE * 100}%)</dt>
                  <dd className="text-accent">{formatDisplay(payable.companyShareDue)}</dd>
                </div>
                <div className="overview-payable-row">
                  <dt>Owner expenses</dt>
                  <dd className="text-danger">{formatDisplay(payable.ownerExpenses)}</dd>
                </div>
                <div className="overview-payable-row overview-payable-row-highlight">
                  <dt>Net payable</dt>
                  <dd
                    className={
                      payable.netPayableToCompany > 0
                        ? 'text-warning payable-highlight'
                        : 'text-success'
                    }
                  >
                    {formatDisplay(payable.netPayableToCompany)}
                  </dd>
                </div>
                {!compact && (
                  <div className="overview-payable-row">
                    <dt>Owner retained</dt>
                    <dd>{formatDisplay(payable.ownerRetained)}</dd>
                  </div>
                )}
              </dl>
            </article>
          ))
        )}
      </div>

      <div className="table-wrapper overview-payables-table">
        <table className="data-table payables-table">
          <thead>
            <tr>
              <th>Project Owner</th>
              <th>Gross Income</th>
              <th>Company Share ({COMPANY_SHARE_RATE * 100}%)</th>
              <th>Owner Expenses</th>
              <th>Net Payable</th>
              {!compact && <th>Owner Retained</th>}
            </tr>
          </thead>
          <tbody>
            {payables.length === 0 ? (
              <tr>
                <td colSpan={compact ? 5 : 6} className="empty-cell">
                  No payable records for this period
                </td>
              </tr>
            ) : (
              payables.map((payable) => (
                <tr key={payable.ownerId}>
                  <td className="payable-owner">{payable.ownerName}</td>
                  <td>{formatDisplay(payable.grossIncome)}</td>
                  <td className="text-accent">{formatDisplay(payable.companyShareDue)}</td>
                  <td className="text-danger">{formatDisplay(payable.ownerExpenses)}</td>
                  <td
                    className={
                      payable.netPayableToCompany > 0
                        ? 'text-warning payable-highlight'
                        : 'text-success'
                    }
                  >
                    {formatDisplay(payable.netPayableToCompany)}
                  </td>
                  {!compact && (
                    <td>{formatDisplay(payable.ownerRetained)}</td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="payables-formula">
        Net Payable = Company Share ({COMPANY_SHARE_RATE * 100}%) − Owner Expenses
      </p>
    </Card>
  );
}
