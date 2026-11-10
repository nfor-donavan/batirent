// SMS notifications. Messages are always recorded in SmsLog so managers can prove a client was
// warned. Delivery goes through a pluggable provider (console for demos, webhook for a gateway).
const config = require('../config');
const { SmsLog } = require('../models');

const fmt = (n) => new Intl.NumberFormat('fr-FR').format(Math.round(n)).replace(/\u202f|\u00a0/g, ' ');
const fmtDate = (d, lang) =>
  new Date(d).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR', { timeZone: 'Africa/Douala' });

const templates = {
  fr: {
    expiry_reminder: (c, t, daysLeft) =>
      `${t.name}: contrat ${c.contractNumber} - retour du materiel prevu le ${fmtDate(c.expectedReturnDate, 'fr')} ` +
      `(${daysLeft} jour${daysLeft > 1 ? 's' : ''}). Merci de preparer la restitution. Info: ${t.phone || ''}`.trim(),
    overdue_notice: (c, t, days, exposure) =>
      `${t.name}: contrat ${c.contractNumber} en RETARD de ${days} jour${days > 1 ? 's' : ''}. ` +
      `Penalite cumulee: ${fmt(exposure)} FCFA. Restituez le materiel au plus vite. ${t.phone || ''}`.trim(),
    return_receipt: (c, t, summary) =>
      `${t.name}: retour enregistre pour ${c.contractNumber}. ${summary}`,
  },
  en: {
    expiry_reminder: (c, t, daysLeft) =>
      `${t.name}: contract ${c.contractNumber} - equipment due back on ${fmtDate(c.expectedReturnDate, 'en')} ` +
      `(${daysLeft} day${daysLeft > 1 ? 's' : ''}). Please prepare the return. ${t.phone || ''}`.trim(),
    overdue_notice: (c, t, days, exposure) =>
      `${t.name}: contract ${c.contractNumber} is ${days} day${days > 1 ? 's' : ''} OVERDUE. ` +
      `Accrued penalty: ${fmt(exposure)} XAF. Please return the equipment immediately. ${t.phone || ''}`.trim(),
    return_receipt: (c, t, summary) =>
      `${t.name}: return recorded for ${c.contractNumber}. ${summary}`,
  },
};

async function deliver(to, message) {
  if (config.sms.provider === 'webhook' && config.sms.webhookUrl) {
    const res = await fetch(config.sms.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.sms.webhookToken ? { Authorization: `Bearer ${config.sms.webhookToken}` } : {}),
      },
      body: JSON.stringify({ to, message }),
    });
    if (!res.ok) throw new Error(`SMS webhook responded ${res.status}`);
    return 'sent';
  }
  console.log(`[sms:console] -> ${to}: ${message}`);
  return 'logged';
}

async function sendSms({ tenant, contract, kind, message }) {
  const base = { tenantId: tenant._id, contractId: contract._id, to: contract.clientPhone, kind, message, provider: config.sms.provider };
  try {
    const status = await deliver(contract.clientPhone, message);
    await SmsLog.create({ ...base, status });
    return true;
  } catch (err) {
    await SmsLog.create({ ...base, status: 'failed', error: err.message });
    return false;
  }
}

module.exports = { sendSms, templates };
