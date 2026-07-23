import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Crosshair, Thermometer, Gauge, Wind } from 'lucide-react-native';
import { useTheme } from '../../lib/theme';

const DOPE = [
  ['100', '0.0', '0.4'], ['200', '2.0', '0.9'], ['300', '4.4', '1.5'], ['400', '7.2', '2.1'],
  ['500', '10.4', '2.8'], ['600', '14.1', '3.6'], ['700', '18.4', '4.5'], ['800', '23.4', '5.5'],
  ['900', '29.2', '6.7'], ['1000', '35.9', '8.0'],
];

export default function BallisticsScreen() {
  const { colors } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[s.title, { color: colors.tx }]}>Ballistics</Text>

        {/* Active Load Card */}
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
              <Text style={s.loadStatVal}>2820</Text>
              <Text style={s.loadStatLabel}>MV fps</Text>
            </View>
            <View>
              <Text style={s.loadStatVal}>.607</Text>
              <Text style={s.loadStatLabel}>BC G1</Text>
            </View>
            <View>
              <Text style={s.loadStatVal}>8.4</Text>
              <Text style={s.loadStatLabel}>SD fps</Text>
            </View>
          </View>
        </View>

        {/* Environmentals */}
        <View style={s.envRow}>
          {[
            { Icon: Thermometer, val: '59°F' },
            { Icon: Gauge, val: '29.92' },
            { Icon: Wind, val: '10 mph' },
          ].map((e, i) => (
            <View key={i} style={[s.envTile, { backgroundColor: colors.card, borderColor: colors.bd }]}>
              <e.Icon size={18} color={colors.mut} />
              <Text style={[s.envVal, { color: colors.tx }]}>{e.val}</Text>
            </View>
          ))}
        </View>

        {/* Dope Card */}
        <View style={[s.dopeCard, { backgroundColor: colors.card, borderColor: colors.bd }]}>
          <View style={s.dopeHeader}>
            <Text style={[s.dopeTitle, { color: colors.tx }]}>Dope Card</Text>
            <Text style={[s.dopeSub, { color: colors.fnt }]}>100yd zero · MOA</Text>
          </View>
          <View style={s.dopeColHeaders}>
            <Text style={[s.dopeColH, { color: colors.fnt }]}>Range</Text>
            <Text style={[s.dopeColH, { color: colors.fnt, textAlign: 'center' }]}>Elev</Text>
            <Text style={[s.dopeColH, { color: colors.fnt, textAlign: 'right' }]}>Wind 10</Text>
          </View>
          {DOPE.map((row, i) => (
            <View key={i} style={[s.dopeRow, { borderTopColor: colors.line, backgroundColor: i === 0 ? colors.inset : 'transparent' }]}>
              <Text style={[s.dopeRange, { color: colors.tx }]}>{row[0]}<Text style={{ fontSize: 11, color: colors.fnt }}> yd</Text></Text>
              <Text style={[s.dopeElev, { color: colors.act }]}>{row[1]}</Text>
              <Text style={[s.dopeWind, { color: colors.mut }]}>{row[2]}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4, marginBottom: 16 },
  loadCard: { borderRadius: 18, padding: 18, backgroundColor: '#1A1922', overflow: 'hidden' },
  loadHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  loadSub: { fontSize: 12, fontWeight: '600', color: '#9E9BB0' },
  loadName: { fontSize: 18, fontWeight: '800', color: '#fff', marginTop: 6 },
  loadDetail: { fontSize: 13, fontWeight: '500', color: '#B9B6C8', marginTop: 4 },
  loadStats: { flexDirection: 'row', gap: 22, marginTop: 16 },
  loadStatVal: { fontSize: 19, fontWeight: '700', color: '#fff', fontFamily: 'JetBrainsMono_700Bold' },
  loadStatLabel: { fontSize: 11, fontWeight: '600', color: '#9E9BB0', marginTop: 2 },
  envRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  envTile: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 12, alignItems: 'center' },
  envVal: { fontSize: 15, fontWeight: '700', marginTop: 6, fontFamily: 'JetBrainsMono_700Bold' },
  dopeCard: { borderWidth: 1, borderRadius: 18, overflow: 'hidden', marginTop: 12 },
  dopeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 12 },
  dopeTitle: { fontSize: 15, fontWeight: '800' },
  dopeSub: { fontSize: 11, fontWeight: '700' },
  dopeColHeaders: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 8 },
  dopeColH: { flex: 1, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  dopeRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 11, borderTopWidth: 1 },
  dopeRange: { flex: 1, fontSize: 14, fontWeight: '700', fontFamily: 'JetBrainsMono_700Bold' },
  dopeElev: { flex: 1, fontSize: 14, fontWeight: '700', textAlign: 'center', fontFamily: 'JetBrainsMono_700Bold' },
  dopeWind: { flex: 1, fontSize: 14, fontWeight: '700', textAlign: 'right', fontFamily: 'JetBrainsMono_700Bold' },
});
