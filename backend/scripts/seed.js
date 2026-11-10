/* Demo data for BatiRent.  Usage:  npm run seed
 * Wipes the database named in MONGODB_URI and loads 3 competing yards (Yaoundé, Douala, Kribi)
 * with realistic contracts: overdue, expiring, partial returns, damage, disputes, settled history.
 * Everything is created through the real services, so stock invariants hold from the first screen.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('../src/config');
const M = require('../src/models');
const svc = require('../src/services/contractService');
const { runOverdueSweep } = require('../src/jobs/overdueJob');
const { startOfDay, addDays } = require('../src/utils/dates');
const { UPLOAD_ROOT } = require('../src/services/storage');

const PASSWORD = 'Demo@2026';
const NOW = new Date();
const day = (n, hours = 12) => new Date(addDays(startOfDay(NOW), n).getTime() + (hours - 1) * 3600 * 1000 * 0 + hours * 3600 * 1000 - 0);
// day(n) = noon, Cameroon time, n days from today

// ---------- demo photos (SVG placeholders so the demo works offline) ----------
const PHOTO_DIR = path.join(UPLOAD_ROOT, 'seed');
function writePhoto(name, title, subtitle, accent) {
  fs.mkdirSync(PHOTO_DIR, { recursive: true });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9b6ae"/><stop offset="1" stop-color="#8d8a82"/></linearGradient></defs>
<rect width="800" height="600" fill="url(#g)"/><rect y="470" width="800" height="130" fill="#6e6a60"/>
<g stroke="#2b3138" stroke-width="14" fill="none" stroke-linecap="square">
<rect x="210" y="110" width="380" height="340"/><line x1="210" y1="280" x2="590" y2="280"/><line x1="210" y1="110" x2="590" y2="450"/><line x1="590" y1="110" x2="210" y2="450"/></g>
<g stroke="${accent}" stroke-width="9" fill="none" stroke-linecap="round"><path d="M395 230 l22 30 -18 22 26 36 -14 24"/></g>
<circle cx="417" cy="260" r="46" fill="none" stroke="${accent}" stroke-width="5" stroke-dasharray="10 8"/>
<rect x="0" y="540" width="800" height="60" fill="#12171c" opacity=".78"/>
<text x="24" y="578" font-family="Arial,sans-serif" font-size="22" fill="#fff">${title}</text>
<text x="776" y="578" font-family="Arial,sans-serif" font-size="18" fill="#c9ccd1" text-anchor="end">${subtitle}</text></svg>`;
  fs.writeFileSync(path.join(PHOTO_DIR, `${name}.svg`), svg);
  return {
    url: `${config.publicApiUrl}/uploads/seed/${name}.svg`,
    sha256: crypto.createHash('sha256').update(svg).digest('hex'),
    bytes: Buffer.byteLength(svg),
  };
}

// ---------- catalogue ----------
// [fr, en, category, total, unitValue, dailyRate]
const CATALOGUE = {
  full: [
    ["Cadre d'échafaudage acier 1,70 m", 'Steel scaffolding frame 1.70 m', 'Scaffolding', 600, 28000, 150],
    ["Croisillon d'échafaudage", 'Scaffolding cross brace', 'Scaffolding', 1200, 6500, 40],
    ['Plancher métallique 2 m', 'Steel platform deck 2 m', 'Scaffolding', 400, 22000, 120],
    ['Vérin de pied réglable', 'Adjustable base jack', 'Scaffolding', 500, 9000, 50],
    ['Étai télescopique 3,5 m', 'Telescopic prop 3.5 m', 'Formwork_Props', 800, 18000, 90],
    ['Coffrage métallique de poteau', 'Steel column formwork', 'Formwork_Props', 60, 120000, 1500],
    ['Bétonnière 350 L', 'Concrete mixer 350 L', 'Heavy_Machinery', 12, 650000, 12000],
    ['Compacteur à plaque', 'Plate compactor', 'Heavy_Machinery', 6, 1400000, 25000],
    ['Groupe électrogène 20 kVA', 'Generator 20 kVA', 'Heavy_Machinery', 4, 4800000, 65000],
    ['Mini-pelle 1,8 t', 'Mini excavator 1.8 t', 'Heavy_Machinery', 2, 24000000, 180000],
    ['Vibreur à béton', 'Concrete vibrator', 'Hand_Tools', 15, 280000, 4000],
    ['Marteau-piqueur', 'Demolition hammer', 'Hand_Tools', 10, 450000, 8000],
    ['Brouette renforcée', 'Heavy-duty wheelbarrow', 'Hand_Tools', 40, 35000, 500],
  ],
  small: [
    ["Cadre d'échafaudage acier 1,70 m", 'Steel scaffolding frame 1.70 m', 'Scaffolding', 300, 28000, 150],
    ["Croisillon d'échafaudage", 'Scaffolding cross brace', 'Scaffolding', 600, 6500, 40],
    ['Étai télescopique 3,5 m', 'Telescopic prop 3.5 m', 'Formwork_Props', 400, 18000, 90],
    ['Bétonnière 350 L', 'Concrete mixer 350 L', 'Heavy_Machinery', 6, 650000, 12000],
    ['Groupe électrogène 20 kVA', 'Generator 20 kVA', 'Heavy_Machinery', 2, 4800000, 65000],
    ['Vibreur à béton', 'Concrete vibrator', 'Hand_Tools', 8, 280000, 4000],
  ],
};

const TENANTS = [
  { code: 'YDE', name: 'Yaoundé Location Matériel (YLM)', city: 'Yaoundé', phone: '+237 222 21 40 55', address: 'Carrefour Warda, Route de Mfou, Yaoundé', slug: 'ylm', catalogue: 'full' },
  { code: 'DLA', name: 'Douala Chantier Pro', city: 'Douala', phone: '+237 233 42 18 90', address: 'Zone industrielle de Bassa, Douala', slug: 'dcp', catalogue: 'small' },
  { code: 'KRB', name: 'Kribi Port Équipements', city: 'Kribi', phone: '+237 233 46 02 71', address: 'Route du Port Autonome, Kribi', slug: 'kpe', catalogue: 'small' },
];

async function main() {
  await mongoose.connect(config.mongoUri);
  console.log('[seed] connected, wiping collections…');
  await Promise.all(Object.values(M).map((m) => m.deleteMany({})));
  await M.RentalContract.syncIndexes();
  await M.User.syncIndexes();
  await M.Tenant.syncIndexes();

  const hash = await bcrypt.hash(PASSWORD, 10);
  const photos = {
    crack: writePhoto('cadre-fissure', 'Cadre fissuré - soudure rompue', 'Bastos - retour chantier', '#e0463b'),
    bent: writePhoto('betonniere-cuve', 'Cuve de bétonnière bosselée', 'Retour chantier', '#e0463b'),
    rust: writePhoto('etai-rouille', 'Étais - corrosion avancée', 'Retour chantier', '#d8892b'),
    overview: writePhoto('vue-ensemble', 'Vue d’ensemble du chargement retourné', 'Contrôle à la grille', '#3d8f6b'),
  };

  for (const t of TENANTS) {
    const tenant = await M.Tenant.create({ name: t.name, code: t.code, city: t.city, phone: t.phone, address: t.address });
    const [owner, manager, operator] = await M.User.create([
      { tenantId: tenant._id, name: `Directeur ${t.city}`, email: `owner@${t.slug}.batirent.cm`, role: 'owner', passwordHash: hash },
      { tenantId: tenant._id, name: `Responsable logistique ${t.city}`, email: `manager@${t.slug}.batirent.cm`, role: 'manager', passwordHash: hash },
      { tenantId: tenant._id, name: `Opérateur terrain ${t.city}`, email: `operator@${t.slug}.batirent.cm`, role: 'operator', passwordHash: hash },
    ]);

    const assets = {};
    for (const [fr, en, cat, total, value, rate] of CATALOGUE[t.catalogue]) {
      assets[fr] = await M.AssetInventory.create({
        tenantId: tenant._id, itemName: fr, itemNameEn: en, category: cat,
        totalOwnedQty: total, currentAvailableQty: total, unitValueXAF: value, defaultDailyRateXAF: rate,
      });
    }
    const a = (name) => {
      const hit = Object.values(assets).find((x) => x.itemName.startsWith(name));
      if (!hit) throw new Error(`asset ${name} missing`);
      return String(hit._id);
    };
    const items = (list) => list.map(([n, q, rate]) => ({ assetId: a(n), quantity: q, ...(rate ? { dailyRatePerUnitXAF: rate } : {}) }));
    const make = (c) => svc.createContract(tenant, manager, c);
    const ret = (contract, lines, extra = {}, at) =>
      svc.processReturn(tenant._id, extra.asManager ? manager : operator, contract._id,
        { lines: lines.map(([n, good, dmg, lost, note]) => ({ assetId: a(n), goodQty: good, damagedQty: dmg || 0, lostQty: lost || 0, note })), ...extra },
        { canAssessDamage: Boolean(extra.asManager), now: at });

    if (t.code === 'YDE') {
      // ---- settled history (created first so the stock is back in the yard) ----
      let c = await make({ clientName: 'Paul Essomba', clientCompany: 'Lycée Technique de Ngoa-Ekellé (travaux)', clientPhone: '677 41 20 33', siteLocation: 'Bloc pédagogique Ngoa-Ekellé', siteCity: 'Yaoundé', startDate: day(-42), expectedReturnDate: day(-30), securityDepositXAF: 300000, items: items([['Cadre', 80], ['Croisillon', 160], ['Plancher', 40]]) });
      await ret(c, [['Cadre', 80], ['Croisillon', 160], ['Plancher', 40]], { notes: 'Retour complet, matériel propre.', clientSignatureName: 'Paul Essomba', photos: [photos.overview] }, day(-30, 15));

      c = await make({ clientName: 'Hervé Kamga', clientCompany: 'Kamga & Associés BTP', clientPhone: '699 18 07 62', foremanName: 'Chef de chantier Nkou', siteLocation: 'Immeuble R+3 Mvan', siteCity: 'Yaoundé', startDate: day(-52), expectedReturnDate: day(-38), securityDepositXAF: 450000, items: items([['Cadre', 120], ['Croisillon', 240], ['Vérin', 60]]) });
      await ret(c, [['Cadre', 111, 6, 3, 'Soudures rompues sur 6 cadres, 3 manquants'], ['Croisillon', 240], ['Vérin', 60]], {
        notes: 'Retour avec 3 jours de retard. 6 cadres fissurés, 3 non restitués.', clientSignatureName: 'Hervé Kamga',
        damageChargeXAF: 90000, asManager: true, photos: [{ ...photos.crack, caption: 'Cadre fissuré' }, photos.overview],
      }, day(-35, 10));

      c = await make({ clientName: 'Didier Fouda', clientPhone: '655 90 31 14', siteLocation: 'Dalle villa Nkolbisson', siteCity: 'Yaoundé', startDate: day(-25), expectedReturnDate: day(-18), securityDepositXAF: 250000, items: items([['Bétonnière', 2], ['Vibreur', 1]]) });
      await ret(c, [['Bétonnière', 1, 1, 0, 'Cuve bosselée'], ['Vibreur', 1]], { notes: 'Une bétonnière à réparer.', damageChargeXAF: 60000, asManager: true, photos: [{ ...photos.bent, caption: 'Cuve bosselée' }] }, day(-18, 9));

      // ---- live portfolio ----
      c = await make({ clientName: 'Marcel Tchoupo', clientCompany: 'Tchoupo Construction SARL', clientPhone: '677 55 12 80', foremanName: 'Contremaître Abanda', siteLocation: 'Immeuble R+5 Bastos - Phase 2', siteCity: 'Yaoundé', startDate: day(-24), expectedReturnDate: day(-9), securityDepositXAF: 1200000, items: items([['Cadre', 220], ['Croisillon', 400], ['Plancher', 120], ['Vérin', 80]]) });
      await ret(c, [['Cadre', 60, 4, 0, '4 cadres déformés'], ['Croisillon', 100]], { notes: 'Retour partiel : le reste est encore sur le site.', clientSignatureName: 'Abanda J.', photos: [{ ...photos.crack, caption: 'Cadres déformés' }] }, day(-2, 11));

      await make({ clientName: 'Sandrine Ngono', clientCompany: 'Ngono & Fils Génie Civil', clientPhone: '694 22 08 17', foremanName: 'Chef Owona', siteLocation: 'Villa duplex Odza', siteCity: 'Yaoundé', startDate: day(-18), expectedReturnDate: day(-4), securityDepositXAF: 400000, items: items([['Bétonnière', 2], ['Vibreur', 1], ['Étai', 60]]) });

      c = await make({ clientName: 'Étienne Mbarga', clientPhone: '652 70 44 09', siteLocation: 'Dalle maison - Mfou', siteCity: 'Mfou', startDate: day(-30), expectedReturnDate: day(-12), securityDepositXAF: 200000, items: items([['Étai', 150], ['Brouette', 4]]) });
      await svc.setDispute(tenant._id, manager, c._id, 'Le client conteste le nombre d’étais livrés (affirme 120 au lieu de 150).');

      await make({ clientName: 'Fabrice Atangana', clientCompany: 'Batiplus Cameroun', clientPhone: '699 03 55 21', foremanName: 'Chef Manga', siteLocation: 'Extension hôtel - Mont Fébé', siteCity: 'Yaoundé', startDate: day(-13), expectedReturnDate: day(1), securityDepositXAF: 900000, items: items([['Cadre', 150], ['Croisillon', 300], ['Plancher', 90]]) });
      await make({ clientName: 'Aïssatou Bello', clientPhone: '677 12 90 05', siteLocation: 'Rénovation boutique - Mokolo', siteCity: 'Yaoundé', startDate: day(-7), expectedReturnDate: day(0), securityDepositXAF: 120000, items: items([['Étai', 40], ['Brouette', 6]]) });
      await make({ clientName: 'Joseph Zoa', clientCompany: 'Zoa & Frères BTP', clientPhone: '698 31 76 48', foremanName: 'Chef Ebogo', siteLocation: 'Route d’accès - Nsimeyong', siteCity: 'Yaoundé', startDate: day(-4), expectedReturnDate: day(6), securityDepositXAF: 1500000, items: items([['Compacteur', 1], ['Groupe', 1], ['Marteau', 2]]) });
      await make({ clientName: 'Carine Ndzana', clientCompany: 'CAMBAT Ingénierie', clientPhone: '655 08 29 63', foremanName: 'Ing. Fotso', siteLocation: 'Culée de pont - Mfoundi', siteCity: 'Yaoundé', startDate: day(-3), expectedReturnDate: day(14), securityDepositXAF: 1000000, items: items([['Coffrage', 30], ['Étai', 200], ['Cadre', 100]]) });
      await make({ clientName: 'Thierry Mvondo', clientPhone: '690 44 18 72', siteLocation: 'Fondations - Ekounou', siteCity: 'Yaoundé', startDate: day(-1), expectedReturnDate: day(3), securityDepositXAF: 150000, items: items([['Bétonnière', 1], ['Brouette', 8]]) });
    } else if (t.code === 'DLA') {
      let c = await make({ clientName: 'Ernest Manga', clientCompany: 'Littoral Bâtiment SA', clientPhone: '699 70 11 28', siteLocation: 'Entrepôt Bonabéri', siteCity: 'Douala', startDate: day(-30), expectedReturnDate: day(-20), securityDepositXAF: 350000, items: items([['Cadre', 100], ['Croisillon', 200]]) });
      await ret(c, [['Cadre', 100], ['Croisillon', 200]], { photos: [photos.overview], notes: 'Retour complet.' }, day(-20, 14));
      await make({ clientName: 'Pauline Eyoum', clientCompany: 'Eyoum Construction', clientPhone: '677 80 23 99', siteLocation: 'Résidence Bonamoussadi', siteCity: 'Douala', startDate: day(-20), expectedReturnDate: day(-6), securityDepositXAF: 600000, items: items([['Cadre', 140], ['Croisillon', 280], ['Étai', 80]]) });
      await make({ clientName: 'Samuel Njoh', clientPhone: '655 33 61 07', siteLocation: 'Villa Akwa Nord', siteCity: 'Douala', startDate: day(-10), expectedReturnDate: day(-2), securityDepositXAF: 150000, items: items([['Bétonnière', 2], ['Vibreur', 1]]) });
      await make({ clientName: 'Rosine Tabi', clientCompany: 'Tabi Logistics', clientPhone: '698 14 50 82', siteLocation: 'Hangar Zone Bassa', siteCity: 'Douala', startDate: day(-2), expectedReturnDate: day(9), securityDepositXAF: 500000, items: items([['Groupe', 1], ['Étai', 120]]) });
    } else {
      await make({ clientName: 'Olivier Ekani', clientCompany: 'Port Services Kribi', clientPhone: '677 02 48 15', siteLocation: 'Base vie - Port en eau profonde', siteCity: 'Kribi', startDate: day(-16), expectedReturnDate: day(-5), securityDepositXAF: 800000, items: items([['Cadre', 120], ['Croisillon', 240], ['Groupe', 1]]) });
      await make({ clientName: 'Mireille Bidjocka', clientPhone: '690 61 27 34', siteLocation: 'Résidence balnéaire Londji', siteCity: 'Kribi', startDate: day(-5), expectedReturnDate: day(2), securityDepositXAF: 300000, items: items([['Bétonnière', 1], ['Étai', 100]]) });
      await make({ clientName: 'Armand Tsimi', clientCompany: 'Tsimi BTP', clientPhone: '655 73 08 91', siteLocation: 'Dalle commerciale Mpalla', siteCity: 'Kribi', startDate: day(-1), expectedReturnDate: day(12), securityDepositXAF: 250000, items: items([['Cadre', 60], ['Vibreur', 2]]) });
    }
    console.log(`[seed] ${t.name}: assets=${Object.keys(assets).length}`);
  }

  // Run the same sweep the cron runs: flags overdue, stores exposure, writes the SMS log.
  await runOverdueSweep();

  // Final proof that stock matches contracts.
  const dash = require('../src/services/dashboardService');
  for (const t of await M.Tenant.find({})) {
    const r = await dash.integrity(t._id);
    console.log(`[seed] integrity ${t.code}: ${r.ok ? 'OK' : 'DISCREPANCY ' + JSON.stringify(r.discrepancies)}`);
  }
  console.log('\nDemo logins (password for all: ' + PASSWORD + ')');
  for (const t of TENANTS) console.log(`  ${t.name}\n    owner@${t.slug}.batirent.cm | manager@${t.slug}.batirent.cm | operator@${t.slug}.batirent.cm`);
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
