import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useI18n } from '../i18n/index.jsx';
import { ByNexus } from '../components/Nexus.jsx';
import { useLoad, Spinner, ErrorNote, StatusBadge, Icon, Modal, useToast } from '../components/ui.jsx';

function ReturnModal({ contract, canAssess, onClose, onDone }) {
  const { t, num, name } = useI18n();
  const toast = useToast();
  const open = contract.itemsLeased.filter((l) => l.outstandingQty > 0);
  const [vals, setVals] = useState(Object.fromEntries(open.map((l) => [l.assetId, { good: 0, damaged: 0, lost: 0 }])));
  const [files, setFiles] = useState([]);
  const [notes, setNotes] = useState('');
  const [signer, setSigner] = useState('');
  const [charge, setCharge] = useState(0);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);

  const set = (id, k, v) => setVals({ ...vals, [id]: { ...vals[id], [k]: Math.max(0, Number(v) || 0) } });
  const returnAll = () => setVals(Object.fromEntries(open.map((l) => [l.assetId, { good: l.outstandingQty, damaged: 0, lost: 0 }])));
  const total = Object.values(vals).reduce((s, v) => s + v.good + v.damaged + v.lost, 0);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const fd = new FormData();
    fd.append('lines', JSON.stringify(open.map((l) => ({ assetId: l.assetId, goodQty: vals[l.assetId].good, damagedQty: vals[l.assetId].damaged, lostQty: vals[l.assetId].lost }))));
    fd.append('notes', notes);
    fd.append('clientSignatureName', signer);
    if (canAssess) fd.append('damageChargeXAF', String(charge || 0));
    files.forEach((f) => fd.append('photos', f));
    fd.append('photoMeta', JSON.stringify(files.map((f) => ({ caption: f.name.replace(/\.[^.]+$/, ''), takenAt: new Date(f.lastModified).toISOString() }))));
    try {
      const r = await api.recordReturn(contract._id, fd);
      toast(r.contract.status === 'Returned_Settled' ? t('ret.allReturned') : t('ret.done'));
      onDone();
    } catch (err) { setError(err); setBusy(false); }
  };

  return (
    <Modal title={t('ret.title')} onClose={onClose} wide>
      <form onSubmit={submit}>
        <p className="muted" style={{ marginBottom: 14 }}>{t('ret.hint')}</p>
        <div className="table-wrap">
          <table className="lines-edit">
            <thead><tr><th>{t('ret.cols.item')}</th><th className="n">{t('ret.cols.out')}</th><th>{t('ret.cols.good')}</th><th>{t('ret.cols.damaged')}</th><th>{t('ret.cols.lost')}</th></tr></thead>
            <tbody>
              {open.map((l) => (
                <tr key={l._id}>
                  <td>{name(l)}</td>
                  <td className="n num" style={{ fontSize: 18 }}>{num(l.outstandingQty)}</td>
                  {['good', 'damaged', 'lost'].map((k) => (
                    <td key={k} style={{ width: 96 }}><input className="input" type="number" min="0" max={l.outstandingQty} value={vals[l.assetId][k] || ''} placeholder="0" onChange={(e) => set(l.assetId, k, e.target.value)} aria-label={`${name(l)} ${t(`ret.cols.${k}`)}`} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" className="btn btn-sm" style={{ margin: '8px 0 18px' }} onClick={returnAll}>{t('ret.returnAll')}</button>

        <div className="grid-form">
          <div className="span-2">
            <strong>{t('ret.photos')}</strong>
            <p className="dim" style={{ fontSize: 13, margin: '2px 0 8px' }}>{t('ret.photosHint')}</p>
            <label className="btn btn-sm" style={{ cursor: 'pointer' }}>
              <Icon name="camera" size={16} /> {t('ret.addPhotos')}
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => setFiles([...files, ...Array.from(e.target.files)].slice(0, 12))} />
            </label>
            {previews.length > 0 && <div className="photos">{previews.map((p, i) => <div key={i} className="photo" style={{ cursor: 'default' }}><img src={p} alt="" /><span>{files[i].name}</span></div>)}</div>}
          </div>
          <label className="field">{t('ret.signer')}<input value={signer} onChange={(e) => setSigner(e.target.value)} /></label>
          {canAssess && <label className="field">{t('ret.damageCharge')}<input type="number" min="0" value={charge} onChange={(e) => setCharge(e.target.value)} /></label>}
          <label className="field span-2">{t('ret.notes')}<textarea rows="2" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        </div>
        <div style={{ marginTop: 14 }}><ErrorNote error={error} /></div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn btn-primary" disabled={busy || total === 0}>{t('ret.submit')}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function ContractDetail() {
  const { id } = useParams();
  const { t, money, num, date, dateTime, name } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const { data, error, loading, reload } = useLoad(() => api.contract(id), [id]);
  const [modal, setModal] = useState(null); // 'return' | 'dispute' | 'damage' | { photo }
  const [text, setText] = useState('');
  const [mErr, setMErr] = useState(null);
  const isManager = user.role !== 'operator';

  if (loading && !data) return <Spinner />;
  if (error) return <><Link to="/contracts" className="back"><Icon name="back" /> {t('common.back')}</Link><ErrorNote error={error} /></>;
  const { contract: c, settlement: s, inspections, notifications } = data;
  const isOpen = c.status !== 'Returned_Settled';

  const act = async (fn, okMsg) => {
    setMErr(null);
    try { await fn(); toast(okMsg); setModal(null); setText(''); reload(); } catch (e) { setMErr(e); }
  };

  return (
    <>
      <Link to="/contracts" className="back no-print"><Icon name="back" /> {t('common.back')}</Link>
      <div className="page-head">
        <div>
          <div className="row"><h1>{c.contractNumber}</h1><StatusBadge status={c.status} /></div>
          <p>{c.clientCompany ? `${c.clientCompany} · ` : ''}{c.clientName} · {c.siteLocation}</p>
        </div>
        <div className="row no-print" style={{ flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => window.print()}><Icon name="print" /> {t('common.print')}</button>
          {isManager && isOpen && c.status !== 'Disputed' && <button className="btn" onClick={() => { setMErr(null); setModal('dispute'); }}>{t('detail.dispute')}</button>}
          {isManager && c.status === 'Disputed' && <button className="btn" onClick={() => act(() => api.resolveDispute(c._id), t('detail.resolveDispute'))}>{t('detail.resolveDispute')}</button>}
          {isManager && <button className="btn" onClick={() => { setMErr(null); setText(String(c.damageChargesXAF || 0)); setModal('damage'); }}>{t('detail.assessDamage')}</button>}
          {isOpen && <button className="btn btn-primary" onClick={() => { setMErr(null); setModal('return'); }}><Icon name="camera" /> {t('detail.recordReturn')}</button>}
        </div>
      </div>

      {c.status === 'Disputed' && <div className="note note-warn" style={{ marginBottom: 16 }}><Icon name="alert" /> <span>{t('detail.disputeShown', { reason: c.disputeReason })}</span></div>}

      <section className="kpis">
        <div className={`card kpi ${c.overdueExposureXAF > 0 ? 'alert' : ''}`}><div className="label">{t('detail.kpiExposure')}</div><div className="value">{money(c.overdueExposureXAF)}</div><div className="hint">{c.daysOverdue > 0 ? t('contracts.lateBy', { n: c.daysOverdue }) : '—'}</div></div>
        <div className="card kpi"><div className="label">{t('detail.kpiDaily')}</div><div className="value">{money(c.dailyOverdueRateXAF)}</div><div className="hint">× {c.penaltyMultiplier}</div></div>
        <div className="card kpi"><div className="label">{t('detail.kpiOut')}</div><div className="value">{num(c.outstandingQty)}<small>/ {num(c.totalQty)}</small></div><div className="hint">{!isOpen ? t('detail.closedOn', { date: date(c.actualReturnDate) }) : c.daysOverdue > 0 ? t('contracts.lateBy', { n: c.daysOverdue }) : t('contracts.leftDays', { n: Math.max(0, c.daysRemaining) })}</div></div>
        <div className="card kpi"><div className="label">{t('detail.kpiDeposit')}</div><div className="value">{money(c.securityDepositXAF)}</div><div className="hint">{c.clientPhone}</div></div>
      </section>

      <section className="card card-pad">
        <dl className="facts" style={{ margin: 0 }}>
          <div><dt>{t('detail.client')}</dt><dd>{c.clientName}{c.clientCompany ? ` — ${c.clientCompany}` : ''}</dd></div>
          <div><dt>{t('detail.site')}</dt><dd>{c.siteLocation}{c.siteCity ? `, ${c.siteCity}` : ''}</dd></div>
          <div><dt>{t('detail.period')}</dt><dd>{date(c.startDate)} → {date(c.expectedReturnDate)}</dd></div>
          <div><dt>{t('detail.foreman')}</dt><dd>{c.foremanName || '—'}</dd></div>
          <div><dt>{t('detail.idNumber')}</dt><dd>{c.clientIdNumber || '—'}</dd></div>
          <div><dt>{t('newc.phone')}</dt><dd>{c.clientPhone}</dd></div>
        </dl>
      </section>

      <section className="card" style={{ marginTop: 20 }}>
        <div className="card-head"><h3>{t('detail.lines')}</h3></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t('detail.cols.item')}</th><th className="n">{t('detail.cols.qty')}</th><th className="n">{t('detail.cols.good')}</th><th className="n">{t('detail.cols.damaged')}</th><th className="n">{t('detail.cols.lost')}</th><th className="n">{t('detail.cols.out')}</th><th className="n">{t('detail.cols.rate')}</th></tr></thead>
            <tbody>
              {c.itemsLeased.map((l) => (
                <tr key={l._id}>
                  <td>{name(l)}</td>
                  <td className="n num">{num(l.quantity)}</td><td className="n num">{num(l.returnedGoodQty)}</td>
                  <td className="n num" style={{ color: l.returnedDamagedQty ? 'var(--red)' : undefined }}>{num(l.returnedDamagedQty)}</td>
                  <td className="n num" style={{ color: l.lostQty ? 'var(--red)' : undefined }}>{num(l.lostQty)}</td>
                  <td className="n num" style={{ fontSize: 18, fontWeight: 600 }}>{num(l.outstandingQty)}</td>
                  <td className="n num">{money(l.dailyRatePerUnitXAF)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid-3" style={{ marginTop: 20 }}>
        <section className="card card-pad">
          <h3>{t('detail.returns')}</h3>
          {inspections.length === 0 && <p className="muted">{t('detail.noReturns')}</p>}
          <div className="timeline">
            {inspections.map((i) => {
              const dmg = i.lines.reduce((x, l) => x + l.damagedQty, 0) + i.lines.reduce((x, l) => x + l.lostQty, 0);
              return (
                <div key={i._id} className={`tl-item ${dmg ? 'has-damage' : ''}`}>
                  <div className="tl-head"><strong>{dateTime(i.returnedAt)}</strong><span className="dim">{t('detail.returnedBy', { name: i.inspectorName })}</span></div>
                  <div className="pills">
                    {i.lines.map((l) => (
                      <span key={l.assetId} className="pill">{name(l)}: {t('detail.good', { n: l.goodQty })}{l.damagedQty > 0 && ` · ${t('detail.dmg', { n: l.damagedQty })}`}{l.lostQty > 0 && ` · ${t('detail.lostN', { n: l.lostQty })}`}</span>
                    ))}
                  </div>
                  {i.notes && <p className="muted">{i.notes}</p>}
                  {i.clientSignatureName && <p className="dim" style={{ fontSize: 13 }}>{t('detail.signedBy', { name: i.clientSignatureName })}</p>}
                  {i.penaltyAtReturnXAF > 0 && <p className="dim" style={{ fontSize: 13 }}>{t('detail.penaltyAtReturn')}: {money(i.penaltyAtReturnXAF)}</p>}
                  {i.photos.length > 0 && (
                    <div className="photos">
                      {i.photos.map((p) => (
                        <button key={p._id} className="photo" onClick={() => setModal({ photo: p })}>
                          <img src={p.url} alt={p.caption || ''} loading="lazy" /><span>{p.caption || dateTime(p.uploadedAt)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <div className="stack">
          <section className="card card-pad">
            <h3>{t('detail.settlement')}</h3>
            {isOpen && <p className="dim" style={{ fontSize: 13, margin: '-6px 0 10px' }}>{t('detail.provisional')}</p>}
            <table className="ledger"><tbody>
              <tr><td className="muted">{t('detail.rental')}</td><td className="right num">{money(s.plannedRentalXAF)}</td></tr>
              <tr><td className="muted">{t('detail.penalty')}</td><td className="right num pos">{money(s.penaltyXAF)}</td></tr>
              <tr><td className="muted">{t('detail.lostItems')}</td><td className="right num">{money(s.lostItemsXAF)}</td></tr>
              <tr><td className="muted">{t('detail.damage')}</td><td className="right num">{money(s.damageChargesXAF)}</td></tr>
              <tr className="sum"><td>{t('detail.totalCharges')}</td><td className="right num">{money(s.totalChargesXAF)}</td></tr>
              <tr><td className="muted">{t('detail.depositHeld')}</td><td className="right num neg">− {money(s.depositXAF)}</td></tr>
              {s.balanceDueXAF > 0
                ? <tr className="sum big"><td>{t('detail.balanceDue')}</td><td className="right pos">{money(s.balanceDueXAF)}</td></tr>
                : <tr className="sum big"><td>{t('detail.refundDue')}</td><td className="right neg">{money(s.refundDueXAF)}</td></tr>}
            </tbody></table>
          </section>
          <section className="card card-pad no-print">
            <h3><Icon name="sms" /> {t('detail.notifications')}</h3>
            {notifications.length === 0 && <p className="muted">{t('detail.noNotif')}</p>}
            {notifications.map((n) => <div key={n._id} className="sms">{n.message}<small>{t(`detail.kinds.${n.kind}`)} · {dateTime(n.createdAt)} · {n.to}</small></div>)}
          </section>
        </div>
      </div>

      <footer className="print-only print-foot"><strong>BatiRent</strong><ByNexus width={90} /></footer>

      {modal === 'return' && <ReturnModal contract={c} canAssess={isManager} onClose={() => setModal(null)} onDone={() => { setModal(null); reload(); }} />}
      {modal === 'dispute' && (
        <Modal title={t('detail.dispute')} onClose={() => setModal(null)}>
          <label className="field">{t('detail.disputeReason')}<textarea rows="3" value={text} onChange={(e) => setText(e.target.value)} autoFocus /></label>
          <div style={{ marginTop: 12 }}><ErrorNote error={mErr} /></div>
          <div className="modal-actions"><button className="btn" onClick={() => setModal(null)}>{t('common.cancel')}</button><button className="btn btn-primary" onClick={() => act(() => api.dispute(c._id, text), t('detail.dispute'))}>{t('common.confirm')}</button></div>
        </Modal>
      )}
      {modal === 'damage' && (
        <Modal title={t('detail.assessDamage')} onClose={() => setModal(null)}>
          <label className="field">{t('ret.damageCharge')}<input type="number" min="0" value={text} onChange={(e) => setText(e.target.value)} autoFocus /></label>
          <div style={{ marginTop: 12 }}><ErrorNote error={mErr} /></div>
          <div className="modal-actions"><button className="btn" onClick={() => setModal(null)}>{t('common.cancel')}</button><button className="btn btn-primary" onClick={() => act(() => api.damageCharge(c._id, Number(text)), t('common.save'))}>{t('common.save')}</button></div>
        </Modal>
      )}
      {modal && modal.photo && (
        <Modal title={modal.photo.caption || t('detail.returns')} onClose={() => setModal(null)} wide>
          <div className="lightbox"><img src={modal.photo.url} alt={modal.photo.caption || ''} />
            <p className="dim" style={{ marginTop: 10, textAlign: 'center' }}>{dateTime(modal.photo.takenAt || modal.photo.uploadedAt)}</p>
            {modal.photo.sha256 && <p className="hash">{t('detail.fingerprint')} SHA-256 · {modal.photo.sha256}</p>}
          </div>
        </Modal>
      )}
    </>
  );
}
