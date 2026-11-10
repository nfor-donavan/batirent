import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useLoad, Spinner, ErrorNote, StatusBadge, Icon } from '../components/ui.jsx';

const FILTERS = ['all', 'Overdue', 'Active', 'Disputed', 'Returned_Settled'];

export default function Contracts() {
  const { t, money, date, num } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const { data, error, loading } = useLoad(() => api.contracts({ status, q }), [status, q]);
  const items = useMemo(() => (data ? data.items : []), [data]);
  const canCreate = user.role !== 'operator';

  return (
    <>
      <div className="page-head">
        <h1>{t('contracts.title')}</h1>
        {canCreate && <Link className="btn btn-primary" to="/contracts/new"><Icon name="plus" /> {t('contracts.newContract')}</Link>}
      </div>
      <div className="row-wrap" style={{ marginBottom: 16, alignItems: 'center' }}>
        <div className="chips">
          {FILTERS.map((s) => <button key={s} className={`chip ${status === s ? 'on' : ''}`} onClick={() => setStatus(s)}>{t(`status.${s}`)}</button>)}
        </div>
        <div className="spacer" />
        <div className="search" style={{ width: 300 }}>
          <Icon name="search" />
          <input className="input" placeholder={t('contracts.searchPh')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('common.search')} />
        </div>
      </div>
      <ErrorNote error={error} />
      <div className="card table-wrap">
        {loading && !data ? <Spinner /> : items.length === 0 ? (
          <div className="empty"><strong>{t('contracts.empty')}</strong>{t('contracts.emptyHint')}</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t('contracts.cols.number')}</th><th>{t('contracts.cols.client')}</th><th>{t('contracts.cols.site')}</th>
                <th>{t('contracts.cols.due')}</th><th className="n">{t('contracts.cols.out')}</th><th className="n">{t('contracts.cols.exposure')}</th><th>{t('contracts.cols.status')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c._id} className="click" onClick={() => navigate(`/contracts/${c._id}`)}>
                  <td><strong>{c.contractNumber}</strong></td>
                  <td>{c.clientCompany || c.clientName}<span className="cell-sub">{c.clientCompany ? c.clientName : c.clientPhone}</span></td>
                  <td>{c.siteLocation}<span className="cell-sub">{c.siteCity}</span></td>
                  <td>{date(c.expectedReturnDate)}
                    <span className="cell-sub">{c.status === 'Returned_Settled' ? t('contracts.closed') : c.daysOverdue > 0 ? t('contracts.lateBy', { n: c.daysOverdue }) : t('contracts.leftDays', { n: Math.max(0, c.daysRemaining) })}</span>
                  </td>
                  <td className="n num" style={{ fontSize: 18 }}>{c.status === 'Returned_Settled' ? '—' : `${num(c.outstandingQty)} / ${num(c.totalQty)}`}</td>
                  <td className="n num" style={{ fontSize: 18, color: c.overdueExposureXAF > 0 ? 'var(--red)' : undefined }}>{c.overdueExposureXAF > 0 ? money(c.overdueExposureXAF) : '—'}</td>
                  <td><StatusBadge status={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
