import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useLoad, ErrorNote, Icon, Modal, useToast, Spinner } from '../components/ui.jsx';

export default function Settings() {
  const { t } = useI18n();
  const { tenant, refreshTenant, user } = useAuth();
  const toast = useToast();
  const [s, setS] = useState(tenant.settings);
  const [err, setErr] = useState(null);
  const users = useLoad(() => api.users(), []);
  const [modal, setModal] = useState(false);
  const [nu, setNu] = useState({ name: '', email: '', password: '', role: 'operator' });
  const [uErr, setUErr] = useState(null);
  useEffect(() => setS(tenant.settings), [tenant]);

  const save = async () => {
    setErr(null);
    try { await api.updateTenant({ settings: s }); await refreshTenant(); toast(t('settings.saved')); } catch (e) { setErr(e); }
  };
  const sweep = async () => { try { const r = await api.runSweep(); toast(t('settings.sweepDone', { n: r.checked })); } catch (e) { setErr(e); } };
  const addUser = async () => {
    setUErr(null);
    try { await api.createUser(nu); setModal(false); setNu({ name: '', email: '', password: '', role: 'operator' }); users.reload(); } catch (e) { setUErr(e); }
  };
  const toggle = async (u) => { try { await api.updateUser(u._id, { active: !u.active }); users.reload(); } catch (e) { setErr(e); } };

  return (
    <>
      <div className="page-head"><h1>{t('settings.title')}</h1></div>
      <ErrorNote error={err} />
      <div className="grid-2" style={{ marginTop: err ? 16 : 0 }}>
        <section className="card card-pad stack">
          <h3>{t('settings.penalty')}</h3>
          <label className="field">{t('settings.multiplier')}
            <input type="number" step="0.1" min="1" max="5" value={s.penaltyMultiplier} onChange={(e) => setS({ ...s, penaltyMultiplier: e.target.value })} />
            <small>{t('settings.multiplierHint')}</small>
          </label>
          <h3 style={{ marginTop: 24 }}>{t('settings.sms')}</h3>
          <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={s.smsEnabled} onChange={(e) => setS({ ...s, smsEnabled: e.target.checked })} /> {t('settings.smsEnabled')}</label>
          <div className="grid-form">
            <label className="field">{t('settings.reminderDays')}<input type="number" min="0" max="14" value={s.expiryReminderDays} onChange={(e) => setS({ ...s, expiryReminderDays: e.target.value })} /></label>
            <label className="field">{t('settings.smsLanguage')}<select value={s.smsLanguage} onChange={(e) => setS({ ...s, smsLanguage: e.target.value })}><option value="fr">Français</option><option value="en">English</option></select></label>
          </div>
          <div><button className="btn btn-primary" onClick={save}>{t('common.save')}</button></div>
          <hr style={{ border: 0, borderTop: '1px solid var(--rule)', width: '100%' }} />
          <h3>{t('settings.sweep')}</h3>
          <p className="muted">{t('settings.sweepHint')}</p>
          <div><button className="btn" onClick={sweep}>{t('settings.runSweep')}</button></div>
        </section>

        <section className="card">
          <div className="card-head"><h3>{t('settings.users')}</h3><button className="btn btn-sm" onClick={() => { setUErr(null); setModal(true); }}><Icon name="plus" size={15} /> {t('settings.addUser')}</button></div>
          {users.loading && !users.data ? <Spinner /> : (
            <table><tbody>
              {(users.data ? users.data.items : []).map((u) => (
                <tr key={u._id}>
                  <td><strong>{u.name}</strong><span className="cell-sub">{u.email}</span></td>
                  <td>{t(`roles.${u.role}`)}</td>
                  <td className="n">{u._id !== user.id ? <button className="btn btn-sm" onClick={() => toggle(u)}>{u.active ? t('settings.active') : t('common.no')}</button> : <span className="dim">—</span>}</td>
                </tr>
              ))}
            </tbody></table>
          )}
        </section>
      </div>
      {modal && (
        <Modal title={t('settings.addUser')} onClose={() => setModal(false)}>
          <div className="grid-form">
            <label className="field">{t('settings.userName')}<input value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} autoFocus /></label>
            <label className="field">{t('settings.userEmail')}<input type="email" value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} /></label>
            <label className="field">{t('settings.userPassword')}<input type="password" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} /></label>
            <label className="field">{t('settings.userRole')}<select value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value })}><option value="operator">{t('roles.operator')}</option><option value="manager">{t('roles.manager')}</option><option value="owner">{t('roles.owner')}</option></select></label>
          </div>
          <div style={{ marginTop: 12 }}><ErrorNote error={uErr} /></div>
          <div className="modal-actions"><button className="btn" onClick={() => setModal(false)}>{t('common.cancel')}</button><button className="btn btn-primary" onClick={addUser}>{t('common.save')}</button></div>
        </Modal>
      )}
    </>
  );
}
