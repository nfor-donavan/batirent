import { api } from '../api.js';
import { useI18n } from '../i18n/index.jsx';
import { useLoad, Spinner, ErrorNote } from '../components/ui.jsx';

export default function Audit() {
  const { t, dateTime } = useI18n();
  const { data, error, loading } = useLoad(() => api.audit(), []);
  return (
    <>
      <div className="page-head"><div><h1>{t('audit.title')}</h1><p>{t('audit.subtitle')}</p></div></div>
      <ErrorNote error={error} />
      <div className="card table-wrap">
        {loading && !data ? <Spinner /> : !data || data.items.length === 0 ? <div className="empty"><strong>{t('audit.empty')}</strong></div> : (
          <table>
            <thead><tr><th>{t('audit.when')}</th><th>{t('audit.who')}</th><th>{t('audit.what')}</th><th>{t('audit.detail')}</th></tr></thead>
            <tbody>
              {data.items.map((a) => (
                <tr key={a._id}><td style={{ whiteSpace: 'nowrap' }}>{dateTime(a.createdAt)}</td><td>{a.userName || '—'}</td><td><span className="pill">{a.action}</span></td><td>{a.summary}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
