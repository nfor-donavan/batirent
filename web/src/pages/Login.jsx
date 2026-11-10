import { useState } from 'react';
import { useAuth } from '../auth.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useTheme } from '../theme.jsx';
import { Icon, PipeGauge, ErrorNote } from '../components/ui.jsx';
import { Logo } from '../components/Layout.jsx';
import { ByNexus } from '../components/Nexus.jsx';

const YARDS = [
  { slug: 'ylm', name: 'Yaoundé' },
  { slug: 'dcp', name: 'Douala' },
  { slug: 'kpe', name: 'Kribi' },
];

export default function Login() {
  const { login } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { theme, toggle } = useTheme();
  const [email, setEmail] = useState('manager@ylm.batirent.cm');
  const [password, setPassword] = useState('Demo@2026');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [yard, setYard] = useState('ylm');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await login(email, password); } catch (err) { setError(err); setBusy(false); }
  };
  const fill = (role) => { setEmail(`${role}@${yard}.batirent.cm`); setPassword('Demo@2026'); };

  return (
    <div className="login">
      <section className="login-art">
        <Logo />
        <div>
          <h1>{t('app.tagline')}</h1>
          <p>{t('auth.pitch1')}</p>
        </div>
        <div>
          <PipeGauge cells={36} parts={[{ value: 18, tone: 'site' }, { value: 15, tone: 'yard' }, { value: 3, tone: 'lost' }]} height={150} />
          <ByNexus fixed="dark" width={104} className="by-art" />
        </div>
      </section>
      <section className="login-form">
        <div className="login-card">
          <div className="top-actions">
            <div className="seg" role="group" aria-label={t('common.language')}>
              <button className={lang === 'fr' ? 'on' : ''} onClick={() => setLang('fr')}>FR</button>
              <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
            </div>
            <button className="icon-btn" onClick={toggle} aria-label={t('common.theme')}><Icon name={theme === 'dark' ? 'sun' : 'moon'} /></button>
          </div>
          <h2>{t('auth.title')}</h2>
          <p className="muted" style={{ margin: '6px 0 22px' }}>{t('auth.subtitle')}</p>
          <form onSubmit={submit} className="stack">
            <label className="field">{t('auth.email')}
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
            </label>
            <label className="field">{t('auth.password')}
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            </label>
            <ErrorNote error={error} />
            <button className="btn btn-primary" disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>{t('auth.submit')}</button>
          </form>
          <div className="demo">
            <strong>{t('auth.demo')}</strong>
            <div className="yard-pick chips">
              {YARDS.map((y) => <button key={y.slug} type="button" className={`chip ${yard === y.slug ? 'on' : ''}`} onClick={() => setYard(y.slug)}>{y.name}</button>)}
            </div>
            <div className="demo-grid">
              {['owner', 'manager', 'operator'].map((r) => <button key={r} type="button" className="btn" onClick={() => fill(r)}>{t(`auth.${r}`)}</button>)}
            </div>
            <p className="dim" style={{ marginTop: 10, fontSize: 13 }}>{t('auth.demoHint')}</p>
          </div>
          <ByNexus width={96} className="by-form" />
        </div>
      </section>
    </div>
  );
}
