import React, { useState } from 'react';
import { View, Text, TextInput, KeyboardAvoidingView, Platform, ScrollView, Pressable, Image } from 'react-native';
import { useSettings } from '../settings';
import { useAuth } from '../auth';
import { Button } from '../components/ui';
import { getServer, setServer } from '../api';

const NEXUS_LIGHT = require('../../assets/brand/nexus-logo-light.png');
const NEXUS_DARK = require('../../assets/brand/nexus-logo-dark.png');

export default function LoginScreen() {
  const { colors, t, err, lang, setLang, toggleTheme, dark } = useSettings();
  const { login } = useAuth();
  const [email, setEmail] = useState('operator@ylm.batirent.cm');
  const [password, setPassword] = useState('Demo@2026');
  const [server, setSrv] = useState(getServer());
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const input = { backgroundColor: colors.surface, borderColor: colors.rule, borderWidth: 1, borderRadius: 8, padding: 14, fontSize: 17, color: colors.ink, marginTop: 6 };

  const submit = async () => {
    setBusy(true); setError(null);
    try { await setServer(server); await login(email.trim(), password); }
    catch (e) { setError(err(e)); setBusy(false); }
  };
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 70 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginBottom: 24 }}>
          <Pressable onPress={() => setLang(lang === 'fr' ? 'en' : 'fr')} style={{ padding: 8 }}><Text style={{ color: colors.ink, fontWeight: '800' }}>{lang === 'fr' ? 'FR | en' : 'fr | EN'}</Text></Pressable>
          <Pressable onPress={toggleTheme} style={{ padding: 8 }}><Text style={{ color: colors.ink, fontWeight: '800' }}>◐</Text></Pressable>
        </View>
        <Text style={{ fontSize: 40, fontWeight: '800', color: colors.ink }}>BatiRent</Text>
        <Text style={{ color: colors.amber, fontSize: 17, fontWeight: '700', marginBottom: 28 }}>Terrain</Text>
        <Text style={{ color: colors.ink2, fontWeight: '600' }}>{t('email')}</Text>
        <TextInput style={input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Text style={{ color: colors.ink2, fontWeight: '600', marginTop: 16 }}>{t('password')}</Text>
        <TextInput style={input} value={password} onChangeText={setPassword} secureTextEntry />
        <Text style={{ color: colors.ink2, fontWeight: '600', marginTop: 16 }}>{t('server')}</Text>
        <TextInput style={input} value={server} onChangeText={setSrv} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
        <Text style={{ color: colors.ink3, marginTop: 4, fontSize: 12.5 }}>{t('serverHint')}</Text>
        {error && <Text style={{ color: colors.red, marginTop: 16, fontWeight: '600' }}>{error}</Text>}
        <Button title={t('login')} onPress={submit} disabled={busy} style={{ marginTop: 24 }} />
        <View style={{ alignItems: 'center', marginTop: 40, opacity: 0.95 }}>
          <Text style={{ color: colors.ink3, fontSize: 13, marginBottom: 8 }}>{t('by')}</Text>
          <Image source={dark ? NEXUS_DARK : NEXUS_LIGHT} style={{ width: 120, height: 123 }} resizeMode="contain" accessibilityLabel="NEXUS Tech Labs" />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
