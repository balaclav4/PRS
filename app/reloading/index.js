import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CircleCheck, Hammer } from 'lucide-react-native';
import { useState } from 'react';
import { useTheme } from '../../lib/theme';

const STEP_META = [
  [1, 'Goal', 'Define your accuracy goal and hit-rate target for this load.'],
  [2, 'Screen', 'Screen candidate powders and bullets for the barrel.'],
  [3, 'Max Chg', 'Work up to a pressure-safe maximum charge.'],
  [4, 'Accuracy', 'Coarse accuracy check across the charge range.'],
  [5, 'Primers', 'Compare primer brands for the lowest velocity SD.'],
  [6, 'Ladder', 'Vary charge in 0.2gr steps to find the flat velocity node.'],
  [7, 'Seating', 'Tune seating depth (CBTO) around the chosen node.'],
  [8, 'Ref', 'Confirm the reference load over full distance.'],
];

const LADDER = [
  ['33.0', '2892', '0.34', false],
  ['33.2', '2905', '0.29', true],
  ['33.4', '2915', '0.31', false],
  ['33.6', '2931', '0.44', false],
  ['33.8', '2948', '0.52', false],
];

export default function ReloadingScreen() {
  const { colors } = useTheme();
  const [step, setStep] = useState(6);

  const meta = STEP_META[step - 1];
  const isLadder = step === 6;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[s.title, { color: colors.tx }]}>Load Development</Text>

        {/* Project card */}
        <View style={[s.projCard, { backgroundColor: colors.card, borderColor: colors.bd }]}>
          <View style={s.projHeader}>
            <View>
              <Text style={[s.projName, { color: colors.tx }]}>6 Dasher — AXSR</Text>
              <Text style={[s.projSub, { color: colors.mut }]}>Berger 105 Hybrid · Varget</Text>
            </View>
            <View style={[s.badge, { backgroundColor: colors.warns }]}>
              <Text style={[s.badgeText, { color: colors.warnt }]}>IN PROGRESS</Text>
            </View>
          </View>
          <View style={[s.projStats, { borderTopColor: colors.line }]}>
            <View>
              <Text style={[s.projStatVal, { color: colors.tx }]}>≤0.5</Text>
              <Text style={[s.projStatLabel, { color: colors.mut }]}>Goal MOA</Text>
            </View>
            <View>
              <Text style={[s.projStatVal, { color: colors.tx }]}>90%</Text>
              <Text style={[s.projStatLabel, { color: colors.mut }]}>Hit target</Text>
            </View>
            <View>
              <Text style={[s.projStatVal, { color: colors.tx }]}>100</Text>
              <Text style={[s.projStatLabel, { color: colors.mut }]}>yards</Text>
            </View>
          </View>
        </View>

        {/* Step rail */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, marginVertical: 16 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 6 }}>
          {STEP_META.map((sm) => {
            const num = sm[0];
            const done = num < 6;
            const sel = num === step;
            return (
              <TouchableOpacity key={num} onPress={() => setStep(num)} style={s.stepBtn}>
                <View style={[s.stepCircle, {
                  backgroundColor: sel ? '#6D3BEB' : (done ? colors.acs : colors.inset),
                  borderColor: sel ? '#6D3BEB' : (done ? colors.acs : colors.ibd),
                }]}>
                  <Text style={[s.stepMark, { color: sel ? '#fff' : (done ? colors.act : colors.fnt) }]}>
                    {done ? '✓' : String(num)}
                  </Text>
                </View>
                <Text style={[s.stepLabel, { color: colors.mut }]}>{sm[1]}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Step content */}
        <View style={[s.contentCard, { backgroundColor: colors.card, borderColor: colors.bd }]}>
          <Text style={[s.contentTitle, { color: colors.tx }]}>Step {step} — {meta[1]}</Text>
          <Text style={[s.contentDesc, { color: colors.mut }]}>{meta[2]}</Text>

          {isLadder ? (
            <View>
              <View style={s.ladderHeader}>
                <Text style={[s.ladderH, { color: colors.fnt }]}>Charge</Text>
                <Text style={[s.ladderH, { color: colors.fnt, textAlign: 'center' }]}>Vel</Text>
                <Text style={[s.ladderH, { color: colors.fnt, textAlign: 'right' }]}>Group</Text>
              </View>
              {LADDER.map((row, i) => (
                <View key={i} style={[s.ladderRow, { backgroundColor: row[3] ? colors.oks : 'transparent' }]}>
                  <Text style={[s.ladderCharge, { color: colors.tx }]}>{row[0]}<Text style={{ fontSize: 11, color: colors.fnt }}>gr</Text></Text>
                  <Text style={[s.ladderVel, { color: colors.mut }]}>{row[1]}</Text>
                  <Text style={[s.ladderGroup, {
                    color: row[3] ? '#15A34A' : (parseFloat(row[2]) <= 0.5 ? colors.tx : '#D97706'),
                  }]}>{row[2]} {row[3] ? '★' : ''}</Text>
                </View>
              ))}
              <View style={[s.nodeResult, { backgroundColor: colors.oks }]}>
                <CircleCheck size={17} color="#15A34A" />
                <Text style={[s.nodeText, { color: colors.okt }]}>Node at <Text style={{ fontFamily: 'JetBrainsMono_700Bold' }}>33.2gr</Text> — flat spot, 0.29 MOA</Text>
              </View>
              <TouchableOpacity onPress={() => setStep(7)} style={s.lockBtn}>
                <Text style={s.lockBtnText}>Lock charge → Seating Depth</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.stubWrap}>
              <View style={[s.stubIcon, { backgroundColor: colors.inset }]}>
                <Hammer size={24} color={colors.fnt} />
              </View>
              <Text style={[s.stubTitle, { color: colors.tx }]}>Step not built yet</Text>
              <Text style={[s.stubDesc, { color: colors.mut }]}>This is a prototype vertical slice — only the charge ladder (Step 6) is interactive. Tap it in the rail above.</Text>
              <TouchableOpacity onPress={() => setStep(6)} style={[s.stubBtn, { backgroundColor: colors.acs }]}>
                <Text style={[s.stubBtnText, { color: colors.act }]}>Go to Charge Ladder</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4, marginBottom: 16 },
  projCard: { borderWidth: 1, borderRadius: 18, padding: 18 },
  projHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  projName: { fontSize: 17, fontWeight: '800' },
  projSub: { fontSize: 13, fontWeight: '500', marginTop: 4 },
  badge: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  projStats: { flexDirection: 'row', gap: 20, marginTop: 16, paddingTop: 16, borderTopWidth: 1 },
  projStatVal: { fontSize: 17, fontWeight: '700', fontFamily: 'JetBrainsMono_700Bold' },
  projStatLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  stepBtn: { width: 56, alignItems: 'center' },
  stepCircle: { width: 40, height: 40, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  stepMark: { fontSize: 14, fontWeight: '800' },
  stepLabel: { fontSize: 10, fontWeight: '600', marginTop: 6, textAlign: 'center' },
  contentCard: { borderWidth: 1, borderRadius: 18, padding: 18, paddingHorizontal: 16 },
  contentTitle: { fontSize: 15, fontWeight: '800' },
  contentDesc: { fontSize: 12.5, fontWeight: '500', lineHeight: 18, marginTop: 6, marginBottom: 14 },
  ladderHeader: { flexDirection: 'row', paddingBottom: 8 },
  ladderH: { flex: 1, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  ladderRow: { flexDirection: 'row', alignItems: 'center', padding: 11, paddingHorizontal: 10, borderRadius: 10 },
  ladderCharge: { flex: 1, fontSize: 14, fontWeight: '700', fontFamily: 'JetBrainsMono_700Bold' },
  ladderVel: { flex: 1, fontSize: 14, fontWeight: '700', textAlign: 'center', fontFamily: 'JetBrainsMono_700Bold' },
  ladderGroup: { flex: 1, fontSize: 14, fontWeight: '700', textAlign: 'right', fontFamily: 'JetBrainsMono_700Bold' },
  nodeResult: { flexDirection: 'row', gap: 9, alignItems: 'center', marginTop: 12, padding: 12, paddingHorizontal: 14, borderRadius: 12 },
  nodeText: { flex: 1, fontSize: 12.5, fontWeight: '600' },
  lockBtn: { marginTop: 14, padding: 14, borderRadius: 13, backgroundColor: '#6D3BEB', alignItems: 'center' },
  lockBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  stubWrap: { alignItems: 'center', paddingVertical: 26, paddingHorizontal: 12 },
  stubIcon: { width: 52, height: 52, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  stubTitle: { fontSize: 14, fontWeight: '700' },
  stubDesc: { fontSize: 12.5, fontWeight: '500', lineHeight: 18, textAlign: 'center', marginTop: 6, maxWidth: 230 },
  stubBtn: { marginTop: 16, paddingVertical: 11, paddingHorizontal: 18, borderRadius: 12 },
  stubBtnText: { fontSize: 13, fontWeight: '700' },
});
