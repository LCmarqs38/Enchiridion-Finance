export const formatCurrency = (value: number): string => {
  const safeValue = Number.isFinite(value) ? value : 0;
  return safeValue.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
};

export const formatCurrencyShort = (value: number): string => {
  const safeValue = Number.isFinite(value) ? value : 0;
  if (Math.abs(safeValue) >= 1000) {
    return `R$ ${(safeValue / 1000).toFixed(1)}k`;
  }
  return formatCurrency(safeValue);
};

export const formatDate = (iso: string): string => {
  if (!iso) return '';
  const parts = iso.split('T')[0].split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}`;
};

export const formatDateLong = (iso: string): string => {
  if (!iso) return '';
  const parts = iso.split('T')[0].split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

export const todayISO = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const currentDateTimeStr = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};