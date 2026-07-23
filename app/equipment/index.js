import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Crosshair, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../lib/theme';
import { useData } from '../../store/data';

export default function EquipmentScreen() {
  const { colors } = useTheme();
  const { rifles, loads } = useData();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[s.title, { color: colors.tx }]}>Equipment</Text>

        <View style={s.sectionHeader}>
          <Text style={[s.sectionTitle, { color: colors.tx }]}>RIFLES</Text>
          <TouchableOpacity style={s.addBtn}>
            <Plus size={15} color={colors.act} />
            <Text style={[s.addText, { color: colors.act }]}>Add</Text>
          </TouchableOpacity>
        </View>

        <View style={s.list}>
          {rifles.map((r) => (
            <View key={r.id} style={[s.rifleRow, { backgroundColor: colors.card, borderColor: colors.bd }]}>
              <View style={[s.iconWrap, { backgroundColor: colors.acs }]}>
                <Crosshair size={21} color={colors.act} />
              </View>
              <View style={s.mid}>
                <Text style={[s.name, { color: colors.tx }]}>{r.name}</Text>
                <Text style={[s.spec, { color: colors.mut }]}>{r.cartridge} · {r.barrelLength} {r.twist ? `· ${r.twist}` : ''}</Text>
              </View>
              <ChevronRight size={18} color={colors.fnt} />
            </View>
          ))}
        </View>

        <View style={[s.sectionHeader, { marginTop: 24 }]}>
          <Text style={[s.sectionTitle, { color: colors.tx }]}>LOADS</Text>
          <TouchableOpacity style={s.addBtn}>
            <Plus size={15} color={colors.act} />
            <Text style={[s.addText, { color: colors.act }]}>Add</Text>
          </TouchableOpacity>
        </View>

        <View style={s.list}>
          {loads.map((l) => (
            <View key={l.id} style={[s.loadRow, { backgroundColor: colors.card, borderColor: colors.bd }]}>
              <View style={s.loadHeader}>
                <Text style={[s.name, { color: colors.tx }]}>{l.name}</Text>
                <View style={[s.calBadge, { backgroundColor: colors.acs }]}>
                  <Text style={[s.calText, { color: colors.act }]}>{l.caliber}</Text>
                </View>
              </View>
              <View style={s.loadStats}>
                <View>
                  <Text style={[s.loadStatVal, { color: colors.tx }]}>{l.chargeGr}gr</Text>
                  <Text style={[s.loadStatLabel, { color: colors.fnt }]}>CHARGE</Text>
                </View>
                <View>
                  <Text style={[s.loadStatVal, { color: colors.tx }]}>{l.velocityFps}</Text>
                  <Text style={[s.loadStatLabel, { color: colors.fnt }]}>MV</Text>
                </View>
                <View>
                  <Text style={[s.loadStatVal, { color: colors.tx }]}>{l.sd}</Text>
                  <Text style={[s.loadStatLabel, { color: colors.fnt }]}>SD</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4, marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  addText: { fontSize: 13, fontWeight: '700' },
  list: { gap: 10 },
  rifleRow: { flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: 1, borderRadius: 16, padding: 15 },
  iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  mid: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: '700' },
  spec: { fontSize: 12, fontWeight: '500', marginTop: 3 },
  loadRow: { borderWidth: 1, borderRadius: 16, padding: 15 },
  loadHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  calBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  calText: { fontSize: 11, fontWeight: '700' },
  loadStats: { flexDirection: 'row', gap: 16, marginTop: 11 },
  loadStatVal: { fontSize: 14, fontWeight: '700', fontFamily: 'JetBrainsMono_700Bold' },
  loadStatLabel: { fontSize: 10, fontWeight: '600', marginTop: 1 },
});
