export function formatMoney(amount: number, currency: 'INR' | 'USD' | 'AED' = 'INR') {
  const settings = {
    INR: { locale: 'en-IN', symbol: '₹' },
    USD: { locale: 'en-US', symbol: '$' },
    AED: { locale: 'ar-AE', symbol: 'د.إ' }
  };
  const { locale } = settings[currency];
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
}

export function formatNumber(amount: number, locale = 'en-IN') {
  return new Intl.NumberFormat(locale).format(amount);
}
