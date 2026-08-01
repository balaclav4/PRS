import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CircleCheck, Target, FlaskConical, TrendingUp, Gauge, Zap, BarChart3, Ruler, BookCheck, ChevronRight, ArrowLeft, Plus, Trash2, Info, TriangleAlert } from 'lucide-react-native';
import { useState, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useTheme } from '../../lib/theme';
import { useData } from '../../store/data';
import { parseRungs, findNode, bestGroup } from '../../lib/loaddev';

const STEP_META = [
  { num: 1, label: 'Goal', icon: Target, desc: 'Define your accuracy goal and hit-rate target for this load.' },
  { num: 2, label: 'Screen', icon: FlaskConical, desc: 'Screen candidate powders and bullets for the barrel.' },
  { num: 3, label: 'Max Chg', icon: TrendingUp, desc: 'Work up to a pressure-safe maximum charge.' },
  { num: 4, label: 'Accuracy', icon: BarChart3, desc: 'Coarse accuracy check across the charge range.' },
  { num: 5, label: 'Primers', icon: Zap, desc: 'Compare primer brands for the lowest velocity SD.' },
  { num: 6, label: 'Ladder', icon: Gauge, desc: 'Vary charge in small steps and look for a flat velocity node.' },
  { num: 7, label: 'Seating', icon: Ruler, desc: 'Tune seating depth (CBTO) around the chosen node.' },
  { num: 8, label: 'Ref', icon: BookCheck, desc: 'Confirm the reference load over full distance.' },
];

/** Steps without a data model yet. Saying so beats a convincing fake table. */
function NotBuiltStep({ colors, label }) {
  return (
    <View style={[cs.notBuilt, { backgroundColor: colors.inset, borderColor: colors.ibd }]}>
      <Info size={18} color={colors.mut} />
      <Text style={[cs.notBuiltText, { color: colors.mut }]}>
        {label} isn't built yet. The charge ladder (step 6) is the working step —
        it records real rungs and analyses them. Nothing here is recorded, so
        there's no data to show.
      </Text>
    </View>
  );
}

export default function ReloadingScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { projects, rifles, loads, updateProject } = useData();

  const project = projects[0] || null;
  const [step, setStep] = useState(project?.currentStep || 6);

  const meta = STEP_META[step - 1];
  const StepIcon = meta.icon;

  const rungs = project?.rungs || [];
  const parsed = useMemo(() => parseRungs(rungs), [rungs]);
  const analysis = useMemo(
    () => findNode(parsed, { shotsPerCharge: project?.shotsPerCharge || 1 }),
    [parsed, project?.shotsPerCharge]
  );
  const best = useMemo(() => bestGroup(parsed), [parsed]);

  const rifle = rifles.find(r => r.id === project?.rifleId);
  const load = loads.find(l => l.id === project?.loadId);

  const setField = (field, value) => project && updateProject(project.id, { [field]: value });

  const setRung = (id, field, value) => {
    if (!project) return;
    updateProject(project.id, {
      rungs: rungs.map(r => r.id === id ? { ...r, [field]: value } : r),
    });
  };

  const addRung = () => {
    if (!project) return;
    // Continue the ladder at the same interval the user has been using.
    const last = rungs[rungs.length - 1];
    const prev = rungs[rungs.length - 2];
    let nextCharge = '';
    if (last) {
      const lc = parseFloat(last.charge);
      const pc = prev ? parseFloat(prev.charge) : NaN;
      const stepGr = isFinite(lc) && isFinite(pc) ? +(lc - pc).toFixed(2) : 0.2;
      if (isFinite(lc)) nextCharge = String(+(lc + (stepGr || 0.2)).toFixed(2));
    }
    updateProject(project.id, {
      rungs: [...rungs, { id: 'r' + Date.now(), charge: nextCharge, velocity: '', groupMoa: '' }],
    });
  };

  const removeRung = (id) =>
    project && updateProject(project.id, { rungs: rungs.filter(r => r.id !== id) });

  const goStep = (n) => {
    setStep(n);
    if (project) updateProject(project.id, { currentStep: n });
  };

  if (!project) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
        <ScrollView contentContainerStyle={s.scroll}>
          <View style={s.header}>
            <TouchableOpacity
              onPress={() => router.canGoBack?.() ? router.back() : router.replace('/')}
              style={[s.backBtn, { backgroundColor: colors.card, borderColor: colors.bd }]}
            >
              <ArrowLeft size={19} color={colors.tx} />
            </TouchableOpacity>
            <Text style={[s.title, { color: colors.tx }]}>Load Development</Text>
          </View>
          <View style={[cs.notBuilt, { backgroundColor: colors.card, borderColor: colors.bd }]}>
            <Info size={18} color={colors.mut} />
            <Text style={[cs.notBuiltText, { color: colors.mut }]}>
              No load development project yet.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

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
          <Text style={[s.title, { color: colors.tx }]}>Load Development</Text>
        </View>

        <View style={[s.projCard, { backgroundColor: colors.card, borderColor: colors.bd }]}>
          <View style={s.projHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[s.projName, { color: colors.tx }]}>{project.name}</Text>
              <Text style={[s.projSub, { color: colors.mut }]}>
                {[rifle?.name, load?.name].filter(Boolean).join(' · ') || 'No rifle or load linked'}
              </Text>
            </View>
            <View style={[s.badge, { backgroundColor: colors.warns }]}>
              <Text style={[s.badgeText, { color: colors.warnt }]}>IN PROGRESS</Text>
            </View>
          </View>
          {/* Reads from the project, so editing the goal in step 1 shows here. */}
          <View style={[s.projStats, { borderTopColor: colors.line }]}>
            <View>
              <Text style={[s.projStatVal, { color: colors.tx }]}>≤{project.goalMoa || '—'}</Text>
              <Text style={[s.projStatLabel, { color: colors.mut }]}>Goal MOA</Text>
            </View>
            <View>
              <Text style={[s.projStatVal, { color: colors.tx }]}>{project.hitRatePct || '—'}%</Text>
              <Text style={[s.projStatLabel, { color: colors.mut }]}>Hit target</Text>
            </View>
            <View>
              <Text style={[s.projStatVal, { color: colors.tx }]}>{project.testDistanceYd || '—'}</Text>
              <Text style={[s.projStatLabel, { color: colors.mut }]}>yards</Text>
            </View>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, marginVertical: 16 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 6 }}>
          {STEP_META.map((sm) => {
            const sel = sm.num === step;
            // Only the ladder can be "done" — it is the only step holding data.
            const done = sm.num === 6 && parsed.length >= 3;
            return (
              <TouchableOpacity key={sm.num} onPress={() => goStep(sm.num)} style={s.stepBtn}>
                <View style={[s.stepCircle, {
                  backgroundColor: sel ? '#6D3BEB' : (done ? colors.acs : colors.inset),
                  borderColor: sel ? '#6D3BEB' : (done ? colors.acs : colors.ibd),
                }]}>
                  <Text style={[s.stepMark, { color: sel ? '#fff' : (done ? colors.act : colors.fnt) }]}>
                    {done && !sel ? '✓' : String(sm.num)}
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

          {step === 1 && (
            <View style={cs.wrap}>
              <View style={cs.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[cs.lbl, { color: colors.mut }]}>Goal MOA</Text>
                  <View style={[cs.inp, { backgroundColor: colors.input, borderColor: colors.ibd }]}>
                    <TextInput
                      value={String(project.goalMoa ?? '')}
                      onChangeText={v => setField('goalMoa', v)}
                      keyboardType="decimal-pad"
                      style={[cs.inpText, { color: colors.tx }]}
                    />
                    <Text style={[cs.unit, { color: colors.fnt }]}>MOA</Text>
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[cs.lbl, { color: colors.mut }]}>Hit Rate Target</Text>
                  <View style={[cs.inp, { backgroundColor: colors.input, borderColor: colors.ibd }]}>
                    <TextInput
                      value={String(project.hitRatePct ?? '')}
                      onChangeText={v => setField('hitRatePct', v)}
                      keyboardType="number-pad"
                      style={[cs.inpText, { color: colors.tx }]}
                    />
                    <Text style={[cs.unit, { color: colors.fnt }]}>%</Text>
                  </View>
                </View>
              </View>
              <View>
                <Text style={[cs.lbl, { color: colors.mut }]}>Test Distance</Text>
                <View style={[cs.inp, { backgroundColor: colors.input, borderColor: colors.ibd }]}>
                  <TextInput
                    value={String(project.testDistanceYd ?? '')}
                    onChangeText={v => setField('testDistanceYd', v)}
                    keyboardType="number-pad"
                    style={[cs.inpText, { color: colors.tx }]}
                  />
                  <Text style={[cs.unit, { color: colors.fnt }]}>yards</Text>
                </View>
              </View>
              <View style={[cs.note, { backgroundColor: colors.acs }]}>
                <Text style={[cs.noteText, { color: colors.act }]}>
                  Saved to the project — the card above updates as you type.
                </Text>
              </View>
            </View>
          )}

          {step === 6 && (
            <View style={cs.wrap}>
              <View style={cs.ladderHead}>
                <Text style={[cs.colH, { color: colors.fnt, flex: 1 }]}>CHARGE</Text>
                <Text style={[cs.colH, { color: colors.fnt, flex: 1, textAlign: 'center' }]}>VEL</Text>
                <Text style={[cs.colH, { color: colors.fnt, flex: 1, textAlign: 'center' }]}>GROUP</Text>
                <View style={{ width: 30 }} />
              </View>

              {rungs.length === 0 && (
                <Text style={[cs.emptyLadder, { color: colors.mut }]}>
                  No rungs yet. Add one for each charge weight you fired.
                </Text>
              )}

              {rungs.map((r) => {
                const isNode = analysis.node && parseFloat(r.charge) === analysis.node.centreCharge;
                return (
                  <View key={r.id} style={[cs.ladderRow, isNode && analysis.node.significant && { backgroundColor: colors.oks }]}>
                    <View style={[cs.cell, { backgroundColor: colors.input, borderColor: colors.ibd }]}>
                      <TextInput value={r.charge} onChangeText={v => setRung(r.id, 'charge', v)}
                        placeholder="gr" placeholderTextColor={colors.fnt}
                        keyboardType="decimal-pad" style={[cs.cellText, { color: colors.tx }]} />
                    </View>
                    <View style={[cs.cell, { backgroundColor: colors.input, borderColor: colors.ibd }]}>
                      <TextInput value={r.velocity} onChangeText={v => setRung(r.id, 'velocity', v)}
                        placeholder="fps" placeholderTextColor={colors.fnt}
                        keyboardType="number-pad" style={[cs.cellText, { color: colors.tx }]} />
                    </View>
                    <View style={[cs.cell, { backgroundColor: colors.input, borderColor: colors.ibd }]}>
                      <TextInput value={r.groupMoa} onChangeText={v => setRung(r.id, 'groupMoa', v)}
                        placeholder="MOA" placeholderTextColor={colors.fnt}
                        keyboardType="decimal-pad" style={[cs.cellText, { color: colors.tx }]} />
                    </View>
                    <TouchableOpacity onPress={() => removeRung(r.id)} style={cs.rowDel}>
                      <Trash2 size={15} color={colors.fnt} />
                    </TouchableOpacity>
                  </View>
                );
              })}

              <TouchableOpacity onPress={addRung} style={[cs.addRung, { borderColor: colors.ibd }]}>
                <Plus size={15} color={colors.act} />
                <Text style={[cs.addRungText, { color: colors.act }]}>Add rung</Text>
              </TouchableOpacity>

              <View style={cs.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[cs.lbl, { color: colors.mut }]}>Shots per charge</Text>
                  <View style={[cs.inp, { backgroundColor: colors.input, borderColor: colors.ibd }]}>
                    <TextInput
                      value={String(project.shotsPerCharge ?? 1)}
                      onChangeText={v => setField('shotsPerCharge', v)}
                      keyboardType="number-pad"
                      style={[cs.inpText, { color: colors.tx }]}
                    />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[cs.lbl, { color: colors.mut }]}>Best group</Text>
                  <View style={[cs.inp, { backgroundColor: colors.inset, borderColor: colors.ibd }]}>
                    <Text style={[cs.inpText, { color: colors.tx, paddingVertical: 12 }]}>
                      {best ? `${best.groupMoa} MOA @ ${best.charge}gr` : '—'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* The analysis. Verdict wording comes from lib/loaddev so the
                  uncertainty can't be dropped on its way to the screen. */}
              {analysis.node ? (
                <View style={[cs.result, {
                  backgroundColor: analysis.node.significant ? colors.oks : colors.warns,
                }]}>
                  {analysis.node.significant
                    ? <CircleCheck size={17} color={colors.okt} />
                    : <TriangleAlert size={17} color={colors.warnt} />}
                  <View style={{ flex: 1 }}>
                    <Text style={[cs.resultText, { color: analysis.node.significant ? colors.okt : colors.warnt }]}>
                      {analysis.verdict}
                    </Text>
                    <Text style={[cs.resultMeta, { color: analysis.node.significant ? colors.okt : colors.warnt }]}>
                      {analysis.node.slope} fps/gr across the flat window vs {analysis.node.overallSlope} overall
                      {analysis.velocitySd != null && ` · residual SD ${analysis.velocitySd} fps`}
                      {analysis.sdIsWeak && ' (few rungs — treat as rough)'}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={[cs.result, { backgroundColor: colors.inset }]}>
                  <Info size={17} color={colors.mut} />
                  <Text style={[cs.resultText, { color: colors.mut, flex: 1 }]}>{analysis.reason}</Text>
                </View>
              )}
            </View>
          )}

          {step !== 1 && step !== 6 && <NotBuiltStep colors={colors} label={meta.label} />}
        </View>

        {step < 8 && (
          <TouchableOpacity onPress={() => goStep(step + 1)} style={s.nextStepBtn}>
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
  notBuilt: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 14, borderRadius: 12, borderWidth: 1, marginTop: 4 },
  notBuiltText: { flex: 1, fontSize: 12.5, fontWeight: '600', lineHeight: 18 },
  ladderHead: { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  colH: { fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  ladderRow: { flexDirection: 'row', gap: 8, alignItems: 'center', borderRadius: 10, paddingVertical: 3 },
  cell: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10 },
  cellText: { paddingVertical: 10, fontSize: 14, fontFamily: 'JetBrainsMono_700Bold', width: '100%' },
  rowDel: { width: 30, alignItems: 'center', justifyContent: 'center' },
  addRung: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderStyle: 'dashed', borderRadius: 11, paddingVertical: 11, marginTop: 2 },
  addRungText: { fontSize: 13.5, fontWeight: '700' },
  emptyLadder: { fontSize: 12.5, fontWeight: '600', paddingVertical: 10, textAlign: 'center' },
  result: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 13, borderRadius: 12, marginTop: 6 },
  resultText: { fontSize: 12.5, fontWeight: '700', lineHeight: 18 },
  resultMeta: { fontSize: 11.5, fontWeight: '600', lineHeight: 16, marginTop: 5, opacity: 0.85 },
});

const s = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  backBtn: { width: 38, height: 38, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  projCard: { borderWidth: 1, borderRadius: 18, padding: 18 },
  projHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
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
  nextStepBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#6D3BEB', padding: 15, borderRadius: 14, marginTop: 16 },
  nextStepText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
