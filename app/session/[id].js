import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Download, Gauge } from 'lucide-react-native';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme, groupColor } from '../../lib/theme';
import { useData } from '../../store/data';
import { saveCSV, slugify } from '../../lib/export';
import TargetPlot from '../../components/TargetPlot';
import ChronoImport from '../../components/ChronoImport';

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { colors } = useTheme();
  const { getSession, getRifleName, exportSessionsCSV, updateSession } = useData();
  const [importing, setImporting] = useState(false);

  const sess = getSession(id);
  if (!sess) return null;

  const rifleName = getRifleName(sess.rifleId);
  const allShots = sess.targets.flatMap(t => t.shots);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={[s.backBtn, { backgroundColor: colors.card, borderColor: colors.bd }]}>
            <ArrowLeft size={19} color={colors.tx} />
          </TouchableOpacity>
          <View style={s.headerMid}>
            <Text numberOfLines={1} style={[s.title, { color: colors.tx }]}>{sess.name}</Text>
            <Text style={[s.date, { color: colors.mut }]}>{sess.date}</Text>
          </View>
          <TouchableOpacity
            onPress={() => saveCSV(exportSessionsCSV([sess.id]), `${slugify(sess.name)}.csv`)}
            style={[s.backBtn, { backgroundColor: colors.card, borderColor: colors.bd }]}
          >
            <Download size={18} color={colors.act} />
          </TouchableOpacity>
        </View>

        <View style={s.badges}>
          {[rifleName, `${sess.distanceYd} yd`, sess.suppressed ? 'Suppressed' : 'Bare muzzle'].map((b, i) => (
            <View key={i} style={[s.badge, { backgroundColor: colors.card, borderColor: colors.bd }]}>
              <Text style={[s.badgeText, { color: colors.tx }]}>{b}</Text>
            </View>
          ))}
        </View>

        {/* Group plot + stats */}
        <View style={[s.plotCard, { backgroundColor: colors.card, borderColor: colors.bd }]}>
          <TargetPlot shots={allShots} size={130} />
          <View style={s.plotStats}>
            <Text style={[s.plotLabel, { color: colors.mut }]}>BEST GROUP</Text>
            <Text style={[s.plotBest, { color: groupColor(sess.best, colors), fontFamily: 'JetBrainsMono_700Bold' }]}>{sess.best}"</Text>
            <Text style={[s.plotLabel, { color: colors.mut, marginTop: 12 }]}>MEAN RADIUS</Text>
            <Text style={[s.plotMR, { color: colors.tx, fontFamily: 'JetBrainsMono_700Bold' }]}>{sess.meanRadius}"</Text>
          </View>
        </View>

        {/* No chronograph import yet, so these are unmeasured on captured
            sessions. Show an em dash rather than 0 fps, which reads as a real
            reading of zero. */}
        <View style={s.velRow}>
          <View style={[s.velTile, { backgroundColor: colors.card, borderColor: colors.bd }]}>
            <Text style={[s.velLabel, { color: colors.mut }]}>AVG VELOCITY</Text>
            {sess.mv > 0
              ? <Text style={[s.velVal, { color: colors.tx }]}>{sess.mv} <Text style={{ fontSize: 11, color: colors.fnt }}>fps</Text></Text>
              : <Text style={[s.velVal, { color: colors.fnt }]}>—</Text>}
          </View>
          <View style={[s.velTile, { backgroundColor: colors.card, borderColor: colors.bd }]}>
            <Text style={[s.velLabel, { color: colors.mut }]}>VELOCITY SD</Text>
            {sess.sd > 0
              ? <Text style={[s.velVal, { color: colors.tx }]}>{sess.sd} <Text style={{ fontSize: 11, color: colors.fnt }}>fps</Text></Text>
              : <Text style={[s.velVal, { color: colors.fnt }]}>—</Text>}
          </View>
        </View>

        {sess.velocities?.length > 0 && (
          <View style={[s.chronoCard, { backgroundColor: colors.card, borderColor: colors.bd }]}>
            <Text style={[s.chronoLabel, { color: colors.mut }]}>
              CHRONO · {sess.velocities.length} SHOTS · ES {sess.velocityEs ?? '—'} fps
            </Text>
            <Text style={[s.chronoList, { color: colors.tx }]} numberOfLines={3}>
              {sess.velocities.join(', ')}
            </Text>
          </View>
        )}

        <TouchableOpacity
          onPress={() => setImporting(true)}
          style={[s.chronoBtn, { backgroundColor: colors.acs }]}
        >
          <Gauge size={17} color={colors.act} />
          <Text style={[s.chronoBtnText, { color: colors.act }]}>
            {sess.velocities?.length ? 'Replace chrono data' : 'Import chrono string'}
          </Text>
        </TouchableOpacity>

        <Text style={[s.targetsTitle, { color: colors.tx }]}>Targets ({sess.targetCount})</Text>
        <View style={s.targetsList}>
          {sess.targets.map((t, i) => {
            const groupSize = (parseFloat(sess.best) + i * 0.18).toFixed(2);
            return (
              <View key={t.id} style={[s.targetRow, { backgroundColor: colors.card, borderColor: colors.bd }]}>
                <View style={[s.targetNum, { backgroundColor: colors.acs }]}>
                  <Text style={[s.targetNumText, { color: colors.act }]}>{i + 1}</Text>
                </View>
                <Text style={[s.targetShots, { color: colors.mut }]}>{t.shots.length} shots</Text>
                <Text style={[s.targetGroup, { color: groupColor(groupSize, colors), fontFamily: 'JetBrainsMono_700Bold' }]}>{groupSize}"</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <ChronoImport
        visible={importing}
        onClose={() => setImporting(false)}
        onImport={({ velocities, stats }) => updateSession(sess.id, {
          velocities,
          mv: stats.mean,
          sd: stats.sd ?? 0,
          velocityEs: stats.es,
        })}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  backBtn: { width: 38, height: 38, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerMid: { flex: 1, minWidth: 0 },
  title: { fontSize: 19, fontWeight: '800' },
  date: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 },
  badge: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  plotCard: { flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 1, borderRadius: 18, padding: 18 },
  plotStats: { flex: 1 },
  plotLabel: { fontSize: 11, fontWeight: '700' },
  plotBest: { fontSize: 26, marginTop: 3 },
  plotMR: { fontSize: 18, marginTop: 3 },
  velRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  velTile: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 15 },
  velLabel: { fontSize: 11, fontWeight: '700' },
  velVal: { fontSize: 19, fontWeight: '700', marginTop: 5, fontFamily: 'JetBrainsMono_700Bold' },
  chronoCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 10 },
  chronoLabel: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.4 },
  chronoList: { fontSize: 12.5, fontWeight: '600', lineHeight: 18, marginTop: 6, fontFamily: 'JetBrainsMono_500Medium' },
  chronoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 13, padding: 13, marginTop: 10 },
  chronoBtnText: { fontSize: 14, fontWeight: '700' },
  targetsTitle: { fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 22, marginBottom: 10 },
  targetsList: { gap: 10 },
  targetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 15 },
  targetNum: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  targetNumText: { fontWeight: '800', fontSize: 14, fontFamily: 'JetBrainsMono_700Bold' },
  targetShots: { flex: 1, fontSize: 13, fontWeight: '600' },
  targetGroup: { fontSize: 15 },
});
