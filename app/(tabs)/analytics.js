import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Download, TrendingDown, CircleCheck } from 'lucide-react-native';
import Svg, { Line, Path, Circle, Text as SvgText } from 'react-native-svg';
import { useState } from 'react';
import { useTheme } from '../../lib/theme';
import { useData } from '../../store/data';
import FilterChips from '../../components/FilterChips';
import TargetPlot from '../../components/TargetPlot';

export default function AnalyticsScreen() {
  const { colors } = useTheme();
  const { rifles, analyticsData } = useData();
  const [filter, setFilter] = useState('all');

  const chips = [
    { key: 'all', label: 'All rifles' },
    ...rifles.map(r => ({ key: r.name, label: r.name })),
  ];

  const data = analyticsData[filter] || analyticsData.all;
  const trend = data.trend;

  const vHi = 0.8, vLo = 0.2, xL = 34, xR = 290, yT = 12, yB = 92;
  const n = trend.length;
  const yFor = (v) => +(yT + (vHi - v) / (vHi - vLo) * (yB - yT)).toFixed(1);

  const trendPts = trend.map((v, i) => ({
    cx: +(xL + i * ((xR - xL) / (n - 1))).toFixed(1),
    cy: yFor(v),
  }));
  const trendPath = 'M ' + trendPts.map(p => p.cx + ' ' + p.cy).join(' L ');
  const trendArea = trendPath + ' L ' + trendPts[n - 1].cx + ' ' + yB + ' L ' + trendPts[0].cx + ' ' + yB + ' Z';
  const gridLines = [0.8, 0.6, 0.4, 0.2].map(v => ({ y: yFor(v), label: v.toFixed(1) }));

  const demoShots = [
    { x: 0.05, y: -0.10 }, { x: -0.12, y: 0.08 }, { x: 0.02, y: 0.16 },
    { x: 0.18, y: 0.03 }, { x: -0.06, y: -0.14 }, { x: 0.10, y: 0.11 }, { x: -0.03, y: -0.02 },
  ].map(s => ({ x: 0.5 + s.x, y: 0.45 + s.y }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <Text style={[s.title, { color: colors.tx }]}>Analytics</Text>
          <TouchableOpacity style={[s.dlBtn, { backgroundColor: colors.card, borderColor: colors.bd }]}>
            <Download size={19} color={colors.act} />
          </TouchableOpacity>
        </View>

        <View style={{ marginHorizontal: -20, marginBottom: 18 }}>
          <FilterChips items={chips} selected={filter} onSelect={setFilter} />
        </View>

        <View style={s.tilesRow}>
          <View style={[s.tile, { backgroundColor: colors.card, borderColor: colors.bd }]}>
            <Text style={[s.tileLabel, { color: colors.mut }]}>Avg Group</Text>
            <Text style={[s.tileVal, { color: colors.tx }]}>{data.avg}"</Text>
          </View>
          <View style={[s.tile, { backgroundColor: colors.card, borderColor: colors.bd }]}>
            <Text style={[s.tileLabel, { color: colors.mut }]}>Total Rounds</Text>
            <Text style={[s.tileVal, { color: colors.tx }]}>{data.rounds}</Text>
          </View>
        </View>

        {/* Group Size Trend */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.bd }]}>
          <View style={s.cardHeader}>
            <Text style={[s.cardTitle, { color: colors.tx }]}>Group Size Trend</Text>
            <View style={s.improving}>
              <TrendingDown size={14} color="#15A34A" />
              <Text style={s.improvingText}>Improving</Text>
            </View>
          </View>
          <Svg viewBox="0 0 300 106" style={{ width: '100%', height: undefined, aspectRatio: 300 / 106 }}>
            {gridLines.map((g, i) => (
              <Line key={i} x1={34} y1={g.y} x2={xR} y2={g.y} stroke={colors.grid} strokeWidth={1} />
            ))}
            {gridLines.map((g, i) => (
              <SvgText key={'t' + i} x={28} y={g.y} textAnchor="end" alignmentBaseline="middle" fontSize={9} fontFamily="JetBrains Mono" fill={colors.fnt}>{g.label}</SvgText>
            ))}
            <Path d={trendArea} fill="rgba(109,59,235,0.12)" />
            <Path d={trendPath} fill="none" stroke="#8257F0" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            {trendPts.map((p, i) => (
              <Circle key={i} cx={p.cx} cy={p.cy} r={3.4} fill={colors.card} stroke="#8257F0" strokeWidth={2} />
            ))}
          </Svg>
          <View style={s.trendFooter}>
            <Text style={[s.trendLabel, { color: colors.fnt }]}>8 sessions ago</Text>
            <Text style={[s.trendLabel, { color: colors.fnt }]}>latest · MOA</Text>
          </View>
        </View>

        {/* Shot Distribution */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.bd, flexDirection: 'row', alignItems: 'center' }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.cardTitle, { color: colors.tx, marginBottom: 8 }]}>Shot{'\n'}Distribution</Text>
            <Text style={[s.distSub, { color: colors.mut }]}>Latest group{'\n'}{data.latestShots} shots · {data.latestGroup}"</Text>
          </View>
          <TargetPlot shots={demoShots} size={140} showLabels />
        </View>

        {/* Load Comparison */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.bd }]}>
          <Text style={[s.cardTitle, { color: colors.tx, marginBottom: 14 }]}>Load Comparison</Text>
          <View style={s.compareRow}>
            <View style={[s.compareBox, { backgroundColor: colors.inset }]}>
              <Text style={[s.compareName, { color: colors.mut }]}>140 / H4350</Text>
              <Text style={[s.compareVal, { color: colors.tx }]}>0.31"</Text>
            </View>
            <Text style={[s.vs, { color: colors.fnt }]}>vs</Text>
            <View style={[s.compareBox, { backgroundColor: colors.oks, borderColor: colors.okbd, borderWidth: 1 }]}>
              <Text style={[s.compareName, { color: colors.okt, fontWeight: '700' }]}>105 / Varget</Text>
              <Text style={[s.compareVal, { color: colors.okt }]}>0.19"</Text>
            </View>
          </View>
          <View style={[s.tTestResult, { backgroundColor: colors.acs }]}>
            <CircleCheck size={18} color={colors.act} style={{ marginTop: 1 }} />
            <Text style={[s.tTestText, { color: colors.act }]}>105 Varget is significantly tighter — t=2.84, p{'<'}0.05</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  dlBtn: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tilesRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  tile: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 15 },
  tileLabel: { fontSize: 12, fontWeight: '600' },
  tileVal: { fontSize: 24, fontWeight: '700', marginTop: 6, fontFamily: 'JetBrainsMono_700Bold' },
  card: { borderWidth: 1, borderRadius: 18, padding: 18, paddingHorizontal: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  improving: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  improvingText: { fontSize: 12, fontWeight: '700', color: '#15A34A' },
  trendFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginHorizontal: 4, marginLeft: 34 },
  trendLabel: { fontSize: 11, fontWeight: '600' },
  distSub: { fontSize: 12, fontWeight: '500', lineHeight: 18 },
  compareRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  compareBox: { flex: 1, alignItems: 'center', padding: 12, borderRadius: 12 },
  compareName: { fontSize: 12, fontWeight: '600' },
  compareVal: { fontSize: 19, fontWeight: '700', marginTop: 6, fontFamily: 'JetBrainsMono_700Bold' },
  vs: { fontSize: 12, fontWeight: '700' },
  tTestResult: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 12, padding: 12, paddingHorizontal: 14, borderRadius: 12 },
  tTestText: { flex: 1, fontSize: 12.5, fontWeight: '600', lineHeight: 18 },
});
