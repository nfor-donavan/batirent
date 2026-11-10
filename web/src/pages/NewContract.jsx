import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useLoad, Spinner, ErrorNote, Icon, useToast } from '../components/ui.jsx';

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };

export default function NewContract() {
  const { t, money, num, name } = useI18n();
  const { tenant } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { data } = useLoad(() => api.assets(), []);
  const assets = data ? data.items : [];
  const [f, setF] = useState({ clientName: '', clientCompany: '', clientPhone: '', clientIdNumber: '', foremanName: '', siteLocation: '', siteCity: tenant.city === 'Other' ? '' : tenant.city, startDate: iso(new Date()), expectedReturnDate: iso(addDays(7)), securityDepositXAF: 0 });
  const [lines, setLines] = useState([{ assetId: '', quantity: 1, rate: '' }]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const byId = useMemo(() => Object.fromEntries(assets.map((a) => [a._id, a])), [assets]);
  const days = Math.max(1, Math.round((new Date(f.expectedReturnDate) - new Date(f.startDate)) / 864e5) + 1);
  const perDay = lines.reduce((s, l) => s + (byId[l.assetId] ? Number(l.quantity || 0) * Number(l.rate === '' ? byId[l.assetId].defaultDailyRateXAF : l.rate) : 0), 0);

  const setLine = (i, patch) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const pickAsset = (i, id) => setLine(i, { assetId: id, rate: '', quantity: 1 });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const items = lines.filter((l) => l.assetId).map((l) => ({ assetId: l.assetId, quantity: Number(l.quantity), ...(l.rate !== '' ? { dailyRatePerUnitXAF: Number(l.rate) } : {}) }));
      const c = await api.createContract({ ...f, securityDepositXAF: Number(f.securityDepositXAF), startDate: new Date(f.startDate + 'T12:00:00+01:00').toISOString(), expectedReturnDate: new Date(f.expectedReturnDate + 'T12:00:00+01:00').toISOString(), items });
      toast(t('newc.created', { n: c.contractNumber }));
      navigate(`/contracts/${c._id}`);
    } catch (err) { setError(err); setBusy(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  };

  if (!data) return <Spinner />;
  return (
    <form onSubmit={submit}>
      <Link to="/contracts" className="back"><Icon name="back" /> {t('common.back')}</Link>
      <div className="page-head"><h1>{t('newc.title')}</h1></div>
      <ErrorNote error={error} />
      <div className="grid-3" style={{ marginTop: error ? 16 : 0 }}>
        <div className="stack">
          <section className="card card-pad">
            <h3>{t('newc.client')}</h3>
            <div className="grid-form">
              <label className="field">{t('newc.clientName')}<input value={f.clientName} onChange={set('clientName')} required /></label>
              <label className="field">{t('newc.company')}<input value={f.clientCompany} onChange={set('clientCompany')} /></label>
              <label className="field">{t('newc.phone')}<input value={f.clientPhone} onChange={set('clientPhone')} inputMode="tel" required /><small>{t('newc.phoneHint')}</small></label>
              <label className="field">{t('newc.idNumber')}<input value={f.clientIdNumber} onChange={set('clientIdNumber')} /></label>
              <label className="field">{t('newc.siteLocation')}<input value={f.siteLocation} onChange={set('siteLocation')} required /></label>
              <label className="field">{t('newc.siteCity')}<input value={f.siteCity} onChange={set('siteCity')} /></label>
              <label className="field span-2">{t('newc.foreman')}<input value={f.foremanName} onChange={set('foremanName')} /></label>
            </div>
          </section>

          <section className="card card-pad">
            <h3>{t('newc.items')}</h3>
            <div className="table-wrap">
              <table className="lines-edit">
                <tbody>
                  {lines.map((l, i) => {
                    const a = byId[l.assetId];
                    return (
                      <tr key={i}>
                        <td style={{ minWidth: 240 }}>
                          <select className="input" value={l.assetId} onChange={(e) => pickAsset(i, e.target.value)} aria-label={t('newc.chooseAsset')}>
                            <option value="">{t('newc.chooseAsset')}</option>
                            {assets.map((x) => <option key={x._id} value={x._id} disabled={x.currentAvailableQty === 0}>{name(x)}</option>)}
                          </select>
                          {a && <span className="cell-sub">{t('newc.available', { n: num(a.currentAvailableQty) })}</span>}
                        </td>
                        <td style={{ width: 120 }}>
                          <input className="input" type="number" min="1" max={a ? a.currentAvailableQty : undefined} value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} aria-label={t('common.quantity')} />
                        </td>
                        <td style={{ width: 150 }}>
                          <input className="input" type="number" min="0" placeholder={a ? String(a.defaultDailyRateXAF) : ''} value={l.rate} onChange={(e) => setLine(i, { rate: e.target.value })} aria-label={t('newc.rate')} />
                          <span className="cell-sub">{t('newc.rate')}</span>
                        </td>
                        <td style={{ width: 40 }}>
                          {lines.length > 1 && <button type="button" className="icon-btn" onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label={t('common.remove')}><Icon name="x" /></button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button type="button" className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => setLines([...lines, { assetId: '', quantity: 1, rate: '' }])}><Icon name="plus" size={15} /> {t('newc.addItem')}</button>
          </section>
        </div>

        <div className="stack">
          <section className="card card-pad">
            <h3>{t('newc.period')}</h3>
            <div className="stack">
              <label className="field">{t('newc.start')}<input type="date" value={f.startDate} onChange={set('startDate')} required /></label>
              <label className="field">{t('newc.end')}<input type="date" value={f.expectedReturnDate} min={f.startDate} onChange={set('expectedReturnDate')} required /></label>
              <label className="field">{t('newc.deposit')}<input type="number" min="0" value={f.securityDepositXAF} onChange={set('securityDepositXAF')} required /></label>
            </div>
          </section>
          <section className="card card-pad">
            <h3>{t('newc.summary')}</h3>
            <table className="ledger"><tbody>
              <tr><td className="muted">{t('newc.plannedDays')}</td><td className="right">{days} {t('common.days')}</td></tr>
              <tr><td className="muted">{t('detail.cols.rate')} ({t('common.total')})</td><td className="right num">{money(perDay)}</td></tr>
              <tr className="sum big"><td>{t('newc.plannedRental')}</td><td className="right">{money(perDay * days)}</td></tr>
            </tbody></table>
            <p className="note note-warn" style={{ marginTop: 14 }}><Icon name="alert" /> <span>{t('newc.penaltyRule', { m: tenant.settings.penaltyMultiplier })}</span></p>
            <button className="btn btn-primary" disabled={busy} style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}>{t('newc.submit')}</button>
          </section>
        </div>
      </div>
    </form>
  );
}
