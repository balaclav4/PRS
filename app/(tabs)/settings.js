import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Palette, Sun, Moon, Ruler, Thermometer, Gauge, FileDown, Sheet, LogOut, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useTheme } from '../../lib/theme';
import { useData } from '../../store/data';

const UNIT_OPTIONS = {
  groupSize: ['MOA', 'MRAD', 'Inches'],
  temperature: ['°F', '°C'],
  velocity: ['fps', 'm/s'],
};

export default function SettingsScreen() {
  const { colors, isDark, setDark, setLight } = useTheme();
  const { exportSessionsCSV } = useData();
  const router = useRouter();

  const [groupUnit, setGroupUnit] = useState('MOA');
  const [tempUnit, setTempUnit] = useState('°F');
  const [velUnit, setVelUnit] = useState('fps');
  const [exporting, setExporting] = useState(false);

  const doExport = async () => {
    setExporting(true);
    try {
      const csv = exportSessionsCSV();
      if (Platform.OS === 'web') {
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'prs-sessions.csv';
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const FS = require('expo-file-system');
        const Share = require('expo-sharing');
        const path = FS.documentDirectory + 'prs-sessions.csv';
        await FS.writeAsStringAsync(path, csv);
        if (await Share.isAvailableAsync()) {
          await Share.shareAsync(path, { mimeType: 'text/csv' });
        } else {
          Alert.alert('Export', 'File saved to app documents.');
        }
      }
    } catch (e) {
      const msg = 'Export failed: ' + e.message;
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Export Error', msg);
    }
    setExporting(false);
  };

  const cycleUnit = (current, options, setter) => {
    const idx = options.indexOf(current);
    setter(options[(idx + 1) % options.length]);
  };

  const units = [
    { icon: Ruler, label: 'Group size', value: groupUnit, onPress: () => cycleUnit(groupUnit, UNIT_OPTIONS.groupSize, setGroupUnit) },
    { icon: Thermometer, label: 'Temperature', value: tempUnit, onPress: () => cycleUnit(tempUnit, UNIT_OPTIONS.temperature, setTempUnit) },
    { icon: Gauge, label: 'Velocity', value: velUnit, onPress: () => cycleUnit(velUnit, UNIT_OPTIONS.velocity, setVelUnit) },
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
              <Text style={[s.themeSub, { color: colors.mut }]}>Choose light or dark</Text>
            </View>
          </View>
          <View style={[s.segmented, { backgroundColor: colors.inset }]}>
            <TouchableOpacity onPress={setLight} style={[s.seg, !isDark && [s.segActive, { backgroundColor: colors.card }]]}>
              <Sun size={16} color={!isDark ? colors.tx : colors.mut} />
              <Text style={[s.segText, { color: !isDark ? colors.tx : colors.mut }]}>Light</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={setDark} style={[s.seg, isDark && [s.segActive, { backgroundColor: colors.card }]]}>
              <Moon size={16} color={isDark ? colors.tx : colors.mut} />
              <Text style={[s.segText, { color: isDark ? colors.tx : colors.mut }]}>Dark</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[s.sectionLabel, { color: colors.fnt, marginTop: 22 }]}>UNITS</Text>
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.bd, padding: 0, overflow: 'hidden' }]}>
          {units.map((u, i) => (
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
            <Text style={[s.dataLabel, { color: colors.tx }]}>Export all sessions (CSV)</Text>
            <ChevronRight size={18} color={colors.fnt} />
          </TouchableOpacity>
          <TouchableOpacity onPress={doExport} disabled={exporting} style={[s.dataRow, { borderTopWidth: 1, borderTopColor: colors.line }]}>
            <Sheet size={19} color={colors.mut} />
            <Text style={[s.dataLabel, { color: colors.tx }]}>Export to Excel</Text>
            <ChevronRight size={18} color={colors.fnt} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.replace('/login')} style={[s.signOut, { backgroundColor: colors.dngs }]}>
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
