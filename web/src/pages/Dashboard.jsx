import { Link } from 'react-router-dom';
import { useState } from 'react';
import { api } from '../api.js';
import { useI18n } from '../i18n/index.jsx';
import { useLoad, Spinner, ErrorNote, PipeGauge, ExpiryRing, Icon } from '../components/ui.jsx';

export default function Dashboard() {
  const { t, money, num, pct, date, dateTime, month, currency } = useI18n();
  const { data, error, loading, reload } = useLoad(() => api.summary(), []);
  const [integrity, setIntegrity] = useState(null);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorNote error={error} />;
  const { kpis, categories, expiringSoon, topOverdue, monthly, recentInspections } = data;
  const maxMonth = Math.max(1, ...monthly.map((m) => m.contracts));

  const runIntegrity = async () => setIntegrity(await api.integrity());

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t('dash.title')}</h1>
          <p>{t('dash.subtitle', { date: date(data.generatedAt) })}</p>
        </div>
        <div className="row">
          <button className="btn" onClick={reload}>{t('common.refresh')}</button>
          <Link className="btn btn-primary" to="/contracts/new"><Icon name="plus" /> {t('contracts.newContract')}</Link>
        </div>
      </div>

      <section className="card hero">
        <div className="hero-num num">{Math.round(kpis.utilizationRate * 100)}<small>%</small></div>
        <div className="hero-text">
          <h2>{t('dash.heroLead')}</h2>
          <p>{t('dash.heroSub', { deployed: num(kpis.unitsDeployed), total: num(kpis.unitsTotal), available: num(kpis.unitsAvailable) })}</p>
        </div>
        <div className="pipes-row">
          <PipeGauge parts={[
            { value: kpis.unitsDeployed, tone: 'site' },
            { value: kpis.unitsAvailable, tone: 'yard' },
            { value: kpis.unitsLostDamaged, tone: 'lost' },
          ]} cells={60} height={38} />
          <div className="legend">
            <span><i className="l-site" />{t('dash.onSite')} · {num(kpis.unitsDeployed)}</span>
            <span><i className="l-yard" />{t('dash.inYard')} · {num(kpis.unitsAvailable)}</span>
            <span><i className="l-lost" />{t('dash.damaged')} · {num(kpis.unitsLostDamaged)}</span>
          </div>
        </div>
      </section>

      <section className="kpis">
        <div className={`card kpi ${kpis.totalOverdueExposureXAF > 0 ? 'alert' : ''}`}>
          <div className="label">{t('dash.kpiExposure')}</div>
          <div className="value">{num(kpis.totalOverdueExposureXAF)}<small>{currency}</small></div>
          <div className="hint">{t('dash.kpiExposureHint', { n: kpis.overdueContracts })}</div>
        </div>
        <div className="card kpi">
          <div className="label">{t('dash.kpiValueSites')}</div>
          <div className="value">{num(kpis.valueAtSitesXAF / 1e6)}<small>M {currency}</small></div>
          <div className="hint">{t('dash.kpiValueSitesHint')}</div>
        </div>
        <div className="card kpi">
          <div className="label">{t('dash.kpiOpen')}</div>
          <div className="value">{kpis.openContracts}</div>
          <div className="hint">{t('dash.kpiOpenHint', { n: kpis.overdueContracts, m: kpis.disputedContracts })}</div>
        </div>
        <div className="card kpi">
          <div className="label">{t('dash.kpiDeposits')}</div>
          <div className="value">{num(kpis.depositsHeldXAF / 1e3)}<small>k {currency}</small></div>
          <div className="hint">{t('dash.kpiDepositsHint')}</div>
        </div>
      </section>

      <div className="grid-3">
        <section className="card card-pad">
          <h3>{t('dash.byCategory')}</h3>
          {categories.filter((c) => c.total > 0).map((c) => (
            <div className="cat-row" key={c.category}>
              <div className="cat-name"><strong>{t(`cat.${c.category}`)}</strong><span>{num(c.deployed)} / {num(c.total)}</span></div>
              <PipeGauge cells={36} height={22} parts={[{ value: c.deployed, tone: 'site' }, { value: c.available, tone: 'yard' }, { value: c.lostDamaged, tone: 'lost' }]} />
              <div className="pct">{pct(c.utilizationRate)}</div>
            </div>
          ))}
        </section>

        <section className="card card-pad">
          <h3>{t('dash.expiring')}</h3>
          {expiringSoon.length === 0 && <p className="muted">{t('dash.expiringEmpty')}</p>}
          {expiringSoon.map((c) => (
            <Link key={c._id} to={`/contracts/${c._id}`} className="list-item">
              <ExpiryRing progress={c.progress} tone={c.daysRemaining === 0 ? 'red' : 'amber'}>{c.daysRemaining === 0 ? '0' : c.daysRemaining}</ExpiryRing>
              <div className="li-main">
                <div className="li-title">{c.clientCompany || c.clientName}</div>
                <div className="li-sub">{c.contractNumber} · {c.siteLocation}</div>
                <div className="li-sub">{c.daysRemaining === 0 ? t('dash.dueToday') : t('dash.dueIn', { n: c.daysRemaining })} · {num(c.outstandingQty)} {t('common.units')}</div>
              </div>
            </Link>
          ))}
        </section>
      </div>

      <div className="grid-2" style={{ marginTop: 20 }}>
        <section className="card card-pad">
          <h3>{t('dash.topOverdue')}</h3>
          {topOverdue.length === 0 && <p className="muted">{t('dash.topOverdueEmpty')}</p>}
          {topOverdue.map((c) => (
            <Link key={c._id} to={`/contracts/${c._id}`} className="list-item">
              <ExpiryRing progress={1} tone="red">{c.daysOverdue}</ExpiryRing>
              <div className="li-main">
                <div className="li-title">{c.clientCompany || c.clientName}</div>
                <div className="li-sub">{c.contractNumber} · {c.siteLocation}</div>
              </div>
              <div className="li-amount">{money(c.overdueExposureXAF)}<small>{t('dash.perDay', { amount: money(c.dailyOverdueRateXAF) })}</small></div>
            </Link>
          ))}
        </section>

        <section className="card card-pad">
          <h3>{t('dash.recent')}</h3>
          {recentInspections.length === 0 && <p className="muted">{t('dash.recentEmpty')}</p>}
          {recentInspections.map((i) => (
            <Link key={i._id} to={`/contracts/${i.contractId}`} className="list-item">
              <div className="li-main">
                <div className="li-title">{i.contractNumber}</div>
                <div className="li-sub">{dateTime(i.returnedAt)} · {i.inspectorName}</div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                {i.damaged > 0 && <span className="pill red">{t('dash.withDamage', { n: i.damaged })}</span>}
                {i.lost > 0 && <span className="pill red">{t('dash.withLoss', { n: i.lost })}</span>}
                <span className="pill">{t('dash.unitsReturned', { n: i.units })}</span>
                <span className="pill">{t('dash.photos', { n: i.photos })}</span>
              </div>
            </Link>
          ))}
        </section>
      </div>

      <div className="grid-2" style={{ marginTop: 20 }}>
        <section className="card card-pad">
          <h3>{t('dash.monthly')}</h3>
          <div className="bars">
            {monthly.map((m, i) => (
              <div key={m.month} className={`bar ${i === monthly.length - 1 ? 'last' : ''}`}>
                <b>{m.contracts}</b><i style={{ height: `${(m.contracts / maxMonth) * 78}%` }} /><span>{month(m.month)}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="card card-pad">
          <h3>{t('dash.integrity')}</h3>
          {!integrity && <button className="btn" onClick={runIntegrity}><Icon name="shield" /> {t('dash.integrityRun')}</button>}
          {integrity && (integrity.ok
            ? <div className="note note-ok"><Icon name="check" /> {t('dash.integrityOk')}</div>
            : <div className="note note-warn"><Icon name="alert" /> {t('dash.integrityBad', { n: integrity.discrepancies.length })}</div>)}
          <p className="dim" style={{ marginTop: 12, fontSize: 13 }}>{integrity ? `${integrity.checkedAssets} ${t('nav.fleet').toLowerCase()}` : ''}</p>
        </section>
      </div>
    </>
  );
}
