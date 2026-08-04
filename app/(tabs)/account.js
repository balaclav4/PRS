import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, User, ShieldCheck, Download, Settings, LogOut, Info, HardDrive } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../lib/theme';
import { useData } from '../../store/data';

/**
 * Account and data.
 *
 * The privacy section states what the app actually does rather than boilerplate:
 * nothing leaves the device, and target photos are never kept at all. Both are
 * true and checkable — the store writes to SQLite on device and localStorage on
 * web, there is no network client in the dependency list, and a saved target
 * holds only shot coordinates and the scale corners.
 *
 * The sign-in row says plainly that accounts are not connected yet. A screen
 * claiming to show "your profile" while the login form discards its input would
 * be worse than saying nothing.
 */
export default function AccountScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { sessions, rifles, loads, dopeCards, projects, exportSessionsCSV } = useData();

  const back = () => (router.canGoBack?.() ? router.back() : router.replace('/'));

  const counts = [
    ['Sessions', sessions.length],
    ['Rifles', rifles.length],
    ['Loads', loads.length],
    ['Dope cards', dopeCards.length],
    ['Load dev projects', projects.length],
  ];

  const Row = ({ icon: Icon, label, sub, onPress, tint }) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={[s.row, { backgroundColor: colors.card, borderColor: colors.bd }]}
    >
      <View style={[s.rowIcon, { backgroundColor: colors.inset }]}>
        <Icon size={18} color={tint || colors.act} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.rowLabel, { color: tint || colors.tx }]}>{label}</Text>
        {!!sub && <Text style={[s.rowSub, { color: colors.mut }]}>{sub}</Text>}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <TouchableOpacity
            onPress={back}
            style={[s.backBtn, { backgroundColor: colors.card, borderColor: colors.bd }]}
          >
            <ArrowLeft size={19} color={colors.tx} />
          </TouchableOpacity>
          <Text style={[s.title, { color: colors.tx }]}>Account</Text>
        </View>

        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.bd }]}>
          <View style={[s.avatar, { backgroundColor: colors.avb }]}>
            <User size={22} color={colors.avt} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.name, { color: colors.tx }]}>Not signed in</Text>
            <Text style={[s.sub, { color: colors.mut }]}>
              Accounts aren't connected yet, so everything here is local to this device.
            </Text>
          </View>
        </View>

        <Text style={[s.section, { color: colors.mut }]}>YOUR DATA</Text>
        <View style={[s.countsCard, { backgroundColor: colors.card, borderColor: colors.bd }]}>
          {counts.map(([label, n]) => (
            <View key={label} style={s.countRow}>
              <Text style={[s.countLabel, { color: colors.mut }]}>{label}</Text>
              <Text style={[s.countVal, { color: colors.tx }]}>{n}</Text>
            </View>
          ))}
        </View>

        <Row
          icon={Download}
          label="Export sessions as CSV"
          sub="Every session, shot count and group size"
          onPress={() => exportSessionsCSV()}
        />
        <Row
          icon={Settings}
          label="Settings"
          sub="Units, appearance"
          onPress={() => router.push('/settings')}
        />

        <Text style={[s.section, { color: colors.mut }]}>PRIVACY</Text>
        <View style={[s.privacy, { backgroundColor: colors.inset, borderColor: colors.ibd }]}>
          <View style={s.privacyRow}>
            <HardDrive size={17} color={colors.act} />
            <Text style={[s.privacyText, { color: colors.tx }]}>
              Your data stays on this device. Sessions, rifles, loads and dope
              cards are stored locally and are not uploaded anywhere.
            </Text>
          </View>
          <View style={s.privacyRow}>
            <ShieldCheck size={17} color={colors.act} />
            <Text style={[s.privacyText, { color: colors.tx }]}>
              Target photos are never stored. A photo is used to measure the
              group and then discarded — a saved target keeps only the shot
              coordinates and the reference corners.
            </Text>
          </View>
          <View style={s.privacyRow}>
            <Info size={17} color={colors.mut} />
            <Text style={[s.privacyText, { color: colors.mut }]}>
              Deleting the app removes all of it. There is no copy on a server to
              restore from, and no way to recover it.
            </Text>
          </View>
        </View>

        <Row
          icon={LogOut}
          label="Sign out"
          sub="Returns to the login screen"
          tint={colors.dngt}
          onPress={() => router.replace('/login')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  backBtn: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  card: { flexDirection: 'row', gap: 14, alignItems: 'center', padding: 16, borderRadius: 14, borderWidth: 1 },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '800' },
  sub: { fontSize: 12.5, fontWeight: '600', marginTop: 3, lineHeight: 17 },
  section: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginTop: 14, marginBottom: 2 },
  countsCard: { padding: 14, borderRadius: 14, borderWidth: 1, gap: 9 },
  countRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  countLabel: { fontSize: 13, fontWeight: '600' },
  countVal: { fontSize: 14, fontWeight: '800', fontFamily: 'JetBrainsMono_700Bold' },
  row: { flexDirection: 'row', gap: 13, alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1 },
  rowIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 14.5, fontWeight: '700' },
  rowSub: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  privacy: { padding: 15, borderRadius: 14, borderWidth: 1, gap: 13 },
  privacyRow: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  privacyText: { flex: 1, fontSize: 12.5, fontWeight: '600', lineHeight: 18 },
});
