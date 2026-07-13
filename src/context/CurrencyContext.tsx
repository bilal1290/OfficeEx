import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { onValue, ref, set } from 'firebase/database';
import { db } from '../lib/firebase';
import {
  buildExchangeRates,
  convertCurrency,
  DEFAULT_CURRENCY,
  DEFAULT_EXCHANGE_RATES,
  DEFAULT_USD_TO_PKR,
  formatCurrencyAmount,
  resolveCurrency,
} from '../lib/currency';
import type { CurrencyCode, ExchangeRates } from '../types';

const DISPLAY_CURRENCY_KEY = 'officeex-display-currency';

interface CurrencyContextValue {
  displayCurrency: CurrencyCode;
  setDisplayCurrency: (currency: CurrencyCode) => void;
  usdToPkr: number;
  rates: ExchangeRates;
  saveUsdToPkr: (rate: number) => Promise<void>;
  ratesLoading: boolean;
  convertToDisplay: (amount: number, sourceCurrency?: CurrencyCode) => number;
  format: (amount: number, sourceCurrency?: CurrencyCode) => string;
  formatDisplay: (amount: number) => string;
  formatNative: (amount: number, currency?: CurrencyCode) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

function readStoredCurrency(): CurrencyCode {
  const stored = localStorage.getItem(DISPLAY_CURRENCY_KEY);
  if (stored === 'USD' || stored === 'PKR' || stored === 'EUR' || stored === 'GBP') {
    return stored;
  }
  return DEFAULT_CURRENCY;
}

function resolveUsdToPkr(value: unknown): number {
  if (typeof value === 'number' && value > 0) return value;
  return DEFAULT_USD_TO_PKR;
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [displayCurrency, setDisplayCurrencyState] =
    useState<CurrencyCode>(readStoredCurrency);
  const [usdToPkr, setUsdToPkr] = useState(DEFAULT_USD_TO_PKR);
  const [rates, setRates] = useState<ExchangeRates>(DEFAULT_EXCHANGE_RATES);
  const [ratesLoading, setRatesLoading] = useState(Boolean(db));

  useEffect(() => {
    if (!db) {
      setRatesLoading(false);
      return;
    }

    const settingsRef = ref(db, 'settings');
    const unsubscribe = onValue(
      settingsRef,
      (snapshot) => {
        let nextUsdToPkr = DEFAULT_USD_TO_PKR;

        if (snapshot.child('usdToPkr').exists()) {
          nextUsdToPkr = resolveUsdToPkr(snapshot.child('usdToPkr').val());
        } else if (snapshot.child('exchangeRates/PKR').exists()) {
          const pkrUsdRate = snapshot.child('exchangeRates/PKR').val();
          if (typeof pkrUsdRate === 'number' && pkrUsdRate > 0) {
            nextUsdToPkr = Math.round(1 / pkrUsdRate);
          }
        }

        setUsdToPkr(nextUsdToPkr);
        setRates(buildExchangeRates(nextUsdToPkr));
        setRatesLoading(false);
      },
      () => setRatesLoading(false),
    );

    return () => unsubscribe();
  }, []);

  const setDisplayCurrency = useCallback((currency: CurrencyCode) => {
    setDisplayCurrencyState(currency);
    localStorage.setItem(DISPLAY_CURRENCY_KEY, currency);
  }, []);

  const saveUsdToPkr = useCallback(async (rate: number) => {
    if (!db) throw new Error('Database is not configured');
    const safeRate = rate > 0 ? rate : DEFAULT_USD_TO_PKR;
    await set(ref(db, 'settings/usdToPkr'), safeRate);
    setUsdToPkr(safeRate);
    setRates(buildExchangeRates(safeRate));
  }, []);

  const convertToDisplay = useCallback(
    (amount: number, sourceCurrency?: CurrencyCode) =>
      convertCurrency(amount, sourceCurrency, displayCurrency, rates),
    [displayCurrency, rates],
  );

  const format = useCallback(
    (amount: number, sourceCurrency?: CurrencyCode) =>
      formatCurrencyAmount(
        convertCurrency(amount, sourceCurrency, displayCurrency, rates),
        displayCurrency,
      ),
    [displayCurrency, rates],
  );

  const formatDisplay = useCallback(
    (amount: number) => formatCurrencyAmount(amount, displayCurrency),
    [displayCurrency],
  );

  const formatNative = useCallback(
    (amount: number, currency?: CurrencyCode) =>
      formatCurrencyAmount(amount, resolveCurrency(currency)),
    [],
  );

  const value = useMemo(
    () => ({
      displayCurrency,
      setDisplayCurrency,
      usdToPkr,
      rates,
      saveUsdToPkr,
      ratesLoading,
      convertToDisplay,
      format,
      formatDisplay,
      formatNative,
    }),
    [
      displayCurrency,
      setDisplayCurrency,
      usdToPkr,
      rates,
      saveUsdToPkr,
      ratesLoading,
      convertToDisplay,
      format,
      formatDisplay,
      formatNative,
    ],
  );

  return (
    <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within CurrencyProvider');
  }
  return context;
}
