// Normalises Cameroonian numbers to E.164 (+237XXXXXXXXX). Accepts 6XXXXXXXX, 2XXXXXXXX, 237..., +237...
function normalizePhone(input) {
  if (!input) return null;
  const digits = String(input).replace(/[^\d+]/g, '');
  let d = digits.startsWith('+') ? digits.slice(1) : digits;
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('237') && d.length === 12) return `+${d}`;
  if (d.length === 9 && /^[62]/.test(d)) return `+237${d}`;
  return null;
}
module.exports = { normalizePhone };
