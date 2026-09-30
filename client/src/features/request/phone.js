export function formatPhone(value) {
  let digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if (digits[0] === '7' || digits[0] === '8') digits = digits.slice(1);
  digits = digits.slice(0, 10);
  let formatted = '+7';
  if (digits.length) formatted += ' (' + digits.slice(0, 3);
  if (digits.length >= 3) formatted += ')';
  if (digits.length > 3) formatted += ' ' + digits.slice(3, 6);
  if (digits.length > 6) formatted += '-' + digits.slice(6, 8);
  if (digits.length > 8) formatted += '-' + digits.slice(8, 10);
  return formatted;
}
export const isCompletePhone = (value) => /^7\d{10}$/.test(value.replace(/\D/g, ''));
