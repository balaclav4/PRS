import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CircleCheck, Target, FlaskConical, TrendingUp, Gauge, Zap, BarChart3, Ruler, BookCheck, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { useTheme } from '../../lib/theme';

const STEP_META = [
  { num: 1, label: 'Goal', icon: Target, desc: 'Define your accuracy goal and hit-rate target for this load.' },
  { num: 2, label: 'Screen', icon: FlaskConical, desc: 'Screen candidate powders and bullets for the barrel.' },
  { num: 3, label: 'Max Chg', icon: TrendingUp, desc: 'Work up to a pressure-safe maximum charge.' },
  { num: 4, label: 'Accuracy', icon: BarChart3, desc: 'Coarse accuracy check across the charge range.' },
  { num: 5, label: 'Primers', icon: Zap, desc: 'Compare primer brands for the lowest velocity SD.' },
  { num: 6, label: 'Ladder', icon: Gauge, desc: 'Vary charge in 0.2gr steps to find the flat velocity node.' },
  { num: 7, label: 'Seating', icon: Ruler, desc: 'Tune seating depth (CBTO) around the chosen node.' },
  { num: 8, label: 'Ref', icon: BookCheck, desc: 'Confirm the reference load over full distance.' },
];

const LADDER = [
  ['33.0', '2892', '0.34', false],
  ['33.2', '2905', '0.29', true],
  ['33.4', '2915', '0.31', false],
  ['33.6', '2931', '0.44', false],
  ['33.8', '2948', '0.52', false],
];

function GoalStep({ colors }) {
  const [goalMoa, setGoalMoa] = useState('0.5');
  const [hitRate, setHitRate] = useState('90');
  const [testDist, setTestDist] = useState('100');
  return (
    <View style={cs.wrap}>
      <View style={cs.row}>
        <View style={{ flex: 1 }}>
          <Text style={[cs.lbl, { color: colors.mut }]}>Goal MOA</Text>
          <View style={[cs.inp, { backgroundColor: colors.input, borderColor: colors.ibd }]}>
            <TextInput value={goalMoa} onChangeText={setGoalMoa} keyboardType="decimal-pad" style={[cs.inpText, { color: colors.tx }]} />
            <Text style={[cs.unit, { color: colors.fnt }]}>MOA</Text>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[cs.lbl, { color: colors.mut }]}>Hit Rate Target</Text>
          <View style={[cs.inp, { backgroundColor: colors.input, borderColor: colors.ibd }]}>
            <TextInput value={hitRate} onChangeText={setHitRate} keyboardType="number-pad" style={[cs.inpText, { color: colors.tx }]} />
            <Text style={[cs.unit, { color: colors.fnt }]}>%</Text>
          </View>
        </View>
      </View>
      <View>
        <Text style={[cs.lbl, { color: colors.mut }]}>Test Distance</Text>
        <View style={[cs.inp, { backgroundColor: colors.input, borderColor: colors.ibd }]}>
          <TextInput value={testDist} onChangeText={setTestDist} keyboardType="number-pad" style={[cs.inpText, { color: colors.tx }]} />
          <Text style={[cs.unit, { color: colors.fnt }]}>yards</Text>
        </View>
      </View>
      <View style={[cs.note, { backgroundColor: colors.acs }]}>
        <Text style={[cs.noteText, { color: colors.act }]}>Set realistic goals. Sub-0.5 MOA requires excellent brass prep and consistent technique.</Text>
      </View>
    </View>
  );
}

function ScreenStep({ colors }) {
  const candidates = [
    { powder: 'H4350', notes: 'Top performer in 6.5 CM barrels', status: 'pass' },
    { powder: 'Varget', notes: 'Temp stable, wide node window', status: 'pass' },
    { powder: 'RL-16', notes: 'Good velocity, narrower node', status: 'maybe' },
    { powder: 'IMR 4451', notes: 'Haven\'t tested yet', status: 'untested' },
  ];
  return (
    <View style={cs.wrap}>
      {candidates.map((c, i) => (
        <View key={i} style={[cs.candidateRow, { backgroundColor: colors.inset, borderColor: colors.ibd }]}>
          <View style={{ flex: 1 }}>
            <Text style={[cs.candidateName, { color: colors.tx }]}>{c.powder}</Text>
            <Text style={[cs.candidateNote, { color: colors.mut }]}>{c.notes}</Text>
          </View>
          <View style={[cs.statusBadge, {
            backgroundColor: c.status === 'pass' ? colors.oks : c.status === 'maybe' ? colors.warns : colors.inset
          }]}>
            <Text style={[cs.statusText, {
              color: c.status === 'pass' ? colors.okt : c.status === 'maybe' ? colors.warnt : colors.fnt
            }]}>{c.status === 'pass' ? 'Pass' : c.status === 'maybe' ? 'Maybe' : 'Test'}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function MaxChargeStep({ colors }) {
  const rows = [
    ['31.0', '2780', 'None'],
    ['32.0', '2845', 'None'],
    ['33.0', '2892', 'None'],
    ['34.0', '2960', 'Slight'],
    ['34.5', '2995', 'Ejector mark'],
  ];
  return (
    <View style={cs.wrap}>
      <View style={cs.tableHeader}>
        <Text style={[cs.tableH, { color: colors.fnt }]}>Charge</Text>
        <Text style={[cs.tableH, { color: colors.fnt, textAlign: 'center' }]}>Vel</Text>
        <Text style={[cs.tableH, { color: colors.fnt, textAlign: 'right' }]}>Signs</Text>
      </View>
      {rows.map((r, i) => (
        <View key={i} style={[cs.tableRow, { backgroundColor: i === rows.length - 1 ? colors.dngs : 'transparent' }]}>
          <Text style={[cs.tableCell, { color: colors.tx }]}>{r[0]}<Text style={{ fontSize: 11, color: colors.fnt }}>gr</Text></Text>
          <Text style={[cs.tableCell, { color: colors.mut, textAlign: 'center' }]}>{r[1]}</Text>
          <Text style={[cs.tableCell, { color: i === rows.length - 1 ? colors.dngt : (r[2] === 'Slight' ? colors.warnt : colors.tx), textAlign: 'right' }]}>{r[2]}</Text>
        </View>
      ))}
      <View style={[cs.note, { backgroundColor: colors.warns }]}>
        <Text style={[cs.noteText, { color: colors.warnt }]}>Max safe charge: 34.0gr. Back off 0.5–1.0gr for working loads.</Text>
      </View>
    </View>
  );
}

function AccuracyStep({ colors }) {
  const rows = [
    ['31.5', '0.68', false],
    ['32.0', '0.55', false],
    ['32.5', '0.41', true],
    ['33.0', '0.34', true],
    ['33.5', '0.48', false],
  ];
  return (
    <View style={cs.wrap}>
      <View style={cs.tableHeader}>
        <Text style={[cs.tableH, { color: colors.fnt }]}>Charge</Text>
        <Text style={[cs.tableH, { color: colors.fnt, textAlign: 'center' }]}>Group</Text>
        <Text style={[cs.tableH, { color: colors.fnt, textAlign: 'right' }]}>Status</Text>
      </View>
      {rows.map((r, i) => (
        <View key={i} style={[cs.tableRow, { backgroundColor: r[2] ? colors.oks : 'transparent' }]}>
          <Text style={[cs.tableCell, { color: colors.tx }]}>{r[0]}<Text style={{ fontSize: 11, color: colors.fnt }}>gr</Text></Text>
          <Text style={[cs.tableCell, { color: r[2] ? '#15A34A' : colors.mut, textAlign: 'center' }]}>{r[1]} MOA</Text>
          <Text style={[cs.tableCell, { color: r[2] ? colors.okt : colors.fnt, textAlign: 'right' }]}>{r[2] ? '✓ Pass' : '—'}</Text>
        </View>
      ))}
      <View style={[cs.note, { backgroundColor: colors.oks }]}>
        <Text style={[cs.noteText, { color: colors.okt }]}>Sweet spot at 32.5–33.0gr. Narrow down in the ladder step.</Text>
      </View>
    </View>
  );
}

function PrimersStep({ colors }) {
  const primers = [
    { name: 'Fed 210M', sd: 8.4, es: 24, pick: false },
    { name: 'CCI BR2', sd: 6.1, es: 18, pick: true },
    { name: 'CCI 200', sd: 11.2, es: 31, pick: false },
  ];
  return (
    <View style={cs.wrap}>
      {primers.map((p, i) => (
        <View key={i} style={[cs.primerRow, { backgroundColor: p.pick ? colors.oks : colors.inset, borderColor: p.pick ? colors.okbd : colors.ibd }]}>
          <View style={{ flex: 1 }}>
            <Text style={[cs.candidateName, { color: colors.tx }]}>{p.name}</Text>
            <View style={{ flexDirection: 'row', gap: 14, marginTop: 6 }}>
              <Text style={[cs.primerStat, { color: colors.mut }]}>SD <Text style={{ fontFamily: 'JetBrainsMono_700Bold', color: p.pick ? colors.okt : colors.tx }}>{p.sd}</Text></Text>
              <Text style={[cs.primerStat, { color: colors.mut }]}>ES <Text style={{ fontFamily: 'JetBrainsMono_700Bold', color: p.pick ? colors.okt : colors.tx }}>{p.es}</Text></Text>
            </View>
          </View>
          {p.pick && (
            <View style={[cs.statusBadge, { backgroundColor: colors.oks }]}>
              <Text style={[cs.statusText, { color: colors.okt }]}>Best</Text>
            </View>
          )}
        </View>
      ))}
      <View style={[cs.note, { backgroundColor: colors.oks }]}>
        <Text style={[cs.noteText, { color: colors.okt }]}>CCI BR2 gives the lowest SD. Lock primer and move to the charge ladder.</Text>
      </View>
    </View>
  );
}

function SeatingStep({ colors }) {
  const depths = [
    ['2.800', '0.38', false],
    ['2.810', '0.32', false],
    ['2.820', '0.26', true],
    ['2.830', '0.31', false],
    ['2.840', '0.44', false],
  ];
  return (
    <View style={cs.wrap}>
      <View style={cs.tableHeader}>
        <Text style={[cs.tableH, { color: colors.fnt }]}>CBTO</Text>
        <Text style={[cs.tableH, { color: colors.fnt, textAlign: 'center' }]}>Group</Text>
        <Text style={[cs.tableH, { color: colors.fnt, textAlign: 'right' }]}>Status</Text>
      </View>
      {depths.map((r, i) => (
        <View key={i} style={[cs.tableRow, { backgroundColor: r[2] ? colors.oks : 'transparent' }]}>
          <Text style={[cs.tableCell, { color: colors.tx }]}>{r[0]}"</Text>
          <Text style={[cs.tableCell, { color: r[2] ? '#15A34A' : colors.mut, textAlign: 'center' }]}>{r[1]} MOA</Text>
          <Text style={[cs.tableCell, { color: r[2] ? colors.okt : colors.fnt, textAlign: 'right' }]}>{r[2] ? '★ Best' : '—'}</Text>
        </View>
      ))}
      <View style={[cs.note, { backgroundColor: colors.oks }]}>
        <Text style={[cs.noteText, { color: colors.okt }]}>Optimal CBTO: 2.820". This is your seating depth for the reference load.</Text>
      </View>
    </View>
  );
}

function RefStep({ colors }) {
  const groups = [
    { dist: 100, group: '0.28', pass: true },
    { dist: 200, group: '0.52', pass: false },
    { dist: 300, group: '0.61', pass: false },
    { dist: 600, group: '1.04', pass: false },
  ];
  return (
    <View style={cs.wrap}>
      <View style={[cs.refCard, { backgroundColor: colors.inset, borderColor: colors.ibd }]}>
        <Text style={[cs.refTitle, { color: colors.tx }]}>Reference Load</Text>
        <Text style={[cs.refDetail, { color: colors.mut }]}>105 Hybrid · Varget 33.2gr · CCI BR2</Text>
        <Text style={[cs.refDetail, { color: colors.mut }]}>CBTO 2.820" · MV 2905 fps</Text>
      </View>
      {groups.map((g, i) => (
        <View key={i} style={[cs.refRow, { borderColor: colors.ibd }]}>
          <Text style={[cs.refDist, { color: colors.tx }]}>{g.dist}<Text style={{ fontSize: 11, color: colors.fnt }}> yd</Text></Text>
          <Text style={[cs.refGroup, { color: g.pass ? '#15A34A' : colors.tx }]}>{g.group} MOA</Text>
          <CircleCheck size={16} color={g.pass ? '#15A34A' : colors.fnt} />
        </View>
      ))}
      <View style={[cs.note, { backgroundColor: colors.oks }]}>
        <Text style={[cs.noteText, { color: colors.okt }]}>Load confirmed at distance. Ready for field use.</Text>
      </View>
    </View>
  );
}

export default function ReloadingScreen() {
  const { colors } = useTheme();
  const [step, setStep] = useState(6);
  const meta = STEP_META[step - 1];
  const StepIcon = meta.icon;

  const renderStepContent = () => {
    switch (step) {
      case 1: return <GoalStep colors={colors} />;
      case 2: return <ScreenStep colors={colors} />;
      case 3: return <MaxChargeStep colors={colors} />;
      case 4: return <AccuracyStep colors={colors} />;
      case 5: return <PrimersStep colors={colors} />;
      case 6: return (
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
              <Text style={[s.ladderGroup, { color: row[3] ? '#15A34A' : (parseFloat(row[2]) <= 0.5 ? colors.tx : '#D97706') }]}>{row[2]} {row[3] ? '★' : ''}</Text>
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
      );
      case 7: return <SeatingStep colors={colors} />;
      case 8: return <RefStep colors={colors} />;
      default: return null;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[s.title, { color: colors.tx }]}>Load Development</Text>

        <View style={[s.projCard, { backgroundColor: colors.card, borderColor: colors.bd }]}>
          <View style={s.projHeader}>
            <View>
              <Text style={[s.projName, { color: colors.tx }]}>6 Dasher — AXSR</Text>
              <Text style={[s.projSub, { color: colors.mut }]}>Berger 105 Hybrid · Varget</Text>
            </View>
            <View style={[s.badge, { backgroundColor: step >= 8 ? colors.oks : colors.warns }]}>
              <Text style={[s.badgeText, { color: step >= 8 ? colors.okt : colors.warnt }]}>{step >= 8 ? 'COMPLETE' : 'IN PROGRESS'}</Text>
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

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, marginVertical: 16 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 6 }}>
          {STEP_META.map((sm) => {
            const done = sm.num < step;
            const sel = sm.num === step;
            return (
              <TouchableOpacity key={sm.num} onPress={() => setStep(sm.num)} style={s.stepBtn}>
                <View style={[s.stepCircle, {
                  backgroundColor: sel ? '#6D3BEB' : (done ? colors.acs : colors.inset),
                  borderColor: sel ? '#6D3BEB' : (done ? colors.acs : colors.ibd),
                }]}>
                  <Text style={[s.stepMark, { color: sel ? '#fff' : (done ? colors.act : colors.fnt) }]}>
                    {done ? '✓' : String(sm.num)}
                  </Text>
                </View>
                <Text style={[s.stepLabel, { color: colors.mut }]}>{sm.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={[s.contentCard, { backgroundColor: colors.card, borderColor: colors.bd }]}>
          <View style={s.contentHeader}>
            <StepIcon size={18} color={colors.act} />
            <Text style={[s.contentTitle, { color: colors.tx }]}>Step {step} — {meta.label}</Text>
          </View>
          <Text style={[s.contentDesc, { color: colors.mut }]}>{meta.desc}</Text>
          {renderStepContent()}
        </View>

        {step < 8 && (
          <TouchableOpacity onPress={() => setStep(step + 1)} style={s.nextStepBtn}>
            <Text style={s.nextStepText}>Next: {STEP_META[step]?.label}</Text>
            <ChevronRight size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const cs = StyleSheet.create({
  wrap: { gap: 10, marginTop: 4 },
  row: { flexDirection: 'row', gap: 10 },
  lbl: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  inp: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14 },
  inpText: { flex: 1, paddingVertical: 12, fontSize: 15, fontFamily: 'JetBrainsMono_700Bold' },
  unit: { fontSize: 13, fontWeight: '600' },
  note: { padding: 12, paddingHorizontal: 14, borderRadius: 12, marginTop: 4 },
  noteText: { fontSize: 12.5, fontWeight: '600', lineHeight: 18 },
  candidateRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 14 },
  candidateName: { fontSize: 14, fontWeight: '700' },
  candidateNote: { fontSize: 12, fontWeight: '500', marginTop: 3 },
  statusBadge: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: '700' },
  tableHeader: { flexDirection: 'row', paddingBottom: 8 },
  tableH: { flex: 1, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  tableRow: { flexDirection: 'row', alignItems: 'center', padding: 11, paddingHorizontal: 10, borderRadius: 10 },
  tableCell: { flex: 1, fontSize: 14, fontWeight: '700', fontFamily: 'JetBrainsMono_700Bold' },
  primerRow: { borderWidth: 1, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center' },
  primerStat: { fontSize: 12, fontWeight: '600' },
  refCard: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 6 },
  refTitle: { fontSize: 14, fontWeight: '700' },
  refDetail: { fontSize: 12, fontWeight: '500', marginTop: 3 },
  refRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 10, borderBottomWidth: 1 },
  refDist: { width: 60, fontSize: 14, fontWeight: '700', fontFamily: 'JetBrainsMono_700Bold' },
  refGroup: { flex: 1, fontSize: 14, fontWeight: '700', fontFamily: 'JetBrainsMono_700Bold' },
});

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
  contentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  nextStepBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#6D3BEB', padding: 15, borderRadius: 14, marginTop: 16 },
  nextStepText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
