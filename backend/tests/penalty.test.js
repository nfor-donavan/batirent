const test = require('node:test');
const assert = require('node:assert');
const P = require('../src/services/penalty');
const { startOfDay, addDays } = require('../src/utils/dates');
const { normalizePhone } = require('../src/utils/phone');

const day = (n) => addDays(startOfDay(new Date('2026-10-12T10:00:00Z')), n);

function contract(over = {}) {
  return {
    itemsLeased: [
      { quantity: 100, dailyRatePerUnitXAF: 150, returnedGoodQty: 0, returnedDamagedQty: 0, lostQty: 0, replacementValuePerUnitXAF: 25000 },
      { quantity: 2, dailyRatePerUnitXAF: 12000, returnedGoodQty: 0, returnedDamagedQty: 0, lostQty: 0, replacementValuePerUnitXAF: 450000 },
    ],
    startDate: day(-10),
    expectedReturnDate: day(-3),
    penaltyMultiplier: 1.5,
    penaltyBaseXAF: 0,
    securityDepositXAF: 100000,
    plannedRentalXAF: 0,
    ...over,
  };
}

test('daily overdue rate = sum(qty x rate) x multiplier', () => {
  // (100*150 + 2*12000) = 39000 ; x1.5 = 58500
  assert.equal(P.dailyOverdueRate(contract()), 58500);
});

test('no penalty on the due date itself, 1 day late = 1 day of penalty', () => {
  const c = contract({ expectedReturnDate: day(0) });
  assert.equal(P.exposureAt(c, day(0)), 0);
  assert.equal(P.exposureAt(c, addDays(day(0), 1)), 58500);
});

test('exposure accumulates per calendar day', () => {
  assert.equal(P.exposureAt(contract(), day(0)), 3 * 58500);
});

test('partial return freezes penalty already accrued and lowers the rate', () => {
  const c = contract();
  const now = day(0); // 3 days overdue
  const cp = P.checkpointAt(c, now);
  assert.equal(cp.penaltyBaseXAF, 3 * 58500);
  const after = { ...c, ...cp };
  after.itemsLeased = c.itemsLeased.map((l, i) => (i === 0 ? { ...l, returnedGoodQty: 60 } : l));
  // outstanding now 40 frames + 2 mixers: (40*150 + 24000) * 1.5 = 45000/day
  assert.equal(P.dailyOverdueRate(after), 45000);
  assert.equal(P.exposureAt(after, now), 3 * 58500);
  assert.equal(P.exposureAt(after, addDays(now, 2)), 3 * 58500 + 2 * 45000);
});

test('returning before the due date creates no penalty', () => {
  const c = contract({ expectedReturnDate: day(5) });
  const cp = P.checkpointAt(c, day(0));
  assert.equal(cp.penaltyBaseXAF, 0);
  assert.equal(P.exposureAt({ ...c, ...cp }, day(0)), 0);
});

test('exposure is frozen after the final return', () => {
  const c = contract({ actualReturnDate: day(-1) });
  c.itemsLeased.forEach((l) => (l.returnedGoodQty = l.quantity));
  assert.equal(P.exposureAt(c, day(30)), 0); // rate is 0 once everything is back
  const c2 = contract({ penaltyBaseXAF: 117000, actualReturnDate: day(-1), penaltyCheckpointDate: day(-1) });
  c2.itemsLeased.forEach((l) => (l.returnedGoodQty = l.quantity));
  assert.equal(P.exposureAt(c2, day(30)), 117000);
});

test('derived status', () => {
  assert.equal(P.derivedStatus(contract(), day(0)), 'Overdue');
  assert.equal(P.derivedStatus(contract({ expectedReturnDate: day(0) }), day(0)), 'Active');
  const done = contract();
  done.itemsLeased.forEach((l) => (l.returnedGoodQty = l.quantity));
  assert.equal(P.derivedStatus(done, day(0)), 'Returned_Settled');
});

test('settlement: charges minus caution', () => {
  const c = contract({ plannedRentalXAF: 273000, damageChargesXAF: 20000 });
  c.itemsLeased[0].lostQty = 2; // 2 x 25000
  const s = P.settlement(c, day(0));
  // outstanding after loss: 98 frames + 2 mixers => (98*150+24000)*1.5*3 days
  const penalty = Math.round((98 * 150 + 24000) * 1.5) * 3;
  assert.equal(s.penaltyXAF, penalty);
  assert.equal(s.lostItemsXAF, 50000);
  assert.equal(s.totalChargesXAF, 273000 + penalty + 50000 + 20000);
  assert.equal(s.balanceDueXAF, s.totalChargesXAF - 100000);
  assert.equal(s.refundDueXAF, 0);
});

test('planned rental is inclusive of start and due day', () => {
  const r = P.plannedRental([{ quantity: 10, dailyRatePerUnitXAF: 100 }], day(0), day(6));
  assert.equal(r.days, 7);
  assert.equal(r.amount, 7000);
});

test('phone normalisation', () => {
  assert.equal(normalizePhone('681 877 422'), '+237681877422');
  assert.equal(normalizePhone('+237 222 21 33 44'), '+237222213344');
  assert.equal(normalizePhone('00237699000111'), '+237699000111');
  assert.equal(normalizePhone('12345'), null);
});
