import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useTheme } from '../theme.jsx';
import { Icon } from './ui.jsx';
import { ByNexus } from './Nexus.jsx';

function Logo({ small }) {
  return (
    <span className={`logo ${small ? 'logo-sm' : ''}`}>
      <svg viewBox="0 0 64 64" width={small ? 26 : 34} height={small ? 26 : 34} aria-hidden="true">
        <rect width="64" height="64" rx="12" fill="var(--logo-bg)" />
        <g fill="var(--amber)"><rect x="12" y="14" width="6" height="36" /><rect x="24" y="14" width="6" height="36" /><rect x="36" y="14" width="6" height="36" /><rect x="48" y="14" width="6" height="36" opacity=".35" /></g>
        <rect x="10" y="30" width="46" height="5" fill="var(--logo-bar)" />
      </svg>
      <b>BatiRent</b>
    </span>
  );
}
export { Logo };

export default function Layout() {
  const { user, tenant, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const isManager = user.role === 'owner' || user.role === 'manager';

  const nav = [
    isManager && { to: '/', icon: 'grid', label: t('nav.dashboard'), end: true },
    { to: '/contracts', icon: 'file', label: t('nav.contracts') },
    { to: '/fleet', icon: 'fleet', label: t('nav.fleet') },
    isManager && { to: '/audit', icon: 'log', label: t('nav.audit') },
    user.role === 'owner' && { to: '/settings', icon: 'gear', label: t('nav.settings') },
  ].filter(Boolean);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="side-top"><Logo /></div>
        <nav aria-label="Navigation">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon name={n.icon} /> <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="yard">
            <strong>{tenant.name}</strong>
            <span>{tenant.city}</span>
          </div>
          <button className="nav-link" onClick={() => { logout(); navigate('/login'); }}>
            <Icon name="out" /> <span>{t('nav.logout')}</span>
          </button>
          <ByNexus fixed="dark" width={84} className="by-side" />
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="who">
            <span className="avatar" aria-hidden="true">{user.name.slice(0, 1)}</span>
            <div><strong>{user.name}</strong><small>{t(`roles.${user.role}`)}</small></div>
          </div>
          <div className="top-actions">
            <div className="seg" role="group" aria-label={t('common.language')}>
              <button className={lang === 'fr' ? 'on' : ''} onClick={() => setLang('fr')} aria-pressed={lang === 'fr'}>FR</button>
              <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')} aria-pressed={lang === 'en'}>EN</button>
            </div>
            <button className="icon-btn" onClick={toggle} aria-label={t('common.theme')} title={theme === 'dark' ? t('common.light') : t('common.dark')}>
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>
          </div>
        </header>
        <main className="content"><Outlet /></main>
      </div>
    </div>
  );
}
