import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, Pressable, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSettings } from '../settings';
import { useAuth } from '../auth';
import { api } from '../api';
import { StatusPill, card } from '../components/ui';
import { queueSize, onQueueChange, flushQueue } from '../queue';

const FILTERS = ['open', 'Overdue', 'Active', 'all'];

export default function ContractsScreen({ navigation }) {
  const { colors, t, err, num, lang, setLang, toggleTheme } = useSettings();
  const { logout } = useAuth();
  const [filter, setFilter] = useState('open');
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(0);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = {};
      if (filter === 'open') params.open = 'true'; else if (filter !== 'all') params.status = filter;
      if (q) params.q = q;
      setItems((await api.contracts(params)).items);
    } catch (e) { setError(err(e)); } finally { setLoading(false); }
  }, [filter, q, err]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { queueSize().then(setPending); return onQueueChange(setPending); }, []);
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <Pressable onPress={() => setLang(lang === 'fr' ? 'en' : 'fr')} style={{ padding: 8 }}><Text style={{ color: colors.ink, fontWeight: '800' }}>{lang.toUpperCase()}</Text></Pressable>
          <Pressable onPress={toggleTheme} style={{ padding: 8 }}><Text style={{ color: colors.ink, fontWeight: '800' }}>◐</Text></Pressable>
          <Pressable onPress={logout} style={{ padding: 8 }}><Text style={{ color: colors.red, fontWeight: '800' }}>⎋</Text></Pressable>
        </View>
      ),
    });
  }, [navigation, lang, colors, logout, setLang, toggleTheme]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {pending > 0 && (
        <Pressable onPress={flushQueue} style={{ backgroundColor: colors.amber, padding: 10 }}>
          <Text style={{ color: colors.amberText, fontWeight: '700', textAlign: 'center' }}>{t('pending', { n: pending })} · {t('retry')}</Text>
        </Pressable>
      )}
      <View style={{ padding: 12, gap: 10 }}>
        <TextInput placeholder={t('search')} placeholderTextColor={colors.ink3} value={q} onChangeText={setQ}
          style={{ backgroundColor: colors.surface, borderColor: colors.rule, borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16, color: colors.ink }} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {FILTERS.map((f) => (
            <Pressable key={f} onPress={() => setFilter(f)} style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 99, backgroundColor: filter === f ? colors.ink : colors.surface, borderWidth: 1, borderColor: colors.rule }}>
              <Text style={{ color: filter === f ? colors.bg : colors.ink, fontWeight: '700' }}>{f === 'open' ? t('Active') + '+' : t(f === 'all' ? 'all' : f)}</Text>
            </Pressable>
          ))}
        </View>
        {error && <Text style={{ color: colors.red, fontWeight: '600' }}>{error}</Text>}
      </View>
      <FlatList
        data={items}
        keyExtractor={(c) => c._id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { setLoading(true); load(); }} tintColor={colors.amber} />}
        contentContainerStyle={{ padding: 12, paddingTop: 0, gap: 10 }}
        ListEmptyComponent={!loading && <Text style={{ color: colors.ink2, textAlign: 'center', marginTop: 40 }}>{t('empty')}</Text>}
        renderItem={({ item: c }) => (
          <Pressable onPress={() => navigation.navigate('Contract', { id: c._id })} style={card(colors)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: colors.ink }}>{c.contractNumber}</Text>
              <StatusPill status={c.status} />
            </View>
            <Text style={{ color: colors.ink, marginTop: 6, fontSize: 16, fontWeight: '600' }}>{c.clientCompany || c.clientName}</Text>
            <Text style={{ color: colors.ink2, marginTop: 2 }}>{c.siteLocation}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
              <Text style={{ color: c.daysOverdue > 0 ? colors.red : colors.ink2, fontWeight: '700' }}>
                {c.status === 'Returned_Settled' ? t('Returned_Settled') : c.daysOverdue > 0 ? t('lateBy', { n: c.daysOverdue }) : c.daysRemaining === 0 ? t('dueToday') : t('leftDays', { n: c.daysRemaining })}
              </Text>
              <Text style={{ color: colors.ink, fontWeight: '800' }}>{num(c.outstandingQty)} {t('out').toLowerCase()}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
