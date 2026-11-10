import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useSettings } from '../settings';

export function Button({ title, onPress, kind = 'primary', disabled, style }) {
  const { colors } = useSettings();
  const bg = kind === 'primary' ? colors.amber : colors.surface;
  const fg = kind === 'primary' ? colors.amberText : colors.ink;
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button"
      style={({ pressed }) => [{ backgroundColor: bg, borderColor: kind === 'primary' ? bg : colors.rule, borderWidth: 1, opacity: disabled ? 0.45 : pressed ? 0.85 : 1, minHeight: 52, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 }, style]}>
      <Text style={{ color: fg, fontSize: 17, fontWeight: '700' }}>{title}</Text>
    </Pressable>
  );
}

export function StatusPill({ status }) {
  const { colors, t } = useSettings();
  const map = { Active: [colors.surface2, colors.ink], Overdue: [colors.redSoft, colors.red], Disputed: ['#f0dfbd', '#7a4900'], Returned_Settled: ['#d3e8dd', colors.green] };
  const [bg, fg] = map[status] || map.Active;
  return <View style={{ backgroundColor: bg, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 }}><Text style={{ color: fg, fontSize: 12.5, fontWeight: '700' }}>{t(status)}</Text></View>;
}

/** Big-target quantity control for gloved hands: -  [ n ]  +  plus quick +10 and "all". */
export function Stepper({ label, value, max, onChange, tone, all }) {
  const { colors, t } = useSettings();
  const clamp = (n) => Math.max(0, Math.min(max, n));
  const btn = { width: 52, height: 52, borderRadius: 8, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.rule };
  const color = tone === 'bad' && value > 0 ? colors.red : colors.ink;
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={{ color: colors.ink2, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable style={btn} onPress={() => onChange(clamp(value - 1))} accessibilityLabel={`${label} -1`}><Text style={{ fontSize: 28, color: colors.ink }}>−</Text></Pressable>
        <View style={{ minWidth: 70, alignItems: 'center' }}><Text style={{ fontSize: 30, fontWeight: '800', color }}>{value}</Text></View>
        <Pressable style={btn} onPress={() => onChange(clamp(value + 1))} accessibilityLabel={`${label} +1`}><Text style={{ fontSize: 28, color: colors.ink }}>+</Text></Pressable>
        <Pressable style={[btn, { width: 62 }]} onPress={() => onChange(clamp(value + 10))}><Text style={{ fontSize: 17, fontWeight: '700', color: colors.ink }}>+10</Text></Pressable>
        {all && <Pressable style={[btn, { width: 62, backgroundColor: colors.amber, borderColor: colors.amber }]} onPress={() => onChange(max)}><Text style={{ fontSize: 16, fontWeight: '800', color: colors.amberText }}>{t('all2')}</Text></Pressable>}
      </View>
    </View>
  );
}

export const card = (colors) => ({ backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.rule, padding: 16 });
export const styles = StyleSheet.create({ h1: { fontSize: 26, fontWeight: '800' }, row: { flexDirection: 'row', alignItems: 'center' } });
