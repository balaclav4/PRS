import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Crosshair, Thermometer, Gauge, Wind, ArrowLeft } from 'lucide-react-native';
import { useState, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useTheme } from '../../lib/theme';
import { computeDopeCard } from '../../lib/math';

export default function BallisticsScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  const [mvFps, setMvFps] = useState('2820');
  const [bcG1, setBcG1] = useState('0.607');
  const [tempF, setTempF] = useState('59');
  const [pressureInHg, setPressureInHg] = useState('29.92');
  const [windMph, setWindMph] = useState('10');

  const dope = useMemo(() =>
    computeDopeCard(
      parseFloat(mvFps) || 2820,
      parseFloat(bcG1) || 0.607,
      1.5, 100,
      parseFloat(tempF) || 59,
      parseFloat(pressureInHg) || 29.92,
      parseFloat(windMph) || 10,
    ),
    [mvFps, bcG1, tempF, pressureInHg, windMph]
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <TouchableOpacity
            onPress={() => router.canGoBack?.() ? router.back() : router.replace('/')}
            style={[s.backBtn, { backgroundColor: colors.card, borderColor: colors.bd }]}
          >
            <ArrowLeft size={19} color={colors.tx} />
          </TouchableOpacity>
          <Text style={[s.title, { color: colors.tx }]}>Ballistics</Text>
        </View>

        <View style={s.loadCard}>
          <View style={s.loadHeader}>
            <View>
              <Text style={s.loadSub}>ACTIVE LOAD</Text>
              <Text style={s.loadName}>6.5 CM · 140 Hybrid</Text>
              <Text style={s.loadDetail}>H4350 · 41.8gr · Fed 210M</Text>
            </View>
            <Crosshair size={26} color="#8B6BF5" />
          </View>
          <View style={s.loadStats}>
            <View>
              <TextInput value={mvFps} onChangeText={setMvFps} keyboardType="number-pad"
                style={s.loadStatInput} selectTextOnFocus />
              <Text style={s.loadStatLabel}>MV fps</Text>
            </View>
            <View>
              <TextInput value={bcG1} onChangeText={setBcG1} keyboardType="decimal-pad"
                style={s.loadStatInput} selectTextOnFocus />
              <Text style={s.loadStatLabel}>BC G1</Text>
            </View>
            <View>
              <Text style={s.loadStatVal}>8.4</Text>
              <Text style={s.loadStatLabel}>SD fps</Text>
            </View>
          </View>
        </View>

        <View style={s.envRow}>
          <View style={[s.envTile, { backgroundColor: colors.card, borderColor: colors.bd }]}>
            <Thermometer size={18} color={colors.mut} />
            <TextInput value={tempF} onChangeText={setTempF} keyboardType="number-pad"
              style={[s.envInput, { color: colors.tx }]} selectTextOnFocus />
            <Text style={[s.envUnit, { color: colors.fnt }]}>°F</Text>
          </View>
          <View style={[s.envTile, { backgroundColor: colors.card, borderColor: colors.bd }]}>
            <Gauge size={18} color={colors.mut} />
            <TextInput value={pressureInHg} onChangeText={setPressureInHg} keyboardType="decimal-pad"
              style={[s.envInput, { color: colors.tx }]} selectTextOnFocus />
            <Text style={[s.envUnit, { color: colors.fnt }]}>inHg</Text>
          </View>
          <View style={[s.envTile, { backgroundColor: colors.card, borderColor: colors.bd }]}>
            <Wind size={18} color={colors.mut} />
            <TextInput value={windMph} onChangeText={setWindMph} keyboardType="number-pad"
              style={[s.envInput, { color: colors.tx }]} selectTextOnFocus />
            <Text style={[s.envUnit, { color: colors.fnt }]}>mph</Text>
          </View>
        </View>

        <View style={[s.dopeCard, { backgroundColor: colors.card, borderColor: colors.bd }]}>
          <View style={s.dopeHeader}>
            <Text style={[s.dopeTitle, { color: colors.tx }]}>Dope Card</Text>
            <Text style={[s.dopeSub, { color: colors.fnt }]}>100yd zero · MOA</Text>
          </View>
          <View style={s.dopeColHeaders}>
            <Text style={[s.dopeColH, { color: colors.fnt }]}>Range</Text>
            <Text style={[s.dopeColH, { color: colors.fnt, textAlign: 'center' }]}>Elev</Text>
            <Text style={[s.dopeColH, { color: colors.fnt, textAlign: 'center' }]}>Vel</Text>
            <Text style={[s.dopeColH, { color: colors.fnt, textAlign: 'right' }]}>Wind</Text>
          </View>
          {dope.map((row, i) => (
            <View key={i} style={[s.dopeRow, { borderTopColor: colors.line, backgroundColor: i === 0 ? colors.inset : 'transparent' }]}>
              <Text style={[s.dopeRange, { color: colors.tx }]}>{row.range}<Text style={{ fontSize: 11, color: colors.fnt }}> yd</Text></Text>
              <Text style={[s.dopeElev, { color: colors.act }]}>{row.elevMoa}</Text>
              <Text style={[s.dopeVel, { color: colors.mut }]}>{row.velFps}</Text>
              <Text style={[s.dopeWind, { color: colors.mut }]}>{row.windMoa}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  backBtn: { width: 38, height: 38, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  loadCard: { borderRadius: 18, padding: 18, backgroundColor: '#1A1922', overflow: 'hidden' },
  loadHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  loadSub: { fontSize: 12, fontWeight: '600', color: '#9E9BB0' },
  loadName: { fontSize: 18, fontWeight: '800', color: '#fff', marginTop: 6 },
  loadDetail: { fontSize: 13, fontWeight: '500', color: '#B9B6C8', marginTop: 4 },
  loadStats: { flexDirection: 'row', gap: 22, marginTop: 16 },
  loadStatInput: { fontSize: 19, fontWeight: '700', color: '#fff', fontFamily: 'JetBrainsMono_700Bold', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.2)', paddingBottom: 2, minWidth: 50 },
  loadStatVal: { fontSize: 19, fontWeight: '700', color: '#fff', fontFamily: 'JetBrainsMono_700Bold' },
  loadStatLabel: { fontSize: 11, fontWeight: '600', color: '#9E9BB0', marginTop: 4 },
  envRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  envTile: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 10, alignItems: 'center', gap: 4 },
  envInput: { fontSize: 15, fontWeight: '700', fontFamily: 'JetBrainsMono_700Bold', textAlign: 'center', width: '100%', padding: 2 },
  envUnit: { fontSize: 10, fontWeight: '600' },
  dopeCard: { borderWidth: 1, borderRadius: 18, overflow: 'hidden', marginTop: 12 },
  dopeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 12 },
  dopeTitle: { fontSize: 15, fontWeight: '800' },
  dopeSub: { fontSize: 11, fontWeight: '700' },
  dopeColHeaders: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 8 },
  dopeColH: { flex: 1, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  dopeRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 11, borderTopWidth: 1 },
  dopeRange: { flex: 1, fontSize: 14, fontWeight: '700', fontFamily: 'JetBrainsMono_700Bold' },
  dopeElev: { flex: 1, fontSize: 14, fontWeight: '700', textAlign: 'center', fontFamily: 'JetBrainsMono_700Bold' },
  dopeVel: { flex: 1, fontSize: 14, fontWeight: '700', textAlign: 'center', fontFamily: 'JetBrainsMono_700Bold' },
  dopeWind: { flex: 1, fontSize: 14, fontWeight: '700', textAlign: 'right', fontFamily: 'JetBrainsMono_700Bold' },
});
