/**
 * Pakistani Mobile Number Utilities
 * Standard format: 03001234567 (11 digits, starting with 03)
 */

export function formatPakistaniMobile(phone: string | null | undefined): string {
  if (!phone) return '';
  const str = String(phone).trim();
  const digits = str.replace(/\D/g, '');

  // Case 1: 923XXXXXXXXX (12 digits) -> 03XXXXXXXXX
  if (digits.startsWith('92') && digits.length === 12) {
    return '0' + digits.slice(2);
  }
  // Case 2: 3XXXXXXXXX (10 digits) -> 03XXXXXXXXX
  if (digits.length === 10 && digits.startsWith('3')) {
    return '0' + digits;
  }
  // Case 3: 03XXXXXXXXX (11 digits)
  if (digits.length === 11 && digits.startsWith('03')) {
    return digits;
  }
  // Case 4: Longer string containing 923XXXXXXXXX
  if (digits.length > 11 && digits.includes('3')) {
    const idx = digits.indexOf('3');
    if (digits.length - idx === 10) {
      return '0' + digits.slice(idx);
    }
  }

  // Fallback: if starts with 03
  if (digits.startsWith('03') && digits.length >= 10) {
    return digits.slice(0, 11);
  }

  return str;
}

export function matchesPhoneSearch(phone: string | null | undefined, query: string): boolean {
  if (!phone || !query) return false;
  const q = query.trim();
  if (!q) return false;

  const formattedPhone = formatPakistaniMobile(phone);
  const rawPhone = String(phone);

  if (formattedPhone.toLowerCase().includes(q.toLowerCase())) return true;
  if (rawPhone.toLowerCase().includes(q.toLowerCase())) return true;

  const queryDigits = q.replace(/\D/g, '');
  const phoneDigits = formattedPhone.replace(/\D/g, '');
  const rawPhoneDigits = rawPhone.replace(/\D/g, '');

  if (queryDigits.length >= 2) {
    if (phoneDigits.includes(queryDigits)) return true;
    if (rawPhoneDigits.includes(queryDigits)) return true;

    if (queryDigits.startsWith('03') && rawPhoneDigits.includes(queryDigits.slice(1))) {
      return true;
    }
    if (queryDigits.startsWith('3') && phoneDigits.includes('0' + queryDigits)) {
      return true;
    }
  }

  return false;
}
