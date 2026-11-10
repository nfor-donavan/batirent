import { useI18n } from '../i18n/index.jsx';

// "by NEXUS Tech Labs" endorsement. Two artworks exist (light and dark variants of the logo);
// CSS shows the one that matches the active theme, so the logo is always legible.
export function NexusLogo({ kind = 'logo', width = 120, fixed }) {
  // fixed = 'dark' for surfaces that are dark in BOTH themes (sidebar, login art panel)
  const alt = 'NEXUS Tech Labs';
  if (fixed) return <img src={`/brand/nexus-${kind}-${fixed}.png`} alt={alt} width={width} style={{ height: 'auto' }} />;
  return (
    <>
      <img className="nx-light" src={`/brand/nexus-${kind}-light.png`} alt={alt} width={width} style={{ height: 'auto' }} />
      <img className="nx-dark" src={`/brand/nexus-${kind}-dark.png`} alt="" aria-hidden="true" width={width} style={{ height: 'auto' }} />
    </>
  );
}

export function ByNexus({ fixed, kind = 'logo', width = 110, className = '' }) {
  const { t } = useI18n();
  return (
    <div className={`by-nexus ${className}`}>
      <span>{t('app.by')}</span>
      <NexusLogo fixed={fixed} kind={kind} width={width} />
    </div>
  );
}
