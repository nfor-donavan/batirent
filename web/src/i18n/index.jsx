import { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react';
import fr from './fr.js';
import en from './en.js';

const DICTS = { fr, en };
const I18nContext = createContext(null);

function lookup(dict, key) {
  return key.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), dict);
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('br_lang') || 'fr');

  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem('br_lang', lang);
  }, [lang]);

  const t = useCallback(
    (key, params) => {
      let s = lookup(DICTS[lang], key);
      if (s === undefined) s = lookup(DICTS.fr, key);
      if (s === undefined) return key;
      if (typeof s !== 'string') return s;
      return params ? s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? params[k] : m)) : s;
    },
    [lang]
  );

  const value = useMemo(() => {
    const locale = lang === 'fr' ? 'fr-FR' : 'en-GB';
    const nf = new Intl.NumberFormat(locale);
    const currency = lang === 'fr' ? 'FCFA' : 'XAF';
    // Intl uses narrow no-break spaces in French; normalise so numbers never wrap oddly.
    const clean = (s) => s.replace(/[\u202f\u00a0]/g, '\u00a0');
    const tz = 'Africa/Douala';
    return {
      lang,
      setLang: setLangState,
      t,
      num: (n) => clean(nf.format(Math.round(n || 0))),
      money: (n) => `${clean(nf.format(Math.round(n || 0)))}\u00a0${currency}`,
      currency,
      pct: (x) => `${Math.round((x || 0) * 100)}%`,
      date: (d) => (d ? new Date(d).toLocaleDateString(locale, { timeZone: tz, day: '2-digit', month: 'short', year: 'numeric' }) : '—'),
      dateTime: (d) =>
        d ? new Date(d).toLocaleString(locale, { timeZone: tz, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—',
      month: (ym) => new Date(`${ym}-01T12:00:00Z`).toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' }),
      name: (o) => (lang === 'en' && o && o.itemNameEn ? o.itemNameEn : o && o.itemName),
      // Translates an API error object { code, details } into the active language.
      err: (e) => {
        const code = (e && e.code) || 'SERVER_ERROR';
        const msg = lookup(DICTS[lang], `errors.${code}`);
        if (!msg) return (e && e.message) || lookup(DICTS[lang], 'common.error');
        return msg.replace(/\{(\w+)\}/g, (m, k) => (e && e.details && e.details[k] !== undefined ? e.details[k] : m));
      },
    };
  }, [lang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
