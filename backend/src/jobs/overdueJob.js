// Daily sweep (node-cron): flags contracts Overdue, refreshes currentOverdueExposureXAF and sends SMS.
//
// FIX (Render reliability): the sweep is IDEMPOTENT. Running it twice, or catching up after the
// instance slept through its 06:00 slot, never double-bills or double-notifies, because exposure is
// recomputed from dates and each SMS is guarded by a per-contract marker. The server also runs the
// sweep once at boot as a catch-up. The dashboard additionally computes exposure live on read, so
// the numbers shown are right even if a run was missed.
const cron = require('node-cron');
const config = require('../config');
const { RentalContract, Tenant } = require('../models');
const P = require('../services/penalty');
const { dayIndex, daysBetween } = require('../utils/dates');
const { sendSms, templates } = require('../services/sms');

async function runOverdueSweep(now = new Date()) {
  const stats = { checked: 0, flaggedOverdue: 0, exposureUpdated: 0, reminders: 0, overdueNotices: 0 };
  const tenants = new Map((await Tenant.find({})).map((t) => [String(t._id), t]));
  const today = dayIndex(now);

  const cursor = RentalContract.find({ status: { $in: ['Active', 'Overdue', 'Disputed'] } }).cursor();
  for await (const contract of cursor) {
    stats.checked += 1;
    const tenant = tenants.get(String(contract.tenantId));
    if (!tenant) continue;
    const plain = contract.toObject();
    const exposure = P.exposureAt(plain, now);
    const days = P.daysOverdue(plain, now);
    const update = {};

    if (contract.currentOverdueExposureXAF !== exposure) {
      update.currentOverdueExposureXAF = exposure;
      stats.exposureUpdated += 1;
    }
    if (contract.status === 'Active' && days > 0) {
      update.status = 'Overdue';
      stats.flaggedOverdue += 1;
    }

    const lang = tenant.settings.smsLanguage || 'fr';
    const smsOn = tenant.settings.smsEnabled !== false && contract.status !== 'Disputed';

    // Reminder N days before the due date (once).
    const daysLeft = daysBetween(now, contract.expectedReturnDate);
    if (smsOn && days === 0 && daysLeft >= 0 && daysLeft <= tenant.settings.expiryReminderDays && !contract.expiryReminderSentAt) {
      const ok = await sendSms({ tenant, contract, kind: 'expiry_reminder', message: templates[lang].expiry_reminder(contract, tenant, daysLeft) });
      if (ok) { update.expiryReminderSentAt = now; stats.reminders += 1; }
    }

    // Overdue notices: each of the first 3 days, then every 3rd day. Never twice on the same day.
    if (smsOn && days > 0 && contract.lastOverdueNoticeDay !== today && (days <= 3 || days % 3 === 0)) {
      const ok = await sendSms({ tenant, contract, kind: 'overdue_notice', message: templates[lang].overdue_notice(contract, tenant, days, exposure) });
      if (ok) { update.lastOverdueNoticeDay = today; stats.overdueNotices += 1; }
    }

    if (Object.keys(update).length) await RentalContract.updateOne({ _id: contract._id }, { $set: update });
  }
  console.log('[overdue-sweep]', JSON.stringify(stats));
  return stats;
}

function startScheduler() {
  if (!config.enableCron) {
    console.log('[cron] disabled (ENABLE_CRON=false)');
    return;
  }
  cron.schedule(config.overdueCron, () => runOverdueSweep().catch((e) => console.error('[overdue-sweep] failed', e)), {
    timezone: config.cronTimezone,
  });
  console.log(`[cron] overdue sweep scheduled "${config.overdueCron}" (${config.cronTimezone})`);
  // Catch-up run: covers the case where the instance was asleep/restarting at the scheduled time.
  runOverdueSweep().catch((e) => console.error('[overdue-sweep] boot run failed', e));
}

module.exports = { runOverdueSweep, startScheduler };
