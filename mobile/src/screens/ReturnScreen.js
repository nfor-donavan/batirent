import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, Image, Pressable, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useSettings } from '../settings';
import { api, buildReturnForm, ApiError } from '../api';
import { enqueueReturn } from '../queue';
import { Button, Stepper, card } from '../components/ui';

export default function ReturnScreen({ route, navigation }) {
  const { colors, t, err, name } = useSettings();
  const contract = route.params.contract;
  const open = contract.itemsLeased.filter((l) => l.outstandingQty > 0);
  const [vals, setVals] = useState(Object.fromEntries(open.map((l) => [l.assetId, { good: 0, damaged: 0, lost: 0 }])));
  const [photos, setPhotos] = useState([]);
  const [notes, setNotes] = useState('');
  const [signer, setSigner] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const room = (l, key) => { // what can still be added to this field without exceeding the balance
    const v = vals[l.assetId];
    return l.outstandingQty - (v.good + v.damaged + v.lost) + v[key];
  };
  const set = (l, key, n) => setVals({ ...vals, [l.assetId]: { ...vals[l.assetId], [key]: n } });
  const total = Object.values(vals).reduce((s, v) => s + v.good + v.damaged + v.lost, 0);
  const hasDamage = Object.values(vals).some((v) => v.damaged > 0);

  const snap = async (assetId) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert(t('permission')); return; }
    const shot = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (shot.canceled || !shot.assets || !shot.assets[0]) return;
    // Compress before upload: 1600px wide JPEG keeps cracks and welds visible but stays ~300 KB on 3G.
    const out = await ImageManipulator.manipulateAsync(shot.assets[0].uri, [{ resize: { width: 1600 } }], { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG });
    setPhotos((p) => [...p, { uri: out.uri, assetId, takenAt: new Date().toISOString(), caption: assetId ? name(open.find((l) => l.assetId === assetId)) : contract.contractNumber }]);
  };

  const payload = () => ({
    contractId: contract._id, notes, signer, photos,
    lines: open.map((l) => ({ assetId: l.assetId, goodQty: vals[l.assetId].good, damagedQty: vals[l.assetId].damaged, lostQty: vals[l.assetId].lost })),
  });

  const send = async () => {
    setBusy(true); setError(null);
    const item = payload();
    try {
      const r = await api.recordReturn(contract._id, buildReturnForm(item));
      Alert.alert(r.contract.status === 'Returned_Settled' ? t('doneClosed') : t('done'));
      navigation.goBack();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'NETWORK') {
        await enqueueReturn(item);
        Alert.alert(t('queued'));
        navigation.popToTop();
      } else { setError(err(e)); setBusy(false); }
    }
  };

  const submit = () => {
    if (total === 0) return setError(t('nothingToReturn'));
    if (hasDamage && photos.length === 0) return setError(t('photoRequired'));
    Alert.alert(t('confirmTitle'), t('confirmBody', { n: total }), [{ text: t('cancel'), style: 'cancel' }, { text: t('confirm'), onPress: send }]);
  };

  const field = { backgroundColor: colors.surface, borderColor: colors.rule, borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16, color: colors.ink, marginTop: 6 };
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 12 }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: colors.ink2 }}>{contract.contractNumber} · {contract.clientCompany || contract.clientName}</Text>
        {open.map((l) => (
          <View key={l._id} style={card(colors)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: colors.ink, flex: 1 }}>{name(l)}</Text>
              <Text style={{ fontSize: 17, fontWeight: '800', color: colors.amber }}>{t('stillOut')}: {l.outstandingQty}</Text>
            </View>
            <Stepper label={t('good')} value={vals[l.assetId].good} max={room(l, 'good')} onChange={(n) => set(l, 'good', n)} all />
            <Stepper label={t('damaged')} value={vals[l.assetId].damaged} max={room(l, 'damaged')} onChange={(n) => set(l, 'damaged', n)} tone="bad" />
            <Stepper label={t('lost')} value={vals[l.assetId].lost} max={room(l, 'lost')} onChange={(n) => set(l, 'lost', n)} tone="bad" />
            {vals[l.assetId].damaged > 0 && <Button kind="secondary" title={`📷  ${t('perLine')}`} onPress={() => snap(l.assetId)} style={{ marginTop: 12 }} />}
          </View>
        ))}
        <View style={card(colors)}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.ink }}>{t('photos')} ({photos.length})</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 10 }}>
            {photos.map((p, i) => (
              <Pressable key={i} onLongPress={() => setPhotos(photos.filter((_, j) => j !== i))}>
                <Image source={{ uri: p.uri }} style={{ width: 84, height: 84, borderRadius: 8 }} />
              </Pressable>
            ))}
          </View>
          <Button title={`📷  ${t('takePhoto')}`} onPress={() => snap(undefined)} kind={hasDamage && photos.length === 0 ? 'primary' : 'secondary'} />
          {hasDamage && photos.length === 0 && <Text style={{ color: colors.red, marginTop: 8, fontWeight: '600' }}>{t('photoRequired')}</Text>}
        </View>
        <View style={card(colors)}>
          <Text style={{ color: colors.ink2, fontWeight: '600' }}>{t('signer')}</Text>
          <TextInput style={field} value={signer} onChangeText={setSigner} />
          <Text style={{ color: colors.ink2, fontWeight: '600', marginTop: 12 }}>{t('notes')}</Text>
          <TextInput style={[field, { minHeight: 70 }]} value={notes} onChangeText={setNotes} multiline />
        </View>
        {error && <Text style={{ color: colors.red, fontWeight: '700', fontSize: 15 }}>{error}</Text>}
      </ScrollView>
      <View style={{ padding: 14, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.rule }}>
        <Button title={`${t('submit')}${total ? ` · ${total}` : ''}`} onPress={submit} disabled={busy || total === 0} />
      </View>
    </KeyboardAvoidingView>
  );
}
