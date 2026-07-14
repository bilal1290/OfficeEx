import { useEffect, useState } from 'react';
import {
  Building2,
  Coins,
  Fingerprint,
  ScrollText,
  Shield,
  Sun,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ThemePicker } from '../components/settings/ThemePicker';
import { UserAvatar } from '../components/ui/UserAvatar';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { CurrencySelect } from '../components/ui/CurrencySelect';
import { COMPANY_SHARE_RATE } from '../lib/constants';
import { getRoleLabel } from '../lib/permissions';
import { clsx } from '../lib/utils';

type SettingsSection = 'account' | 'currency' | 'appearance' | 'rules';

const SECTIONS: {
  id: SettingsSection;
  label: string;
  icon: typeof User;
  adminOnly?: boolean;
}[] = [
  { id: 'account', label: 'Account', icon: User },
  { id: 'currency', label: 'Currency', icon: Coins },
  { id: 'appearance', label: 'Appearance', icon: Sun },
  { id: 'rules', label: 'Business Rules', icon: ScrollText },
];

export function SettingsPage() {
  const { profile, isAdmin } = useAuth();
  const {
    displayCurrency,
    setDisplayCurrency,
    usdToPkr,
    saveUsdToPkr,
    ratesLoading,
  } = useCurrency();

  const [activeSection, setActiveSection] =
    useState<SettingsSection>('account');
  const [pkrRateDraft, setPkrRateDraft] = useState(String(usdToPkr));
  const [savingRate, setSavingRate] = useState(false);
  const [rateSaved, setRateSaved] = useState(false);
  const [rateError, setRateError] = useState('');

  useEffect(() => {
    if (activeSection === 'currency') {
      setPkrRateDraft(String(usdToPkr));
    }
  }, [usdToPkr, activeSection]);

  const visibleSections = SECTIONS.filter(
    (section) => !section.adminOnly || isAdmin,
  );

  const roleBadgeVariant =
    profile?.role === 'admin'
      ? 'info'
      : profile?.role === 'viewer'
        ? 'warning'
        : 'default';

  const handleSavePkrRate = async () => {
    const parsed = parseFloat(pkrRateDraft);
    if (!parsed || parsed <= 0) {
      setRateError('Enter a valid rate greater than 0.');
      return;
    }

    setRateError('');
    setSavingRate(true);
    try {
      await saveUsdToPkr(parsed);
      setRateSaved(true);
    } finally {
      setSavingRate(false);
    }
  };

  const syncPkrDraft = () => {
    setPkrRateDraft(String(usdToPkr));
    setRateSaved(false);
    setRateError('');
  };

  const openSection = (section: SettingsSection) => {
    setActiveSection(section);
    if (section === 'currency') syncPkrDraft();
  };

  const sectionMeta = SECTIONS.find((section) => section.id === activeSection)!;

  return (
    <div className="settings-layout">
      <aside className="settings-nav-card">
        <p className="settings-nav-title">Settings</p>
        <nav className="settings-nav" aria-label="Settings sections">
          {visibleSections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={clsx(
                'settings-nav-item',
                activeSection === id && 'settings-nav-item-active',
              )}
              onClick={() => openSection(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="settings-panel">
        <Card>
          <CardHeader
            title={sectionMeta.label}
            subtitle={
              activeSection === 'account'
                ? 'Your profile and access level'
                : activeSection === 'currency'
                  ? 'Display currency and USD → PKR conversion'
                  : activeSection === 'appearance'
                    ? 'Theme and visual preferences'
                    : 'How OfficeEx calculates and shares data'
            }
          />

          {activeSection === 'account' && profile && (
            <div className="settings-section">
              <div className="settings-profile-hero">
                <UserAvatar user={profile} size="xl" />
                <div>
                  <p className="settings-profile-name">{profile.displayName}</p>
                  <p className="settings-profile-email">{profile.email}</p>
                </div>
              </div>

              <div className="settings-field">
                <User size={18} className="settings-field-icon" />
                <div>
                  <p className="settings-label">Display Name</p>
                  <p className="settings-value">{profile?.displayName}</p>
                </div>
              </div>
              <div className="settings-field">
                <Building2 size={18} className="settings-field-icon" />
                <div>
                  <p className="settings-label">Email</p>
                  <p className="settings-value">{profile?.email}</p>
                </div>
              </div>
              <div className="settings-field">
                <Shield size={18} className="settings-field-icon" />
                <div>
                  <p className="settings-label">Role</p>
                  <Badge variant={roleBadgeVariant}>
                    {profile?.role ? getRoleLabel(profile.role) : 'User'}
                  </Badge>
                </div>
              </div>
              <div className="settings-field">
                <Fingerprint size={18} className="settings-field-icon" />
                <div>
                  <p className="settings-label">User ID</p>
                  <p className="settings-value settings-value-mono">{profile?.uid}</p>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'currency' && (
            <div className="settings-section">
              <div className="settings-block">
                <h4 className="settings-block-title">Display currency</h4>
                <p className="settings-block-desc">
                  Dashboard totals, charts, and payables convert into this currency.
                </p>
                <CurrencySelect
                  label="Show amounts in"
                  value={displayCurrency}
                  onChange={setDisplayCurrency}
                />
              </div>

              {isAdmin && (
                <div className="settings-block settings-block-divider">
                  <h4 className="settings-block-title">USD to PKR rate</h4>
                  <p className="settings-block-desc">
                    Set how many Pakistani Rupees equal 1 US Dollar. All USD ↔ PKR
                    conversions use this rate.
                  </p>
                  <div className="settings-inline-form">
                    <Input
                      label="1 USD ="
                      type="number"
                      min="1"
                      step="1"
                      value={pkrRateDraft}
                      onChange={(event) => {
                        setPkrRateDraft(event.target.value);
                        setRateSaved(false);
                        setRateError('');
                      }}
                      disabled={ratesLoading}
                    />
                    <span className="settings-rate-suffix">PKR</span>
                    <Button
                      onClick={handleSavePkrRate}
                      disabled={savingRate || ratesLoading}
                    >
                      {savingRate ? 'Saving...' : 'Save Rate'}
                    </Button>
                  </div>
                  <p className="settings-block-note">
                    Current rate: <strong>1 USD = {usdToPkr} PKR</strong>
                  </p>
                  {rateError && <p className="auth-error">{rateError}</p>}
                  {rateSaved && (
                    <p className="settings-saved-msg">Exchange rate saved.</p>
                  )}
                </div>
              )}

              <div className="settings-block settings-block-divider">
                <h4 className="settings-block-title">Supported currencies</h4>
                <p className="settings-block-desc">
                  USD, PKR, EUR, and GBP on individual records. EUR and GBP use
                  fixed reference rates; PKR follows the rate above.
                </p>
              </div>
            </div>
          )}

          {activeSection === 'appearance' && (
            <div className="settings-section">
              <ThemePicker />
            </div>
          )}

          {activeSection === 'rules' && (
            <div className="settings-section">
              <ul className="rules-list">
                <li>
                  Project owners record income; the company automatically receives{' '}
                  <strong>{COMPANY_SHARE_RATE * 100}%</strong> as its share.
                </li>
                <li>
                  Net payable = company share (60%) minus the owner&apos;s expenses
                  for the same period.
                </li>
                <li>
                  Expense viewers can add and update office & fixed expenses — no
                  income access.
                </li>
                <li>
                  Administrators manage users, the USD/PKR rate, and all financial
                  records.
                </li>
                <li>
                  Fixed monthly expenses cover electricity, salaries, rent,
                  maintenance, and miscellaneous office costs.
                </li>
              </ul>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
