import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CircleCheck, Target, FlaskConical, TrendingUp, Gauge, Zap, BarChart3, Ruler, BookCheck, ChevronRight, ArrowLeft, Plus, Trash2, Info, TriangleAlert } from 'lucide-react-native';
import { useState, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useTheme } from '../../lib/theme';
import { useData } from '../../store/data';
import { parseRungs, findNode, bestGroup } from '../../lib/loaddev';
import { parseDepths, analyseSeating } from '../../lib/seating';
import { assessReference } from '../../lib/refload';
import { parseStrings, comparePrimers } from '../../lib/primers';
import { parseWorkup, analyseWorkup } from '../../lib/pressure';
import { parseCandidates, analyseScreen } from '../../lib/screening';
import ChronoImport from '../../components/ChronoImport';

const STEP_META = [
  { num: 1, label: 'Goal', icon: Target, desc: 'Define your accuracy goal and hit-rate target for this load.' },
  { num: 2, label: 'Screen', icon: FlaskConical, desc: 'Screen candidate powders and bullets for the barrel.' },
  { num: 3, label: 'Max Chg', icon: TrendingUp, desc: 'Chart velocity against charge and watch for the curve bending upward.' },
  { num: 4, label: 'Accuracy', icon: BarChart3, desc: 'Coarse accuracy check across the charge range.' },
  { num: 5, label: 'Primers', icon: Zap, desc: 'Compare primer brands for the lowest velocity SD.' },
  { num: 6, label: 'Ladder', icon: Gauge, desc: 'Vary charge in small steps and look for a flat velocity node.' },
  { num: 7, label: 'Seating', icon: Ruler, desc: 'Tune seating depth (CBTO) around the chosen node.' },
  { num: 8, label: 'Ref', icon: BookCheck, desc: 'Confirm the reference load over full distance.' },
];

function NumField({ colors, label, unit, value, onChange }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[cs.lbl, { color: colors.mut }]}>{label}</Text>
      <View style={[cs.inp, { backgroundColor: colors.input, borderColor: colors.ibd }]}>
        <TextInput
          value={value == null ? '' : String(value)}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          style={[cs.inpText, { color: colors.tx }]}
        />
        {!!unit && <Text style={[cs.unit, { color: colors.fnt }]}>{unit}</Text>}
      </View>
    </View>
  );
}

export default function ReloadingScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { projects, rifles, loads, updateProject } = useData();

  const project = projects[0] || null;
  const [step, setStep] = useState(project?.currentStep || 6);
  const [chronoRung, setChronoRung] = useState(null);

  const meta = STEP_META[step - 1];
  const StepIcon = meta.icon;

  const rungs = project?.rungs || [];
  const parsed = useMemo(() => parseRungs(rungs), [rungs]);
  const analysis = useMemo(
    () => findNode(parsed, { shotsPerCharge: project?.shotsPerCharge || 1 }),
    [parsed, project?.shotsPerCharge]
  );
  const best = useMemo(() => bestGroup(parsed), [parsed]);

  const seatingRows = project?.seatingRows || [];
  const seatingShots = project?.seatingShots || 5;
  const depths = useMemo(() => parseDepths(seatingRows), [seatingRows]);
  const seating = useMemo(() => analyseSeating(depths, seatingShots), [depths, seatingShots]);

  const setDepth = (id, field, value) => {
    if (!project) return;
    updateProject(project.id, {
      seatingRows: seatingRows.map(r => r.id === id ? { ...r, [field]: value } : r),
    });
  };
  const addDepth = () => {
    if (!project) return;
    // Continue at whatever increment is already in use; 0.003" is the common
    // starting step for a seating ladder.
    const last = seatingRows[seatingRows.length - 1];
    const prev = seatingRows[seatingRows.length - 2];
    let next = '';
    if (last) {
      const lc = parseFloat(last.cbto), pc = prev ? parseFloat(prev.cbto) : NaN;
      const inc = isFinite(lc) && isFinite(pc) ? +(lc - pc).toFixed(4) : 0.003;
      if (isFinite(lc)) next = String(+(lc + (inc || 0.003)).toFixed(3));
    }
    updateProject(project.id, {
      seatingRows: [...seatingRows, { id: 'd' + Date.now(), cbto: next, groupMoa: '' }],
    });
  };
  const removeDepth = (id) =>
    project && updateProject(project.id, { seatingRows: seatingRows.filter(r => r.id !== id) });

  // Steps 2 and 4 are the same shape — several candidates, one group each, and
  // the same refusal to rank them. Only the label on the first column differs.
  const screenRows = project?.screenRows || [];
  const screenShots = project?.screenShots || 5;
  const screen = useMemo(
    () => analyseScreen(parseCandidates(screenRows), screenShots),
    [screenRows, screenShots]
  );
  const coarseRows = project?.coarseRows || [];
  const coarseShots = project?.coarseShots || 5;
  const coarse = useMemo(
    () => analyseScreen(parseCandidates(coarseRows), coarseShots, 'charges'),
    [coarseRows, coarseShots]
  );

  const candidateOps = (key, list) => ({
    set: (id, field, value) => project && updateProject(project.id, {
      [key]: list.map(r => r.id === id ? { ...r, [field]: value } : r),
    }),
    add: () => project && updateProject(project.id, {
      [key]: [...list, { id: 'x' + Date.now(), name: '', groupMoa: '' }],
    }),
    remove: (id) => project && updateProject(project.id, {
      [key]: list.filter(r => r.id !== id),
    }),
  });

  const workupRows = project?.workupRows || [];
  const workupPoints = useMemo(() => parseWorkup(workupRows), [workupRows]);
  const workup = useMemo(
    () => analyseWorkup(workupPoints, project?.bookMaxGr ? Number(project.bookMaxGr) : null),
    [workupPoints, project?.bookMaxGr]
  );

  const setWorkup = (id, field, value) => {
    if (!project) return;
    updateProject(project.id, {
      workupRows: workupRows.map(r => r.id === id ? { ...r, [field]: value } : r),
    });
  };
  const addWorkup = () => {
    if (!project) return;
    const last = workupRows[workupRows.length - 1];
    const prev = workupRows[workupRows.length - 2];
    let next = '';
    if (last) {
      const lc = parseFloat(last.charge), pc = prev ? parseFloat(prev.charge) : NaN;
      const inc = isFinite(lc) && isFinite(pc) ? +(lc - pc).toFixed(2) : 0.3;
      if (isFinite(lc)) next = String(+(lc + (inc || 0.3)).toFixed(2));
    }
    updateProject(project.id, {
      workupRows: [...workupRows, { id: 'w' + Date.now(), charge: next, velocity: '', sign: null }],
    });
  };
  const removeWorkup = (id) => project && updateProject(project.id, {
    workupRows: workupRows.filter(r => r.id !== id),
  });

  const primerRows = project?.primerRows || [];
  const primerStrings = useMemo(() => parseStrings(primerRows), [primerRows]);
  const primers = useMemo(() => comparePrimers(primerStrings), [primerStrings]);

  const setPrimer = (id, field, value) => {
    if (!project) return;
    updateProject(project.id, {
      primerRows: primerRows.map(r => r.id === id ? { ...r, [field]: value } : r),
    });
  };
  const addPrimer = () => project && updateProject(project.id, {
    primerRows: [...primerRows, { id: 'p' + Date.now(), brand: '', velocities: '' }],
  });
  const removePrimer = (id) => project && updateProject(project.id, {
    primerRows: primerRows.filter(r => r.id !== id),
  });

  // Step 8 works in target inches at the test distance, because that is what a
  // shooter reads off a plate. MOA is what the maths needs.
  const refDistance = Number(project?.testDistanceYd) || 0;
  const refTargetIn = Number(project?.refTargetIn) || 0;
  const refTargetMoa = refDistance > 0 && refTargetIn > 0
    ? refTargetIn / (1.047 * refDistance / 100)
    : null;
  const ref = useMemo(() => assessReference({
    hits: project?.refHits, shots: project?.refShots,
    groupMoa: project?.refGroupMoa, groupShots: project?.refGroupShots || 5,
    targetMoa: refTargetMoa,
    goalMoa: project?.goalMoa, hitRatePct: project?.hitRatePct,
  }), [project?.refHits, project?.refShots, project?.refGroupMoa,
       project?.refGroupShots, refTargetMoa, project?.goalMoa, project?.hitRatePct]);

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
            const done = (sm.num === 6 && parsed.length >= 3) ||
              (sm.num === 7 && depths.length >= 3) || (sm.num === 8 && ref.ok) ||
              (sm.num === 5 && primerStrings.length >= 2) || (sm.num === 3 && workup.ok) ||
              (sm.num === 2 && screen.ok) || (sm.num === 4 && coarse.ok);
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
                <View style={{ width: 52 }} />
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
                    {/* A rung with an imported string shows its mean and shot
                        count and is no longer hand-editable — the string is
                        the source of truth for both velocity and spread. */}
                    {r.velocities?.length ? (
                      <TouchableOpacity
                        onPress={() => setChronoRung(r.id)}
                        style={[cs.cell, cs.cellImported, { backgroundColor: colors.acs, borderColor: colors.act }]}
                      >
                        <Text style={[cs.cellText, { color: colors.act, paddingVertical: 10 }]}>
                          {Math.round(r.velocities.reduce((a, b) => a + b, 0) / r.velocities.length)}
                        </Text>
                        <Text style={[cs.cellBadge, { color: colors.act }]}>×{r.velocities.length}</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={[cs.cell, { backgroundColor: colors.input, borderColor: colors.ibd }]}>
                        <TextInput value={r.velocity} onChangeText={v => setRung(r.id, 'velocity', v)}
                          placeholder="fps" placeholderTextColor={colors.fnt}
                          keyboardType="number-pad" style={[cs.cellText, { color: colors.tx }]} />
                      </View>
                    )}
                    <View style={[cs.cell, { backgroundColor: colors.input, borderColor: colors.ibd }]}>
                      <TextInput value={r.groupMoa} onChangeText={v => setRung(r.id, 'groupMoa', v)}
                        placeholder="MOA" placeholderTextColor={colors.fnt}
                        keyboardType="decimal-pad" style={[cs.cellText, { color: colors.tx }]} />
                    </View>
                    <TouchableOpacity onPress={() => setChronoRung(r.id)} style={cs.rowAct}>
                      <Gauge size={15} color={r.velocities?.length ? colors.act : colors.fnt} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeRung(r.id)} style={cs.rowAct}>
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
                      {analysis.velocitySd != null && ` · noise ${analysis.velocitySd} fps (${analysis.sdSource})`}
                      {analysis.sdIsWeak && ' — treat as rough'}
                      {analysis.sdSource !== 'measured' && '\nImport a chrono string per rung for a measured noise figure.'}
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

          {step === 7 && (
            <View style={cs.wrap}>
              <View style={cs.ladderHead}>
                <Text style={[cs.colH, { color: colors.fnt, flex: 1 }]}>CBTO</Text>
                <Text style={[cs.colH, { color: colors.fnt, flex: 1, textAlign: 'center' }]}>GROUP</Text>
                <View style={{ width: 26 }} />
              </View>

              {seatingRows.length === 0 && (
                <Text style={[cs.emptyLadder, { color: colors.mut }]}>
                  No depths yet. Add one for each seating depth you tested.
                </Text>
              )}

              {seatingRows.map(r => {
                const isBest = seating.best && parseFloat(r.cbto) === seating.best.cbto;
                return (
                  <View key={r.id} style={[cs.ladderRow, isBest && seating.significant && { backgroundColor: colors.oks }]}>
                    <View style={[cs.cell, { backgroundColor: colors.input, borderColor: colors.ibd }]}>
                      <TextInput value={r.cbto} onChangeText={v => setDepth(r.id, 'cbto', v)}
                        placeholder="in" placeholderTextColor={colors.fnt}
                        keyboardType="decimal-pad" style={[cs.cellText, { color: colors.tx }]} />
                    </View>
                    <View style={[cs.cell, { backgroundColor: colors.input, borderColor: colors.ibd }]}>
                      <TextInput value={r.groupMoa} onChangeText={v => setDepth(r.id, 'groupMoa', v)}
                        placeholder="MOA" placeholderTextColor={colors.fnt}
                        keyboardType="decimal-pad" style={[cs.cellText, { color: colors.tx }]} />
                    </View>
                    <TouchableOpacity onPress={() => removeDepth(r.id)} style={cs.rowAct}>
                      <Trash2 size={15} color={colors.fnt} />
                    </TouchableOpacity>
                  </View>
                );
              })}

              <TouchableOpacity onPress={addDepth} style={[cs.addRung, { borderColor: colors.ibd }]}>
                <Plus size={15} color={colors.act} />
                <Text style={[cs.addRungText, { color: colors.act }]}>Add depth</Text>
              </TouchableOpacity>

              <View style={{ width: '50%' }}>
                <Text style={[cs.lbl, { color: colors.mut }]}>Shots per depth</Text>
                <View style={[cs.inp, { backgroundColor: colors.input, borderColor: colors.ibd }]}>
                  <TextInput
                    value={String(seatingShots)}
                    onChangeText={v => setField('seatingShots', v)}
                    keyboardType="number-pad"
                    style={[cs.inpText, { color: colors.tx }]}
                  />
                </View>
              </View>

              {seating.best ? (
                <View style={[cs.result, {
                  backgroundColor: seating.significant ? colors.oks : colors.warns,
                }]}>
                  {seating.significant
                    ? <CircleCheck size={17} color={colors.okt} />
                    : <TriangleAlert size={17} color={colors.warnt} />}
                  <View style={{ flex: 1 }}>
                    <Text style={[cs.resultText, { color: seating.significant ? colors.okt : colors.warnt }]}>
                      {seating.verdict}
                    </Text>
                    <Text style={[cs.resultMeta, { color: seating.significant ? colors.okt : colors.warnt }]}>
                      {depths.length} depths, typical {seating.level} MOA · a {seatingShots}-shot
                      group varies about ±{(seating.cv * 100).toFixed(0)}% ({seating.sigma} MOA) on
                      its own, before anything about the load changes
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={[cs.result, { backgroundColor: colors.inset }]}>
                  <Info size={17} color={colors.mut} />
                  <Text style={[cs.resultText, { color: colors.mut, flex: 1 }]}>{seating.reason}</Text>
                </View>
              )}
            </View>
          )}





          {(step === 2 || step === 4) && (() => {
            const isScreen = step === 2;
            const list = isScreen ? screenRows : coarseRows;
            const result = isScreen ? screen : coarse;
            const shotsVal = isScreen ? screenShots : coarseShots;
            const shotsKey = isScreen ? 'screenShots' : 'coarseShots';
            const ops = candidateOps(isScreen ? 'screenRows' : 'coarseRows', list);
            const nameLabel = isScreen ? 'POWDER / BULLET' : 'CHARGE';
            const namePlaceholder = isScreen ? 'H4350 / 140 Hybrid' : '42.0 gr';
            return (
              <View style={cs.wrap}>
                <View style={cs.ladderHead}>
                  <Text style={[cs.colH, { color: colors.fnt, flex: 2 }]}>{nameLabel}</Text>
                  <Text style={[cs.colH, { color: colors.fnt, flex: 1, textAlign: 'center' }]}>GROUP</Text>
                  <View style={{ width: 26 }} />
                </View>

                {list.length === 0 && (
                  <Text style={[cs.emptyLadder, { color: colors.mut }]}>
                    {isScreen
                      ? 'No combinations yet. Add one per powder and bullet pairing you shot.'
                      : 'No charges yet. Add one per charge weight you shot a group with.'}
                  </Text>
                )}

                {list.map(r => {
                  const stat = result.scored?.find(x => x.id === r.id);
                  return (
                    <View key={r.id} style={[cs.ladderRow,
                      stat?.eliminated && { backgroundColor: colors.warns }]}>
                      <View style={[cs.cell, { flex: 2, backgroundColor: colors.input, borderColor: colors.ibd }]}>
                        <TextInput value={r.name} onChangeText={v => ops.set(r.id, 'name', v)}
                          placeholder={namePlaceholder} placeholderTextColor={colors.fnt}
                          style={[cs.cellText, { color: colors.tx, textAlign: 'left' }]} />
                      </View>
                      <View style={[cs.cell, { backgroundColor: colors.input, borderColor: colors.ibd }]}>
                        <TextInput value={r.groupMoa} onChangeText={v => ops.set(r.id, 'groupMoa', v)}
                          placeholder="MOA" placeholderTextColor={colors.fnt}
                          keyboardType="decimal-pad" style={[cs.cellText, { color: colors.tx }]} />
                      </View>
                      <TouchableOpacity onPress={() => ops.remove(r.id)} style={cs.rowAct}>
                        <Trash2 size={15} color={colors.fnt} />
                      </TouchableOpacity>
                    </View>
                  );
                })}

                <TouchableOpacity onPress={ops.add} style={[cs.addRung, { borderColor: colors.ibd }]}>
                  <Plus size={15} color={colors.act} />
                  <Text style={[cs.addRungText, { color: colors.act }]}>
                    {isScreen ? 'Add combination' : 'Add charge'}
                  </Text>
                </TouchableOpacity>

                <View style={{ width: '50%' }}>
                  <Text style={[cs.lbl, { color: colors.mut }]}>Shots per group</Text>
                  <View style={[cs.inp, { backgroundColor: colors.input, borderColor: colors.ibd }]}>
                    <TextInput value={String(shotsVal)} onChangeText={v => setField(shotsKey, v)}
                      keyboardType="number-pad" style={[cs.inpText, { color: colors.tx }]} />
                  </View>
                </View>

                {result.ok ? (
                  <View style={[cs.result, {
                    backgroundColor: result.eliminated.length ? colors.warns : colors.inset,
                  }]}>
                    {result.eliminated.length
                      ? <TriangleAlert size={17} color={colors.warnt} />
                      : <Info size={17} color={colors.mut} />}
                    <Text style={[cs.resultText, {
                      color: result.eliminated.length ? colors.warnt : colors.mut, flex: 1,
                    }]}>{result.verdict}</Text>
                  </View>
                ) : (
                  <View style={[cs.result, { backgroundColor: colors.inset }]}>
                    <Info size={17} color={colors.mut} />
                    <Text style={[cs.resultText, { color: colors.mut, flex: 1 }]}>{result.reason}</Text>
                  </View>
                )}
              </View>
            );
          })()}

          {step === 3 && (
            <View style={cs.wrap}>
              <View style={[cs.note, { backgroundColor: colors.warns }]}>
                <Text style={[cs.noteText, { color: colors.warnt }]}>
                  This screen cannot tell you a load is safe, and never will. Your
                  powder and bullet maker's published data is the authority on
                  maximum charge. What it can do is spot velocity climbing faster
                  than the charge — a bend that shows up before brass does.
                </Text>
              </View>

              <View style={cs.ladderHead}>
                <Text style={[cs.colH, { color: colors.fnt, flex: 1 }]}>CHARGE</Text>
                <Text style={[cs.colH, { color: colors.fnt, flex: 1, textAlign: 'center' }]}>VEL</Text>
                <View style={{ width: 26 }} />
              </View>

              {workupRows.length === 0 && (
                <Text style={[cs.emptyLadder, { color: colors.mut }]}>
                  No charges yet. Add one per charge weight you fired.
                </Text>
              )}

              {workupRows.map(r => {
                const stat = workup.rungs?.find(x => x.id === r.id);
                const hot = workup.bending && workup.departureCharge != null &&
                  parseFloat(r.charge) >= workup.departureCharge;
                return (
                  <View key={r.id}>
                    <View style={[cs.ladderRow, hot && { backgroundColor: colors.warns }]}>
                      <View style={[cs.cell, { backgroundColor: colors.input, borderColor: colors.ibd }]}>
                        <TextInput value={r.charge} onChangeText={v => setWorkup(r.id, 'charge', v)}
                          placeholder="gr" placeholderTextColor={colors.fnt}
                          keyboardType="decimal-pad" style={[cs.cellText, { color: colors.tx }]} />
                      </View>
                      <View style={[cs.cell, { backgroundColor: colors.input, borderColor: colors.ibd }]}>
                        <TextInput value={r.velocity} onChangeText={v => setWorkup(r.id, 'velocity', v)}
                          placeholder="fps" placeholderTextColor={colors.fnt}
                          keyboardType="decimal-pad" style={[cs.cellText, { color: colors.tx }]} />
                      </View>
                      <TouchableOpacity onPress={() => removeWorkup(r.id)} style={cs.rowAct}>
                        <Trash2 size={15} color={colors.fnt} />
                      </TouchableOpacity>
                    </View>
                    <View style={cs.signRow}>
                      {['none', 'stiff bolt', 'ejector mark', 'cratered primer'].map(sg => {
                        const on = (r.sign || 'none') === sg;
                        return (
                          <TouchableOpacity key={sg} onPress={() => setWorkup(r.id, 'sign', sg)}
                            style={[cs.signChip, {
                              backgroundColor: on && sg !== 'none' ? colors.warns : on ? colors.inset : 'transparent',
                              borderColor: on ? colors.act : colors.ibd,
                            }]}>
                            <Text style={[cs.signText, {
                              color: on && sg !== 'none' ? colors.warnt : on ? colors.tx : colors.fnt,
                            }]}>{sg}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {stat && (
                      <Text style={[cs.hint, { color: colors.mut, marginBottom: 6 }]}>
                        {stat.excess >= 0 ? '+' : ''}{stat.excess} fps against the lower-charge trend
                      </Text>
                    )}
                  </View>
                );
              })}

              <TouchableOpacity onPress={addWorkup} style={[cs.addRung, { borderColor: colors.ibd }]}>
                <Plus size={15} color={colors.act} />
                <Text style={[cs.addRungText, { color: colors.act }]}>Add charge</Text>
              </TouchableOpacity>

              <View style={{ width: '55%' }}>
                <Text style={[cs.lbl, { color: colors.mut }]}>Book maximum</Text>
                <View style={[cs.inp, { backgroundColor: colors.input, borderColor: colors.ibd }]}>
                  <TextInput value={project.bookMaxGr == null ? '' : String(project.bookMaxGr)}
                    onChangeText={v => setField('bookMaxGr', v)}
                    placeholder="from your manual" placeholderTextColor={colors.fnt}
                    keyboardType="decimal-pad" style={[cs.inpText, { color: colors.tx }]} />
                  <Text style={[cs.unit, { color: colors.fnt }]}>gr</Text>
                </View>
              </View>

              {workup.ok ? (
                <View style={[cs.result, {
                  backgroundColor: workup.bending || workup.signs.length || workup.overBook.length
                    ? colors.warns : colors.inset,
                }]}>
                  {workup.bending || workup.signs.length || workup.overBook.length
                    ? <TriangleAlert size={17} color={colors.warnt} />
                    : <Info size={17} color={colors.mut} />}
                  <Text style={[cs.resultText, {
                    color: workup.bending || workup.signs.length || workup.overBook.length
                      ? colors.warnt : colors.mut,
                    flex: 1,
                  }]}>{workup.verdict}</Text>
                </View>
              ) : (
                <View style={[cs.result, { backgroundColor: colors.inset }]}>
                  <Info size={17} color={colors.mut} />
                  <Text style={[cs.resultText, { color: colors.mut, flex: 1 }]}>{workup.reason}</Text>
                </View>
              )}
            </View>
          )}

          {step === 5 && (
            <View style={cs.wrap}>
              {primerRows.length === 0 && (
                <Text style={[cs.emptyLadder, { color: colors.mut }]}>
                  No primers yet. Add one per brand and paste the chronograph string.
                </Text>
              )}

              {primerRows.map(r => {
                const stat = primers.rows?.find(x => x.id === r.id);
                const isBest = primers.best && primers.best.id === r.id;
                return (
                  <View key={r.id} style={[cs.primerCard, {
                    backgroundColor: isBest && primers.significant ? colors.oks : colors.inset,
                    borderColor: colors.ibd,
                  }]}>
                    <View style={cs.row}>
                      <View style={{ flex: 1 }}>
                        <Text style={[cs.lbl, { color: colors.mut }]}>Brand</Text>
                        <View style={[cs.inp, { backgroundColor: colors.input, borderColor: colors.ibd }]}>
                          <TextInput value={r.brand} onChangeText={v => setPrimer(r.id, 'brand', v)}
                            placeholder="CCI 450" placeholderTextColor={colors.fnt}
                            style={[cs.inpText, { color: colors.tx }]} />
                        </View>
                      </View>
                      <TouchableOpacity onPress={() => removePrimer(r.id)} style={cs.rowAct}>
                        <Trash2 size={15} color={colors.fnt} />
                      </TouchableOpacity>
                    </View>
                    <Text style={[cs.lbl, { color: colors.mut }]}>Velocities (fps)</Text>
                    <View style={[cs.inp, { backgroundColor: colors.input, borderColor: colors.ibd, height: 'auto', minHeight: 44 }]}>
                      <TextInput value={r.velocities} onChangeText={v => setPrimer(r.id, 'velocities', v)}
                        placeholder="2810 2822 2815 2830 2818" placeholderTextColor={colors.fnt}
                        multiline style={[cs.inpText, { color: colors.tx, paddingVertical: 8 }]} />
                    </View>
                    {stat && (
                      <Text style={[cs.hint, { color: colors.mut, marginTop: 6 }]}>
                        {stat.n} shots · {stat.mean} fps avg · SD {stat.sd} fps
                        {stat.sdLow != null && ` (could be anywhere from ${stat.sdLow} to ${stat.sdHigh})`}
                        {' · ES '}{stat.es}
                      </Text>
                    )}
                  </View>
                );
              })}

              <TouchableOpacity onPress={addPrimer} style={[cs.addRung, { borderColor: colors.ibd }]}>
                <Plus size={15} color={colors.act} />
                <Text style={[cs.addRungText, { color: colors.act }]}>Add primer</Text>
              </TouchableOpacity>

              {primers.best ? (
                <View style={[cs.result, {
                  backgroundColor: primers.significant ? colors.oks : colors.warns,
                }]}>
                  {primers.significant
                    ? <CircleCheck size={17} color={colors.okt} />
                    : <TriangleAlert size={17} color={colors.warnt} />}
                  <Text style={[cs.resultText, {
                    color: primers.significant ? colors.okt : colors.warnt, flex: 1,
                  }]}>{primers.verdict}</Text>
                </View>
              ) : (
                <View style={[cs.result, { backgroundColor: colors.inset }]}>
                  <Info size={17} color={colors.mut} />
                  <Text style={[cs.resultText, { color: colors.mut, flex: 1 }]}>{primers.reason}</Text>
                </View>
              )}
            </View>
          )}

          {step === 8 && (
            <View style={cs.wrap}>
              <View style={cs.row}>
                <NumField colors={colors} label="Shots fired" unit=""
                  value={project.refShots} onChange={v => setField('refShots', v)} />
                <NumField colors={colors} label="Hits" unit=""
                  value={project.refHits} onChange={v => setField('refHits', v)} />
              </View>
              <View style={cs.row}>
                <NumField colors={colors} label="Group size" unit="MOA"
                  value={project.refGroupMoa} onChange={v => setField('refGroupMoa', v)} />
                <NumField colors={colors} label="Shots in group" unit=""
                  value={project.refGroupShots} onChange={v => setField('refGroupShots', v)} />
              </View>
              <NumField colors={colors} label="Target size" unit="in"
                value={project.refTargetIn} onChange={v => setField('refTargetIn', v)} />
              {refDistance > 0 && refTargetIn > 0 ? (
                <Text style={[cs.hint, { color: colors.fnt }]}>
                  {refTargetIn}" at {refDistance} yd is {refTargetMoa.toFixed(2)} MOA
                </Text>
              ) : (
                <Text style={[cs.hint, { color: colors.fnt }]}>
                  Set a test distance in step 1 to convert this to MOA.
                </Text>
              )}

              {ref.ok ? (
                <>
                  <View style={[cs.result, {
                    backgroundColor: ref.hitRate?.confirmed ? colors.oks : colors.warns,
                  }]}>
                    {ref.hitRate?.confirmed
                      ? <CircleCheck size={17} color={colors.okt} />
                      : <TriangleAlert size={17} color={colors.warnt} />}
                    <View style={{ flex: 1 }}>
                      <Text style={[cs.resultText, {
                        color: ref.hitRate?.confirmed ? colors.okt : colors.warnt,
                      }]}>{ref.verdict}</Text>
                    </View>
                  </View>
                  <View style={[cs.note, { backgroundColor: colors.inset }]}>
                    <Text style={[cs.noteText, { color: colors.mut }]}>
                      {ref.hits}/{ref.shots} is consistent with a true hit rate anywhere
                      from {ref.ci.low}% to {ref.ci.high}%.
                      {ref.diagnosis ? ` Dispersion alone predicts ${ref.diagnosis.predicted}% on this target.` : ''}
                    </Text>
                  </View>
                </>
              ) : (
                <View style={[cs.result, { backgroundColor: colors.inset }]}>
                  <Info size={17} color={colors.mut} />
                  <Text style={[cs.resultText, { color: colors.mut, flex: 1 }]}>{ref.reason}</Text>
                </View>
              )}
            </View>
          )}


        </View>

        {step < 8 && (
          <TouchableOpacity onPress={() => goStep(step + 1)} style={s.nextStepBtn}>
            <Text style={s.nextStepText}>Next: {STEP_META[step]?.label}</Text>
            <ChevronRight size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </ScrollView>

      <ChronoImport
        visible={chronoRung !== null}
        onClose={() => setChronoRung(null)}
        onImport={({ velocities }) => setRung(chronoRung, 'velocities', velocities)}
      />
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
  hint: { fontSize: 12, marginTop: -4 },
  primerCard: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 6 },
  signRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  signChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  signText: { fontSize: 11, fontWeight: '600' },
  notBuiltText: { flex: 1, fontSize: 12.5, fontWeight: '600', lineHeight: 18 },
  ladderHead: { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  colH: { fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  ladderRow: { flexDirection: 'row', gap: 8, alignItems: 'center', borderRadius: 10, paddingVertical: 3 },
  cell: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10 },
  cellText: { paddingVertical: 10, fontSize: 14, fontFamily: 'JetBrainsMono_700Bold', width: '100%' },
  cellImported: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  cellBadge: { fontSize: 10, fontWeight: '800' },
  rowAct: { width: 26, alignItems: 'center', justifyContent: 'center' },
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
