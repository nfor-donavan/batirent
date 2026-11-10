import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STRINGS } from './i18n';

const light = { bg: '#e6e4de', surface: '#f5f4f0', surface2: '#ecebe5', ink: '#1d2830', ink2: '#4c5a65', ink3: '#75828c', rule: '#cfccc2', amber: '#b86f00', amberText: '#ffffff', red: '#b2362c', redSoft: '#f3d9d5', green: '#2a7653', steel: '#7f8d98' };
const dark = { bg: '#0f1418', surface: '#182027', surface2: '#1f2932', ink: '#e8e6e1', ink2: '#aab5bd', ink3: '#7d8a94', rule: '#2c3842', amber: '#e2a232', amberText: '#1a1204', red: '#ef6b5e', redSoft: '#3d1d1a', green: '#4cb88a', steel: '#66757f' };

const Ctx = createContext(null);

export function SettingsProvider({ children }) {
  const system = useColorScheme();
  const [lang, setLang] = useState('fr');
  const [mode, setMode] = useState(null); // null = follow the phone
  useEffect(() => {
    AsyncStorage.multiGet(['br_lang', 'br_theme']).then((p) => {
      if (p[0][1]) setLang(p[0][1]);
      if (p[1][1]) setMode(p[1][1]);
    });
  }, []);
  const value = useMemo(() => {
    const isDark = (mode || system) === 'dark';
    const dict = STRINGS[lang];
    const t = (key, params) => {
      let s = dict[key] !== undefined ? dict[key] : STRINGS.fr[key] !== undefined ? STRINGS.fr[key] : key;
      if (typeof s !== 'string') return key;
      return params ? s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? String(params[k]) : m)) : s;
    };
    const err = (e) => {
      const m = dict.errors[e && e.code] || STRINGS.fr.errors[e && e.code];
      if (!m) return (e && e.message) || dict.errors.SERVER_ERROR;
      return m.replace(/\{(\w+)\}/g, (x, k) => (e.details && e.details[k] !== undefined ? e.details[k] : x));
    };
    const nf = new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-GB');
    return {
      lang, dark: isDark, colors: isDark ? dark : light, t, err,
      money: (n) => `${nf.format(Math.round(n || 0)).replace(/[\u202f\u00a0]/g, ' ')} ${lang === 'fr' ? 'FCFA' : 'XAF'}`,
      num: (n) => nf.format(Math.round(n || 0)).replace(/[\u202f\u00a0]/g, ' '),
      name: (o) => (lang === 'en' && o.itemNameEn ? o.itemNameEn : o.itemName),
      setLang: (l) => { setLang(l); AsyncStorage.setItem('br_lang', l); },
      toggleTheme: () => { const n = isDark ? 'light' : 'dark'; setMode(n); AsyncStorage.setItem('br_theme', n); },
    };
  }, [lang, mode, system]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useSettings = () => useContext(Ctx);
