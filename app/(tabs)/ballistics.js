import { View, Text, ScrollView, TextInput, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Crosshair, Thermometer, Gauge, Wind, ArrowLeft, ChevronDown, Mountain, Droplets, Compass, Target, Plus, Trash2, TriangleAlert, Check } from 'lucide-react-native';
import { useState, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useTheme } from '../../lib/theme';
import { useData } from '../../store/data';
import { dopeCard, trueBC } from '../../lib/ballistics';
import { bulletDiameterIn } from '../../lib/calibers';
import PickerSheet from '../../components/PickerSheet';

/** Labelled numeric field. */
function Field({ label, value, onChange, unit, colors, flex = 1 }) {
  return (
    <View style={{ flex }}>
      <Text style={[s.fieldLabel, { color: colors.mut }]}>{label}</Text>
      <View style={[s.fieldBox, { backgroundColor: colors.input, borderColor: colors.ibd }]}>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          style={[s.fieldInput, { color: colors.tx }]}
          selectTextOnFocus
        />
        {!!unit && <Text style={[s.fieldUnit, { color: colors.fnt }]}>{unit}</Text>}
      </View>
    </View>
  );
}

function Segmented({ options, value, onChange, colors }) {
  return (
    <View style={[s.segmented, { backgroundColor: colors.inset }]}>
      {options.map(([k, label]) => (
        <TouchableOpacity key={k} onPress={() => onChange(k)}
          style={[s.seg, value === k && { backgroundColor: colors.card }]}>
          <Text style={[s.segText, { color: value === k ? colors.tx : colors.mut }]}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function BallisticsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { loads, rifles } = useData();

  const [loadIdx, setLoadIdx] = useState(0);
  const [picking, setPicking] = useState(false);
  const load = loads[loadIdx] || null;
  const rifle = rifles.find(r => r.id === load?.rifleId);

  const [mvFps, setMvFps] = useState(String(load?.velocityFps || 2800));
  const [bc, setBc] = useState('0.315');
  const [dragModel, setDragModel] = useState('G7');
  const [unit, setUnit] = useState('moa');

  const [sightHeight, setSightHeight] = useState('1.5');
  const [zeroYd, setZeroYd] = useState('100');
  const [tempF, setTempF] = useState('59');
  const [pressureInHg, setPressureInHg] = useState('29.92');
  const [humidityPct, setHumidityPct] = useState('50');
  const [altitudeFt, setAltitudeFt] = useState('');
  const [windMph, setWindMph] = useState('10');
  const [windAngleDeg, setWindAngleDeg] = useState('90');
  const [maxRangeYd, setMaxRangeYd] = useState('1000');
  const [stepYd, setStepYd] = useState('100');

  const [truing, setTruing] = useState(false);
  const [observations, setObservations] = useState([]);
  const [truedResult, setTruedResult] = useState(null);

  const num = (v, d) => { const n = parseFloat(v); return isFinite(n) ? n : d; };

  const opts = useMemo(() => ({
    mvFps: num(mvFps, 2800),
    bc: num(bc, 0.315),
    dragModel,
    sightHeightIn: num(sightHeight, 1.5),
    zeroYd: num(zeroYd, 100),
    tempF: num(tempF, 59),
    pressureInHg: num(pressureInHg, 29.92),
    humidityPct: num(humidityPct, 0),
    altitudeFt: altitudeFt.trim() === '' ? null : num(altitudeFt, 0),
    windMph: num(windMph, 0),
    windAngleDeg: num(windAngleDeg, 90),
    maxRangeYd: Math.min(2000, Math.max(100, num(maxRangeYd, 1000))),
    stepYd: Math.min(500, Math.max(25, num(stepYd, 100))),
    unit,
  }), [mvFps, bc, dragModel, sightHeight, zeroYd, tempF, pressureInHg, humidityPct,
       altitudeFt, windMph, windAngleDeg, maxRangeYd, stepYd, unit]);

  const card = useMemo(() => dopeCard(opts), [opts]);
  const unitLabel = unit === 'mil' ? 'MIL' : 'MOA';
  const firstTransonic = card.rows.find(r => r.transonic);

  const applyTruing = () => {
    const r = trueBC(opts, observations);
    setTruedResult(r);
    if (r) setBc(String(r.bc));
  };

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

        {/* Active load */}
        <View style={s.loadCard}>
          <TouchableOpacity onPress={() => setPicking(true)} style={s.loadHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.loadSub}>ACTIVE LOAD</Text>
              <Text style={s.loadName}>{load?.name || 'No load selected'}</Text>
              <Text style={s.loadDetail}>
                {[rifle?.name, load?.caliber].filter(Boolean).join(' · ') || 'Pick a load'}
              </Text>
            </View>
            <ChevronDown size={20} color="#8B6BF5" />
          </TouchableOpacity>

          <View style={s.loadStats}>
            <View style={s.loadStatCol}>
              <TextInput value={mvFps} onChangeText={setMvFps} keyboardType="number-pad"
                style={s.loadStatInput} selectTextOnFocus />
              <Text style={s.loadStatLabel}>MV fps</Text>
            </View>
            <View style={s.loadStatCol}>
              <TextInput value={bc} onChangeText={setBc} keyboardType="decimal-pad"
                style={s.loadStatInput} selectTextOnFocus />
              <Text style={s.loadStatLabel}>BC {dragModel}</Text>
            </View>
            <View style={s.loadStatCol}>
              <Text style={s.loadStatVal}>{card.densityRatio.toFixed(3)}</Text>
              <Text style={s.loadStatLabel}>Air density</Text>
            </View>
          </View>
        </View>

        <View style={s.toggleRow}>
          {/* G7 fits modern boat-tails; G1 is the older flat-base reference and
              its BC drifts more with velocity. */}
          <View style={{ flex: 1 }}>
            <Text style={[s.fieldLabel, { color: colors.mut }]}>Drag model</Text>
            <Segmented options={[['G7', 'G7'], ['G1', 'G1']]} value={dragModel} onChange={setDragModel} colors={colors} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.fieldLabel, { color: colors.mut }]}>Output</Text>
            <Segmented options={[['moa', 'MOA'], ['mil', 'MIL']]} value={unit} onChange={setUnit} colors={colors} />
          </View>
        </View>

        {/* Rifle setup */}
        <Text style={[s.sectionLabel, { color: colors.fnt }]}>RIFLE</Text>
        <View style={s.row}>
          <Field label="Sight height" value={sightHeight} onChange={setSightHeight} unit="in" colors={colors} />
          <Field label="Zero" value={zeroYd} onChange={setZeroYd} unit="yd" colors={colors} />
        </View>

        {/* Atmosphere */}
        <Text style={[s.sectionLabel, { color: colors.fnt }]}>ATMOSPHERE</Text>
        <View style={s.row}>
          <Field label="Temp" value={tempF} onChange={setTempF} unit="°F" colors={colors} />
          <Field label="Pressure" value={pressureInHg} onChange={setPressureInHg} unit="inHg" colors={colors} />
        </View>
        <View style={s.row}>
          <Field label="Humidity" value={humidityPct} onChange={setHumidityPct} unit="%" colors={colors} />
          <Field label="Altitude" value={altitudeFt} onChange={setAltitudeFt} unit="ft" colors={colors} />
        </View>
        {altitudeFt.trim() !== '' && (
          <Text style={[s.note, { color: colors.fnt }]}>
            Altitude overrides the pressure field — station pressure is computed from it.
          </Text>
        )}

        {/* Wind */}
        <Text style={[s.sectionLabel, { color: colors.fnt }]}>WIND</Text>
        <View style={s.row}>
          <Field label="Speed" value={windMph} onChange={setWindMph} unit="mph" colors={colors} />
          <Field label="Angle" value={windAngleDeg} onChange={setWindAngleDeg} unit="°" colors={colors} />
        </View>
        <Text style={[s.note, { color: colors.fnt }]}>
          90° is a full-value crosswind, 0° a pure headwind. Drift scales with the sine,
          so a 30° wind is about half value.
        </Text>

        {/* Table extent */}
        <Text style={[s.sectionLabel, { color: colors.fnt }]}>TABLE</Text>
        <View style={s.row}>
          <Field label="Max range" value={maxRangeYd} onChange={setMaxRangeYd} unit="yd" colors={colors} />
          <Field label="Step" value={stepYd} onChange={setStepYd} unit="yd" colors={colors} />
        </View>

        {/* Dope card */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.bd }]}>
          <View style={s.cardHead}>
            <Text style={[s.cardTitle, { color: colors.tx }]}>Dope Card</Text>
            <Text style={[s.cardSub, { color: colors.fnt }]}>
              {opts.zeroYd}yd zero · {unitLabel}
            </Text>
          </View>

          <View style={s.tableHead}>
            <Text style={[s.th, { color: colors.fnt, flex: 1.1 }]}>RANGE</Text>
            <Text style={[s.th, { color: colors.fnt }]}>ELEV</Text>
            <Text style={[s.th, { color: colors.fnt }]}>WIND</Text>
            <Text style={[s.th, { color: colors.fnt }]}>VEL</Text>
            <Text style={[s.th, { color: colors.fnt, textAlign: 'right' }]}>TOF</Text>
          </View>

          {card.rows.map((r, i) => (
            <View key={r.rangeYd} style={[
              s.tr,
              i % 2 === 0 && { backgroundColor: colors.inset },
              r.transonic && { backgroundColor: colors.warns },
            ]}>
              <Text style={[s.td, { color: colors.tx, flex: 1.1 }]}>
                {r.rangeYd}<Text style={{ fontSize: 10, color: colors.fnt }}> yd</Text>
              </Text>
              <Text style={[s.td, { color: colors.act, fontWeight: '800' }]}>{r.elevation}</Text>
              <Text style={[s.td, { color: colors.tx }]}>{r.wind}</Text>
              <Text style={[s.td, { color: r.transonic ? colors.warnt : colors.mut }]}>{r.velFps}</Text>
              <Text style={[s.td, { color: colors.mut, textAlign: 'right' }]}>{r.tofSec.toFixed(2)}</Text>
            </View>
          ))}

          {firstTransonic && (
            <View style={[s.warn, { backgroundColor: colors.warns }]}>
              <TriangleAlert size={16} color={colors.warnt} style={{ marginTop: 1 }} />
              <Text style={[s.warnText, { color: colors.warnt }]}>
                Transonic from {firstTransonic.rangeYd}yd (Mach {firstTransonic.mach}). Drag models
                lose accuracy through the sound barrier and groups usually open up — treat dope
                past here as a starting point, then true it.
              </Text>
            </View>
          )}
        </View>

        {/* Truing */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.bd }]}>
          <Text style={[s.cardTitle, { color: colors.tx, marginBottom: 6 }]}>Truing</Text>
          <Text style={[s.cardBody, { color: colors.mut }]}>
            Enter the elevation you actually dialled for a first-round hit at a known
            distance. The BC is solved backwards from it, so the card matches this rifle
            rather than the box figure.
          </Text>

          {observations.map((o, i) => (
            <View key={i} style={s.trueRow}>
              <View style={[s.fieldBox, { flex: 1, backgroundColor: colors.input, borderColor: colors.ibd }]}>
                <TextInput
                  value={o.rangeYd}
                  onChangeText={v => setObservations(prev => prev.map((x, j) => j === i ? { ...x, rangeYd: v } : x))}
                  placeholder="yd" placeholderTextColor={colors.fnt}
                  keyboardType="number-pad" style={[s.fieldInput, { color: colors.tx }]}
                />
              </View>
              <View style={[s.fieldBox, { flex: 1, backgroundColor: colors.input, borderColor: colors.ibd }]}>
                <TextInput
                  value={o.observedElevation}
                  onChangeText={v => setObservations(prev => prev.map((x, j) => j === i ? { ...x, observedElevation: v } : x))}
                  placeholder={unitLabel} placeholderTextColor={colors.fnt}
                  keyboardType="decimal-pad" style={[s.fieldInput, { color: colors.tx }]}
                />
              </View>
              <TouchableOpacity onPress={() => setObservations(prev => prev.filter((_, j) => j !== i))} style={s.trueDel}>
                <Trash2 size={15} color={colors.fnt} />
              </TouchableOpacity>
            </View>
          ))}

          <View style={s.trueActions}>
            <TouchableOpacity
              onPress={() => setObservations(prev => [...prev, { rangeYd: '', observedElevation: '' }])}
              style={[s.addBtn, { borderColor: colors.ibd }]}
            >
              <Plus size={15} color={colors.act} />
              <Text style={[s.addBtnText, { color: colors.act }]}>Add observation</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={applyTruing}
              disabled={!observations.length}
              style={[s.trueBtn, { opacity: observations.length ? 1 : 0.4 }]}
            >
              <Check size={15} color="#fff" />
              <Text style={s.trueBtnText}>True</Text>
            </TouchableOpacity>
          </View>

          {truedResult && (
            <View style={[s.trueResult, { backgroundColor: colors.oks }]}>
              <Text style={[s.trueResultText, { color: colors.okt }]}>
                Trued BC {truedResult.bc} — a ×{truedResult.factor} correction from
                {' '}{truedResult.factor < 1 ? 'the' : 'the'} book figure, from {truedResult.observations}
                {' '}observation{truedResult.observations === 1 ? '' : 's'}. The card above now uses it.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <PickerSheet
        visible={picking}
        title="Pick a load"
        options={loads.map((l, i) => ({
          key: String(i),
          label: l.name,
          sub: [rifles.find(r => r.id === l.rifleId)?.name, l.caliber].filter(Boolean).join(' · '),
          meta: l.velocityFps ? `${l.velocityFps} fps` : '',
        }))}
        selectedKey={String(loadIdx)}
        onSelect={(k) => {
          const i = Number(k);
          setLoadIdx(i);
          if (loads[i]?.velocityFps) setMvFps(String(loads[i].velocityFps));
          // Reset truing: it belongs to the load it was measured with.
          setTruedResult(null);
        }}
        onClose={() => setPicking(false)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  backBtn: { width: 38, height: 38, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },

  loadCard: { borderRadius: 18, padding: 18, backgroundColor: '#1A1922', overflow: 'hidden' },
  loadHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  loadSub: { fontSize: 12, fontWeight: '600', color: '#9E9BB0' },
  loadName: { fontSize: 18, fontWeight: '800', color: '#fff', marginTop: 6 },
  loadDetail: { fontSize: 13, fontWeight: '500', color: '#B9B6C8', marginTop: 4 },
  loadStats: { flexDirection: 'row', gap: 12, marginTop: 16 },
  loadStatCol: { flex: 1, minWidth: 0 },
  loadStatInput: { fontSize: 19, fontWeight: '700', color: '#fff', fontFamily: 'JetBrainsMono_700Bold', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.2)', paddingBottom: 2, width: '100%' },
  loadStatVal: { fontSize: 19, fontWeight: '700', color: '#fff', fontFamily: 'JetBrainsMono_700Bold' },
  loadStatLabel: { fontSize: 11, fontWeight: '600', color: '#9E9BB0', marginTop: 4 },

  toggleRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  segmented: { flexDirection: 'row', gap: 4, borderRadius: 10, padding: 4 },
  seg: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 7 },
  segText: { fontSize: 13, fontWeight: '700' },

  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginTop: 18, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  fieldLabel: { fontSize: 11.5, fontWeight: '700', marginBottom: 6 },
  fieldBox: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12 },
  fieldInput: { flex: 1, paddingVertical: 11, fontSize: 14.5, fontFamily: 'JetBrainsMono_700Bold' },
  fieldUnit: { fontSize: 11, fontWeight: '700' },
  note: { fontSize: 11, fontWeight: '600', lineHeight: 16, marginTop: 2, marginHorizontal: 2 },

  card: { borderWidth: 1, borderRadius: 18, padding: 16, marginTop: 18 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  cardSub: { fontSize: 11, fontWeight: '600' },
  cardBody: { fontSize: 12.5, fontWeight: '500', lineHeight: 18, marginBottom: 12 },
  tableHead: { flexDirection: 'row', paddingBottom: 6, paddingHorizontal: 8 },
  th: { flex: 1, fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 8, borderRadius: 8 },
  td: { flex: 1, fontSize: 13, fontWeight: '700', fontFamily: 'JetBrainsMono_700Bold' },
  warn: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', padding: 12, borderRadius: 11, marginTop: 10 },
  warnText: { flex: 1, fontSize: 11.5, fontWeight: '600', lineHeight: 16 },

  trueRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 },
  trueDel: { width: 28, alignItems: 'center', justifyContent: 'center' },
  trueActions: { flexDirection: 'row', gap: 8, marginTop: 2 },
  addBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderStyle: 'dashed', borderRadius: 11, paddingVertical: 11 },
  addBtnText: { fontSize: 13, fontWeight: '700' },
  trueBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#6D3BEB', borderRadius: 11, paddingVertical: 11, paddingHorizontal: 20 },
  trueBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  trueResult: { padding: 12, borderRadius: 11, marginTop: 10 },
  trueResultText: { fontSize: 12, fontWeight: '600', lineHeight: 17 },
});
