// Integration smoke test against a RUNNING API + seeded DB:  node tests/smoke.integration.js
const BASE = process.env.API || 'http://localhost:4000';
const assert = require('node:assert');
const j = async (path, opts = {}, token) => {
  const res = await fetch(BASE + path, { ...opts, headers: { ...(opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
const login = async (email) => (await j('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password: 'Demo@2026' }) })).body.token;

(async () => {
  const mgr = await login('manager@ylm.batirent.cm');
  const op = await login('operator@ylm.batirent.cm');
  const dla = await login('manager@dcp.batirent.cm');
  assert(mgr && op && dla, 'logins');

  const sum = await j('/api/dashboard/summary', {}, mgr);
  assert.equal(sum.status, 200);
  console.log('utilisation', Math.round(sum.body.kpis.utilizationRate * 100) + '%', 'exposure', sum.body.kpis.totalOverdueExposureXAF, 'overdue', sum.body.kpis.overdueContracts);

  // tenant isolation: Douala manager sees none of Yaoundé's contracts
  const yde = (await j('/api/contracts', {}, mgr)).body.items;
  const dlaList = (await j('/api/contracts', {}, dla)).body.items;
  assert(yde.length > 0 && dlaList.length > 0);
  assert(!dlaList.some((c) => c.contractNumber.includes('YDE')), 'isolation');
  const foreign = await j('/api/contracts/' + yde[0]._id, {}, dla);
  assert.equal(foreign.status, 404, 'cross-tenant read blocked');

  // role enforcement
  const bad = await j('/api/dashboard/summary', {}, op);
  assert.equal(bad.status, 403);

  // oversell is rejected, and a failed multi-line contract releases what it reserved
  const assets = (await j('/api/assets', {}, mgr)).body.items;
  const frame = assets.find((a) => a.itemName.startsWith('Cadre'));
  const brace = assets.find((a) => a.itemName.startsWith('Croisillon'));
  const before = (await j('/api/assets', {}, mgr)).body.items.find((a) => a._id === frame._id).currentAvailableQty;
  const payload = (items) => JSON.stringify({ clientName: 'Test Client', clientPhone: '677000111', siteLocation: 'Test', startDate: new Date().toISOString(), expectedReturnDate: new Date(Date.now() + 5 * 864e5).toISOString(), securityDepositXAF: 1000, items });
  const over = await j('/api/contracts', { method: 'POST', body: payload([{ assetId: frame._id, quantity: 10 }, { assetId: brace._id, quantity: 999999 }]) }, mgr);
  assert.equal(over.status, 409); assert.equal(over.body.error.code, 'INSUFFICIENT_STOCK');
  const after = (await j('/api/assets', {}, mgr)).body.items.find((a) => a._id === frame._id).currentAvailableQty;
  assert.equal(after, before, 'rollback released the reserved frames');

  // Concurrent race for the same stock: exactly one contract may win.
  // This relies on MongoDB's single-document atomicity, so it only runs against real MongoDB
  // (Atlas / mongod). Mongo-compatible emulators such as FerretDB-SQLite are not atomic here.
  const avail = after;
  let winner;
  if (process.env.REAL_MONGO === '1') {
    const race = await Promise.all([1, 2, 3].map(() => j('/api/contracts', { method: 'POST', body: payload([{ assetId: frame._id, quantity: avail }]) }, mgr)));
    assert.equal(race.filter((r) => r.status === 201).length, 1, 'exactly one concurrent contract wins');
    winner = race.find((r) => r.status === 201).body;
    console.log('race ok, contract', winner.contractNumber);
  } else {
    console.log('race test skipped (set REAL_MONGO=1 against a real MongoDB)');
    const one = await j('/api/contracts', { method: 'POST', body: payload([{ assetId: frame._id, quantity: avail }]) }, mgr);
    assert.equal(one.status, 201, JSON.stringify(one.body));
    winner = one.body;
    const second = await j('/api/contracts', { method: 'POST', body: payload([{ assetId: frame._id, quantity: 1 }]) }, mgr);
    assert.equal(second.status, 409, 'no stock left after the first contract took everything');
  }

  // return with photo (multipart) by the field operator
  const fd = new FormData();
  fd.append('lines', JSON.stringify([{ assetId: frame._id, goodQty: avail - 5, damagedQty: 2 }]));
  fd.append('photoMeta', JSON.stringify([{ assetId: frame._id, caption: 'cadre fissuré' }]));
  fd.append('photos', new Blob([Buffer.from('/9j/4AAQSkZJRg==', 'base64')], { type: 'image/jpeg' }), 'p.jpg');
  const noPhoto = new FormData();
  noPhoto.append('lines', JSON.stringify([{ assetId: frame._id, damagedQty: 1 }]));
  const needPhoto = await j(`/api/contracts/${winner._id}/returns`, { method: 'POST', body: noPhoto }, op);
  assert.equal(needPhoto.body.error.code, 'PHOTO_REQUIRED_FOR_DAMAGE');
  const r = await j(`/api/contracts/${winner._id}/returns`, { method: 'POST', body: fd }, op);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.inspection.photos[0].sha256.length, 64);
  const tooMany = await j(`/api/contracts/${winner._id}/returns`, { method: 'POST', body: (() => { const f = new FormData(); f.append('lines', JSON.stringify([{ assetId: frame._id, goodQty: 5 }])); return f; })() }, op);
  assert.equal(tooMany.body.error.code, 'RETURN_EXCEEDS_OUTSTANDING');
  const fin = new FormData(); fin.append('lines', JSON.stringify([{ assetId: frame._id, goodQty: 3 }]));
  const done = await j(`/api/contracts/${winner._id}/returns`, { method: 'POST', body: fin }, op);
  assert.equal(done.body.contract.status, 'Returned_Settled');
  const again = await j(`/api/contracts/${winner._id}/returns`, { method: 'POST', body: (() => { const f = new FormData(); f.append('lines', JSON.stringify([{ assetId: frame._id, goodQty: 1 }])); return f; })() }, op);
  assert.equal(again.body.error.code, 'CONTRACT_CLOSED');

  const integ = await j('/api/dashboard/integrity', {}, mgr);
  console.log('integrity', integ.body.ok ? 'OK' : JSON.stringify(integ.body.discrepancies));
  assert(integ.body.ok);
  console.log('ALL SMOKE CHECKS PASSED');
})().catch((e) => { console.error('SMOKE FAILED:', e); process.exit(1); });
