import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Palette, Sparkles, Sun, Moon, SunMoon, Ruler, Thermometer, Gauge, FileDown, LogOut, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useTheme } from '../../lib/theme';
import { CONSENT_SUMMARY, consentIsCurrent, consentNeedsRenewal, describeConsent } from '../../lib/consent';
import { useData } from '../../store/data';
import { useAuth } from '../../store/auth';
import { saveCSV } from '../../lib/export';

import { GROUP_UNITS, TEMP_UNITS, VELOCITY_UNITS, DISTANCE_UNITS } from '../../lib/units';

const UNIT_OPTIONS = {
  group: GROUP_UNITS,
  temp: TEMP_UNITS,
  velocity: VELOCITY_UNITS,
  distance: DISTANCE_UNITS,
};

export default function SettingsScreen() {
  const { colors, pref, choose, systemScheme } = useTheme();
  const { exportSessionsCSV, units, setUnit, trainingConsent, setTrainingConsent } = useData();
  const consentOn = consentIsCurrent(trainingConsent);
  const needsRenewal = consentNeedsRenewal(trainingConsent);
  const router = useRouter();
  const { signOut } = useAuth();

  const [exporting, setExporting] = useState(false);

  const doExport = async () => {
    setExporting(true);
    await saveCSV(exportSessionsCSV(), 'prs-sessions.csv');
    setExporting(false);
  };

  // Cycles the stored preference, which every screen reads through
  // lib/units — these used to be local state that nothing else could see.
  const cycle = (kind) => {
    const opts = UNIT_OPTIONS[kind];
    const idx = opts.indexOf(units[kind]);
    setUnit(kind, opts[(idx + 1) % opts.length]);
  };

  const unitRows = [
    { icon: Ruler, label: 'Group size', value: units.group, onPress: () => cycle('group') },
    { icon: Thermometer, label: 'Temperature', value: units.temp, onPress: () => cycle('temp') },
    { icon: Gauge, label: 'Velocity', value: units.velocity, onPress: () => cycle('velocity') },
    { icon: Ruler, label: 'Distance', value: units.distance, onPress: () => cycle('distance') },
  ];

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
          <Text style={[s.title, { color: colors.tx }]}>Settings</Text>
        </View>

        <Text style={[s.sectionLabel, { color: colors.fnt }]}>APPEARANCE</Text>
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.bd }]}>
          <View style={s.themeHeader}>
            <View style={[s.themeIcon, { backgroundColor: colors.acs }]}>
              <Palette size={20} color={colors.act} />
            </View>
            <View>
              <Text style={[s.themeTitle, { color: colors.tx }]}>Theme</Text>
              <Text style={[s.themeSub, { color: colors.mut }]}>
                {pref === 'system'
                  ? `Following your device — currently ${systemScheme === 'dark' ? 'dark' : 'light'}`
                  : `Always ${pref}`}
              </Text>
            </View>
          </View>
          <View style={[s.segmented, { backgroundColor: colors.inset }]}>
            {[['system', 'Auto', SunMoon], ['light', 'Light', Sun], ['dark', 'Dark', Moon]].map(([k, label, Icon]) => {
              const on = pref === k;
              return (
                <TouchableOpacity
                  key={k}
                  onPress={() => choose(k)}
                  style={[s.seg, on && [s.segActive, { backgroundColor: colors.card }]]}
                >
                  <Icon size={16} color={on ? colors.tx : colors.mut} />
                  <Text style={[s.segText, { color: on ? colors.tx : colors.mut }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <Text style={[s.sectionLabel, { color: colors.fnt, marginTop: 22 }]}>CONTRIBUTE</Text>
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.bd }]}>
          <View style={s.themeHeader}>
            <View style={[s.themeIcon, { backgroundColor: colors.acs }]}>
              <Sparkles size={18} color={colors.act} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.themeTitle, { color: colors.tx }]}>{CONSENT_SUMMARY}</Text>
              <Text style={[s.themeSub, { color: colors.mut }]}>
                {describeConsent(trainingConsent)}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => setTrainingConsent(!consentOn)}
            style={[s.consentBtn, {
              backgroundColor: consentOn ? colors.oks : colors.inset,
              borderColor: consentOn ? colors.okt : colors.ibd,
            }]}
          >
            <Text style={[s.consentBtnText, { color: consentOn ? colors.okt : colors.act }]}>
              {consentOn ? 'Contributing — tap to stop'
                : needsRenewal ? 'Review and turn back on'
                : 'Turn on'}
            </Text>
          </TouchableOpacity>

          <Text style={[s.consentDetail, { color: colors.fnt }]}>
            Only the target photo, the shot positions and aim point you marked, the
            reference corners and the caliber are sent. Your name, email, rifles,
            loads and notes are not. Camera metadata including any GPS location is
            already stripped from every photo before it is used.
          </Text>
          <Text style={[s.consentDetail, { color: colors.fnt }]}>
            Photos already captured are never included — only ones taken while this
            is on. Every feature works the same either way.
          </Text>
        </View>

        <Text style={[s.sectionLabel, { color: colors.fnt, marginTop: 22 }]}>UNITS</Text>
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.bd, padding: 0, overflow: 'hidden' }]}>
          {unitRows.map((u, i) => (
            <TouchableOpacity key={i} onPress={u.onPress} style={[s.unitRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}>
              <u.icon size={19} color={colors.mut} />
              <Text style={[s.unitLabel, { color: colors.tx }]}>{u.label}</Text>
              <View style={[s.unitBadge, { backgroundColor: colors.acs }]}>
                <Text style={[s.unitValue, { color: colors.act }]}>{u.value}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[s.sectionLabel, { color: colors.fnt, marginTop: 22 }]}>DATA</Text>
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.bd, padding: 0, overflow: 'hidden' }]}>
          <TouchableOpacity onPress={doExport} disabled={exporting} style={s.dataRow}>
            <FileDown size={19} color={colors.mut} />
            <Text style={[s.dataLabel, { color: colors.tx }]}>
              {exporting ? 'Exporting…' : 'Export all sessions (CSV)'}
            </Text>
            <ChevronRight size={18} color={colors.fnt} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={async () => { await signOut(); router.replace('/login'); }}
          style={[s.signOut, { backgroundColor: colors.dngs }]}
        >
          <LogOut size={18} color={colors.dngt} />
          <Text style={[s.signOutText, { color: colors.dngt }]}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={[s.version, { color: colors.fnt }]}>PRS Precision · v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  backBtn: { width: 38, height: 38, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  consentBtn: { paddingVertical: 11, borderRadius: 11, borderWidth: 1, alignItems: 'center', marginTop: 12 },
  consentBtnText: { fontSize: 13, fontWeight: '800' },
  consentDetail: { fontSize: 11.5, fontWeight: '600', lineHeight: 16.5, marginTop: 9 },
  sectionLabel: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16 },
  themeHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  themeIcon: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  themeTitle: { fontSize: 15, fontWeight: '700' },
  themeSub: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  segmented: { flexDirection: 'row', gap: 6, borderRadius: 13, padding: 5 },
  seg: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 11, borderRadius: 9 },
  segActive: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 3, elevation: 2 },
  segText: { fontSize: 14, fontWeight: '700' },
  unitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  unitLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
  unitBadge: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999 },
  unitValue: { fontSize: 13, fontWeight: '700' },
  dataRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15, paddingHorizontal: 16 },
  dataLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
  signOut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 22, borderRadius: 14, padding: 15 },
  signOutText: { fontSize: 15, fontWeight: '700' },
  version: { textAlign: 'center', fontSize: 11, fontWeight: '600', marginTop: 16 },
});
