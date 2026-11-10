// ---------------------------------------------------------------------------
// Cumulative Overdue Penalty Engine  (pure functions - no database access)
//
//   Daily Overdue Rate = sum(outstanding quantity x daily rate) x multiplier
//   Exposure           = penaltyBase + calendarDaysSinceCheckpoint x Daily Overdue Rate
//
// "Outstanding" excludes anything already returned or declared lost, so a site that hands back
// 40 of 50 frames stops accruing penalty on those 40 from that moment. Days before the partial
// return stay billed on the quantity that was really out (the checkpoint mechanism).
// ---------------------------------------------------------------------------
const { daysBetween } = require('../utils/dates');

function outstandingQty(line) {
  return (
    line.quantity -
    (line.returnedGoodQty || 0) -
    (line.returnedDamagedQty || 0) -
    (line.lostQty || 0)
  );
}

function totalOutstanding(contract) {
  return contract.itemsLeased.reduce((s, l) => s + Math.max(0, outstandingQty(l)), 0);
}

/** Normal (non-penalty) daily rent of what is still out. */
function dailyRent(contract) {
  return contract.itemsLeased.reduce(
    (s, l) => s + Math.max(0, outstandingQty(l)) * l.dailyRatePerUnitXAF,
    0
  );
}

/** Daily Overdue Rate = sum(qty x rate) x multiplier */
function dailyOverdueRate(contract) {
  const mult = contract.penaltyMultiplier || 1.5;
  return Math.round(dailyRent(contract) * mult);
}

function checkpointOf(contract) {
  return contract.penaltyCheckpointDate || contract.expectedReturnDate;
}

/** Whole calendar days past the due date (0 on the due date itself). */
function daysOverdue(contract, now = new Date()) {
  const end = contract.actualReturnDate || now;
  return Math.max(0, daysBetween(contract.expectedReturnDate, end));
}

/** Penalty currently owed on this contract. Frozen once everything is back (rate becomes 0). */
function exposureAt(contract, now = new Date()) {
  const base = contract.penaltyBaseXAF || 0;
  const days = Math.max(0, daysBetween(checkpointOf(contract), contract.actualReturnDate || now));
  return Math.round(base + days * dailyOverdueRate(contract));
}

/**
 * Freeze the penalty accrued so far (call BEFORE reducing outstanding quantities).
 * Returns the fields to $set on the contract.
 */
function checkpointAt(contract, at = new Date()) {
  const cp = checkpointOf(contract);
  const days = daysBetween(cp, at);
  if (days <= 0) {
    return { penaltyBaseXAF: contract.penaltyBaseXAF || 0, penaltyCheckpointDate: cp };
  }
  return {
    penaltyBaseXAF: Math.round((contract.penaltyBaseXAF || 0) + days * dailyOverdueRate(contract)),
    penaltyCheckpointDate: at,
  };
}

/** Planned rent for the contractual period (inclusive of start and due day, minimum 1 day). */
function plannedRental(lines, startDate, expectedReturnDate) {
  const days = Math.max(1, daysBetween(startDate, expectedReturnDate) + 1);
  const perDay = lines.reduce((s, l) => s + l.quantity * l.dailyRatePerUnitXAF, 0);
  return { days, amount: perDay * days };
}

function lostValue(contract) {
  return contract.itemsLeased.reduce(
    (s, l) => s + (l.lostQty || 0) * (l.replacementValuePerUnitXAF || 0),
    0
  );
}

/** Statement of account: what the client owes, minus the deposit held ("la caution"). */
function settlement(contract, now = new Date()) {
  const penalty = exposureAt(contract, now);
  const lost = lostValue(contract);
  const damage = contract.damageChargesXAF || 0;
  const rental = contract.plannedRentalXAF || 0;
  const total = rental + penalty + lost + damage;
  const deposit = contract.securityDepositXAF || 0;
  const balance = total - deposit; // > 0: client still owes; < 0: refund the client
  return {
    plannedRentalXAF: rental,
    penaltyXAF: penalty,
    lostItemsXAF: lost,
    damageChargesXAF: damage,
    totalChargesXAF: total,
    depositXAF: deposit,
    balanceDueXAF: Math.max(0, balance),
    refundDueXAF: Math.max(0, -balance),
  };
}

/** Status a contract should have based purely on dates and stock (ignores Disputed). */
function derivedStatus(contract, now = new Date()) {
  if (totalOutstanding(contract) === 0) return 'Returned_Settled';
  return daysBetween(contract.expectedReturnDate, now) > 0 ? 'Overdue' : 'Active';
}

/** Adds computed read-only fields for the clients. Works on plain objects. */
function enrich(contract, now = new Date()) {
  const c = typeof contract.toObject === 'function' ? contract.toObject() : contract;
  const open = c.status !== 'Returned_Settled';
  const total = c.itemsLeased.reduce((s, l) => s + l.quantity, 0);
  const outstanding = totalOutstanding(c);
  const span = Math.max(1, daysBetween(c.startDate, c.expectedReturnDate));
  const elapsed = Math.min(span, Math.max(0, daysBetween(c.startDate, now)));
  return {
    ...c,
    itemsLeased: c.itemsLeased.map((l) => ({ ...l, outstandingQty: outstandingQty(l) })),
    totalQty: total,
    outstandingQty: outstanding,
    daysOverdue: open ? daysOverdue(c, now) : daysOverdue(c, now),
    daysRemaining: open ? daysBetween(now, c.expectedReturnDate) : 0,
    progress: open ? elapsed / span : 1, // 0..1 of the rental period used (drives the warning ring)
    dailyRentXAF: dailyRent(c),
    dailyOverdueRateXAF: dailyOverdueRate(c),
    overdueExposureXAF: exposureAt(c, now),
  };
}

module.exports = {
  outstandingQty,
  totalOutstanding,
  dailyRent,
  dailyOverdueRate,
  daysOverdue,
  exposureAt,
  checkpointAt,
  plannedRental,
  lostValue,
  settlement,
  derivedStatus,
  enrich,
};
