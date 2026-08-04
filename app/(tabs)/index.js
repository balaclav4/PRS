import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Target, TrendingUp, Crosshair, Camera, Wind, FlaskConical, BookOpen, User } from 'lucide-react-native';
import { initialsFrom } from '../../lib/profile';
import { useRouter } from 'expo-router';
import { useTheme, groupColor } from '../../lib/theme';
import { useData } from '../../store/data';
import { formatGroup, groupUnitLabel } from '../../lib/units';
import { LinearGradient } from '../../components/Gradient';

export default function HomeScreen() {
  const { colors } = useTheme();
  const { sessions, rifles, projects, dopeCards, units, getRifleName, profileName } = useData();
  const initials = initialsFrom(profileName);
  const router = useRouter();

  const recent = sessions.slice(0, 3);
  const bestSession = sessions.reduce((best, s) => {
    const v = parseFloat(s.best);
    if (!isFinite(v)) return best;
    return !best || v < parseFloat(best.best) ? s : best;
  }, null);
  const bestGroup = bestSession ? parseFloat(bestSession.best) : Infinity;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <View>
            <Text style={[s.welcome, { color: colors.mut }]}>Welcome back</Text>
            <Text style={[s.title, { color: colors.tx }]}>Dashboard</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/account')}
            activeOpacity={0.7}
            accessibilityLabel="Account, data and privacy"
            style={[s.avatar, { backgroundColor: colors.avb }]}
          >
            {initials
              ? <Text style={[s.avatarText, { color: colors.avt }]}>{initials}</Text>
              : <User size={19} color={colors.avt} />}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => router.push('/capture')}
          activeOpacity={0.9}
          style={s.heroCard}
        >
          <View style={s.heroCircle1} />
          <View style={s.heroCircle2} />
          <Text style={s.heroSub}>READY TO SHOOT</Text>
          <Text style={s.heroTitle}>Capture your next group</Text>
          <View style={s.heroBtn}>
            <Camera size={17} color="#5A2FD0" />
            <Text style={s.heroBtnText}>New Session</Text>
          </View>
        </TouchableOpacity>

        {/* Each tile navigates to the screen that explains its number. Best
            Group jumps straight to the session that set it. */}
        <View style={s.statsRow}>
          <TouchableOpacity
            onPress={() => router.push('/sessions')}
            style={[s.statTile, { backgroundColor: colors.card, borderColor: colors.bd }]}
          >
            <Target size={20} color={colors.act} />
            <Text style={[s.statVal, { color: colors.tx }]}>{sessions.length}</Text>
            <Text style={[s.statLabel, { color: colors.mut }]}>Sessions</Text>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={!bestSession}
            onPress={() => bestSession && router.push(`/session/${bestSession.id}`)}
            style={[s.statTile, { backgroundColor: colors.card, borderColor: colors.bd }]}
          >
            <TrendingUp size={20} color="#15A34A" />
            <Text style={[s.statVal, { color: colors.tx }]}>
              {bestSession ? formatGroup(bestGroup, bestSession.distanceYd, units.group, { withUnit: false }) : '—'}
            </Text>
            <Text style={[s.statLabel, { color: colors.mut }]}>Best Group ({groupUnitLabel(units.group)})</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/equipment')}
            style={[s.statTile, { backgroundColor: colors.card, borderColor: colors.bd }]}
          >
            <Crosshair size={20} color="#D97706" />
            <Text style={[s.statVal, { color: colors.tx }]}>{rifles.length}</Text>
            <Text style={[s.statLabel, { color: colors.mut }]}>Rifles</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/dopecards')}
            style={[s.statTile, { backgroundColor: colors.card, borderColor: colors.bd }]}
          >
            <BookOpen size={20} color="#0EA5E9" />
            <Text style={[s.statVal, { color: colors.tx }]}>{dopeCards.length}</Text>
            <Text style={[s.statLabel, { color: colors.mut }]}>Dope Cards</Text>
          </TouchableOpacity>
        </View>

        <View style={s.sectionHeader}>
          <Text style={[s.sectionTitle, { color: colors.tx }]}>Recent Sessions</Text>
          <TouchableOpacity onPress={() => router.push('/sessions')}>
            <Text style={[s.seeAll, { color: colors.act }]}>See all</Text>
          </TouchableOpacity>
        </View>

        <View style={s.recentList}>
          {recent.length === 0 ? (
            <View style={[s.emptyCard, { backgroundColor: colors.card, borderColor: colors.bd }]}>
              <Target size={28} color={colors.fnt} />
              <Text style={[s.emptyText, { color: colors.mut }]}>No sessions yet</Text>
              <Text style={[s.emptyHint, { color: colors.fnt }]}>Tap the capture button to record your first group</Text>
            </View>
          ) : recent.map((sess) => (
            <TouchableOpacity
              key={sess.id}
              onPress={() => router.push(`/session/${sess.id}`)}
              style={[s.recentRow, { backgroundColor: colors.card, borderColor: colors.bd }]}
            >
              <View style={[s.recentIcon, { backgroundColor: colors.acs }]}>
                <Crosshair size={20} color={colors.act} />
              </View>
              <View style={s.recentMid}>
                <Text numberOfLines={1} style={[s.recentName, { color: colors.tx }]}>{sess.name}</Text>
                <Text style={[s.recentMeta, { color: colors.mut }]}>{sess.date} · {getRifleName(sess.rifleId)}</Text>
              </View>
              <View style={s.recentRight}>
                <Text style={[s.recentBest, { color: groupColor(sess.best, colors), fontFamily: 'JetBrainsMono_700Bold' }]}>
                  {formatGroup(parseFloat(sess.best), sess.distanceYd, units.group)}
                </Text>
                <Text style={[s.recentBestLabel, { color: colors.fnt }]}>best</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.quickLinks}>
          <TouchableOpacity onPress={() => router.push('/ballistics')} style={[s.quickCard, { backgroundColor: colors.card, borderColor: colors.bd }]}>
            <Wind size={22} color={colors.act} style={{ marginBottom: 10 }} />
            <Text style={[s.quickTitle, { color: colors.tx }]}>Ballistics</Text>
            <Text style={[s.quickSub, { color: colors.mut }]}>Dope card & drops</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/reloading')} style={[s.quickCard, { backgroundColor: colors.card, borderColor: colors.bd }]}>
            <FlaskConical size={22} color={colors.act} style={{ marginBottom: 10 }} />
            <Text style={[s.quickTitle, { color: colors.tx }]}>Load Dev</Text>
            <Text style={[s.quickSub, { color: colors.mut }]}>
              {projects?.length
                ? `${projects[0].name} · Step ${projects[0].currentStep || 1}`
                : 'No project yet'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  welcome: { fontSize: 13, fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4, marginTop: 2 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '800', fontSize: 15 },
  heroCard: {
    borderRadius: 22, padding: 22, overflow: 'hidden', position: 'relative',
    backgroundColor: '#6D3BEB',
    shadowColor: 'rgba(90,47,208,0.6)', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 1, shadowRadius: 36, elevation: 8,
  },
  heroCircle1: { position: 'absolute', right: -30, top: -30, width: 150, height: 150, borderRadius: 75, borderWidth: 2, borderColor: 'rgba(255,255,255,0.14)' },
  heroCircle2: { position: 'absolute', right: 6, top: 6, width: 78, height: 78, borderRadius: 39, borderWidth: 2, borderColor: 'rgba(255,255,255,0.12)' },
  heroSub: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.8)', letterSpacing: 0.3 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#fff', lineHeight: 28, maxWidth: 220, marginTop: 8, marginBottom: 16 },
  heroBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12, alignSelf: 'flex-start' },
  heroBtnText: { fontSize: 14, fontWeight: '700', color: '#5A2FD0' },
  // Four tiles are too narrow for one phone row, so they wrap to a 2x2 grid.
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  statTile: { flexGrow: 1, flexBasis: '46%', borderWidth: 1, borderRadius: 16, padding: 14, paddingHorizontal: 12 },
  statVal: { fontSize: 22, fontWeight: '700', marginTop: 10, fontFamily: 'JetBrainsMono_700Bold' },
  statLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  seeAll: { fontSize: 13, fontWeight: '700' },
  recentList: { gap: 10 },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderRadius: 16, padding: 14 },
  recentIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  recentMid: { flex: 1, minWidth: 0 },
  recentName: { fontSize: 14, fontWeight: '700' },
  recentMeta: { fontSize: 12, fontWeight: '500', marginTop: 3 },
  recentRight: { alignItems: 'flex-end' },
  recentBest: { fontSize: 15 },
  recentBestLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  quickLinks: { flexDirection: 'row', gap: 10, marginTop: 16 },
  quickCard: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 16 },
  quickTitle: { fontSize: 14, fontWeight: '700' },
  quickSub: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  emptyCard: { borderWidth: 1, borderRadius: 16, padding: 30, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 14, fontWeight: '700' },
  emptyHint: { fontSize: 12, fontWeight: '500', textAlign: 'center', lineHeight: 18 },
});
