import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useLoad, Spinner, ErrorNote, PipeGauge, Icon, Modal, useToast } from '../components/ui.jsx';

const CATS = ['Scaffolding', 'Formwork_Props', 'Heavy_Machinery', 'Hand_Tools'];

export default function Fleet() {
  const { t, num, money, pct, name } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const { data, error, loading, reload } = useLoad(() => api.assets({ q, ...(cat ? { category: cat } : {}) }), [q, cat]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [mErr, setMErr] = useState(null);
  const manager = user.role !== 'operator';

  const submit = async (fn, msg) => {
    setMErr(null);
    try { await fn(); toast(msg); setModal(null); reload(); } catch (e) { setMErr(e); }
  };
  const open = (m, init = {}) => { setForm(init); setMErr(null); setModal(m); };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <div className="page-head">
        <div><h1>{t('fleet.title')}</h1><p>{t('fleet.subtitle')}</p></div>
        {manager && <button className="btn btn-primary" onClick={() => open('add', { category: 'Scaffolding' })}><Icon name="plus" /> {t('fleet.add')}</button>}
      </div>
      <div className="row-wrap" style={{ marginBottom: 16 }}>
        <div className="chips">
          <button className={`chip ${cat === '' ? 'on' : ''}`} onClick={() => setCat('')}>{t('common.all')}</button>
          {CATS.map((c) => <button key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{t(`cat.${c}`)}</button>)}
        </div>
        <div className="spacer" />
        <div className="search" style={{ width: 280 }}><Icon name="search" /><input className="input" placeholder={t('fleet.searchPh')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('common.search')} /></div>
      </div>
      <ErrorNote error={error} />
      <div className="card table-wrap">
        {loading && !data ? <Spinner /> : (
          <table>
            <thead><tr>
              <th>{t('fleet.cols.item')}</th><th className="n">{t('fleet.cols.total')}</th><th className="n">{t('fleet.cols.yard')}</th><th className="n">{t('fleet.cols.out')}</th>
              <th style={{ width: 170 }}>{t('fleet.cols.usage')}</th><th className="n">{t('fleet.cols.lostDamaged')}</th><th className="n">{t('fleet.cols.value')}</th><th className="n">{t('fleet.cols.rate')}</th>{manager && <th />}
            </tr></thead>
            <tbody>
              {(data ? data.items : []).map((a) => (
                <tr key={a._id}>
                  <td><strong>{name(a)}</strong><span className="cell-sub">{t(`cat.${a.category}`)}</span></td>
                  <td className="n num" style={{ fontSize: 18 }}>{num(a.totalOwnedQty)}</td>
                  <td className="n num" style={{ fontSize: 18 }}>{num(a.currentAvailableQty)}</td>
                  <td className="n num" style={{ fontSize: 18, color: 'var(--amber)' }}>{num(a.deployedQty)}</td>
                  <td><PipeGauge cells={20} height={14} parts={[{ value: a.deployedQty, tone: 'site' }, { value: a.currentAvailableQty, tone: 'yard' }, { value: a.lostDamagedQty, tone: 'lost' }]} /><span className="cell-sub">{pct(a.utilizationRate)}</span></td>
                  <td className="n num" style={{ color: a.lostDamagedQty ? 'var(--red)' : undefined, fontSize: 18 }}>{num(a.lostDamagedQty)}{a.inRepairQty > 0 && <span className="cell-sub">{a.inRepairQty} {t('fleet.cols.repair').toLowerCase()}</span>}</td>
                  <td className="n num">{money(a.unitValueXAF)}</td>
                  <td className="n num">{money(a.defaultDailyRateXAF)}</td>
                  {manager && <td className="n" style={{ whiteSpace: 'nowrap' }}>
                    {a.inRepairQty > 0 && <button className="btn btn-sm" onClick={() => open('repair', { id: a._id, qty: a.inRepairQty, max: a.inRepairQty, label: name(a) })}>{t('fleet.repair')}</button>} {' '}
                    <button className="btn btn-sm" onClick={() => open('adjust', { id: a._id, delta: '', reason: '', label: name(a) })}>{t('fleet.adjust')}</button>
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal === 'add' && (
        <Modal title={t('fleet.add')} onClose={() => setModal(null)}>
          <div className="grid-form">
            <label className="field span-2">{t('fleet.name')}<input value={form.itemName || ''} onChange={set('itemName')} autoFocus /></label>
            <label className="field span-2">{t('fleet.nameEn')}<input value={form.itemNameEn || ''} onChange={set('itemNameEn')} /></label>
            <label className="field">{t('fleet.category')}<select value={form.category} onChange={set('category')}>{CATS.map((c) => <option key={c} value={c}>{t(`cat.${c}`)}</option>)}</select></label>
            <label className="field">{t('fleet.totalQty')}<input type="number" min="0" value={form.totalOwnedQty || ''} onChange={set('totalOwnedQty')} /></label>
            <label className="field">{t('fleet.unitValue')}<input type="number" min="0" value={form.unitValueXAF || ''} onChange={set('unitValueXAF')} /></label>
            <label className="field">{t('fleet.dailyRate')}<input type="number" min="0" value={form.defaultDailyRateXAF || ''} onChange={set('defaultDailyRateXAF')} /></label>
          </div>
          <div style={{ marginTop: 12 }}><ErrorNote error={mErr} /></div>
          <div className="modal-actions"><button className="btn" onClick={() => setModal(null)}>{t('common.cancel')}</button><button className="btn btn-primary" onClick={() => submit(() => api.createAsset(form), t('fleet.created'))}>{t('common.save')}</button></div>
        </Modal>
      )}
      {modal === 'adjust' && (
        <Modal title={`${t('fleet.adjust')} — ${form.label}`} onClose={() => setModal(null)}>
          <p className="muted" style={{ marginBottom: 14 }}>{t('fleet.adjustHint')}</p>
          <div className="grid-form">
            <label className="field">{t('fleet.delta')}<input type="number" value={form.delta} onChange={set('delta')} autoFocus /></label>
            <label className="field">{t('fleet.reason')}<input value={form.reason} onChange={set('reason')} /></label>
          </div>
          <div style={{ marginTop: 12 }}><ErrorNote error={mErr} /></div>
          <div className="modal-actions"><button className="btn" onClick={() => setModal(null)}>{t('common.cancel')}</button><button className="btn btn-primary" onClick={() => submit(() => api.adjustAsset(form.id, Number(form.delta), form.reason), t('fleet.updated'))}>{t('common.save')}</button></div>
        </Modal>
      )}
      {modal === 'repair' && (
        <Modal title={`${t('fleet.repair')} — ${form.label}`} onClose={() => setModal(null)}>
          <label className="field">{t('fleet.repairQty')}<input type="number" min="1" max={form.max} value={form.qty} onChange={set('qty')} autoFocus /></label>
          <div style={{ marginTop: 12 }}><ErrorNote error={mErr} /></div>
          <div className="modal-actions"><button className="btn" onClick={() => setModal(null)}>{t('common.cancel')}</button><button className="btn btn-primary" onClick={() => submit(() => api.repairAsset(form.id, Number(form.qty)), t('fleet.updated'))}>{t('common.confirm')}</button></div>
        </Modal>
      )}
    </>
  );
}
