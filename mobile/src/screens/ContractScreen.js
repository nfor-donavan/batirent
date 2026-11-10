import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Linking, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSettings } from '../settings';
import { api } from '../api';
import { Button, StatusPill, card } from '../components/ui';

export default function ContractScreen({ route, navigation }) {
  const { colors, t, err, money, num, name } = useSettings();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => { api.contract(route.params.id).then((r) => setData(r.contract)).catch((e) => setError(err(e))); }, [route.params.id, err]);
  useFocusEffect(load);

  if (error) return <Text style={{ color: colors.red, padding: 20 }}>{error}</Text>;
  if (!data) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.amber} />;
  const c = data;
  const open = c.status !== 'Returned_Settled';
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 12 }}>
        <View style={card(colors)}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: colors.ink }}>{c.contractNumber}</Text>
            <StatusPill status={c.status} />
          </View>
          <Text style={{ color: colors.ink2, marginTop: 10 }}>{t('client')}</Text>
          <Text style={{ color: colors.ink, fontWeight: '700', fontSize: 16 }}>{c.clientCompany ? `${c.clientCompany} — ` : ''}{c.clientName}</Text>
          <Text style={{ color: colors.ink2, marginTop: 10 }}>{t('site')}</Text>
          <Text style={{ color: colors.ink, fontWeight: '700', fontSize: 16 }}>{c.siteLocation}</Text>
          <Text onPress={() => Linking.openURL(`tel:${c.clientPhone}`)} style={{ color: colors.amber, fontWeight: '800', marginTop: 12, fontSize: 16 }}>📞 {t('call')} {c.clientPhone}</Text>
        </View>
        {c.overdueExposureXAF > 0 && (
          <View style={[card(colors), { backgroundColor: colors.redSoft, borderColor: colors.red }]}>
            <Text style={{ color: colors.red, fontWeight: '700' }}>{t('penalty')} · {t('lateBy', { n: c.daysOverdue })}</Text>
            <Text style={{ color: colors.red, fontSize: 30, fontWeight: '800' }}>{money(c.overdueExposureXAF)}</Text>
          </View>
        )}
        <View style={card(colors)}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.ink, marginBottom: 6 }}>{t('lines')}</Text>
          {c.itemsLeased.map((l) => (
            <View key={l._id} style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.rule }}>
              <Text style={{ color: colors.ink, fontWeight: '700', fontSize: 16 }}>{name(l)}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                <Text style={{ color: colors.ink2 }}>{t('sentOut')}: {num(l.quantity)}</Text>
                <Text style={{ color: l.outstandingQty > 0 ? colors.amber : colors.green, fontWeight: '800', fontSize: 16 }}>{t('stillOut')}: {num(l.outstandingQty)}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={{ padding: 14, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.rule }}>
        {open ? <Button title={`📷  ${t('recordReturn')}`} onPress={() => navigation.navigate('Return', { contract: c })} />
              : <Text style={{ textAlign: 'center', color: colors.green, fontWeight: '800', fontSize: 16 }}>{t('closed')}</Text>}
      </View>
    </View>
  );
}
