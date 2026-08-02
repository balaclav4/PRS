import { View, Text, TouchableOpacity, Pressable, StyleSheet, Platform } from 'react-native';
import { Wind, FlaskConical, Wrench, Settings, LogOut, ChevronRight, BookOpen } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../lib/theme';

const items = [
  { icon: Wind, label: 'Ballistics', sub: 'Dope card & drops', route: '/ballistics' },
  { icon: BookOpen, label: 'Dope Cards', sub: 'Saved solutions', route: '/dopecards' },
  { icon: FlaskConical, label: 'Load Development', sub: '8-step reloading wizard', route: '/reloading' },
  { icon: Wrench, label: 'Equipment', sub: 'Rifles & loads', route: '/equipment' },
  { icon: Settings, label: 'Settings', sub: 'Units, export, appearance', route: '/settings' },
];

export default function MoreSheet({ visible, onClose }) {
  const { colors } = useTheme();
  const router = useRouter();

  if (!visible) return null;

  const go = (route) => {
    onClose();
    router.push(route);
  };

  return (
    <View style={[StyleSheet.absoluteFill, s.overlay]} pointerEvents="box-none">
      <Pressable style={s.backdrop} onPress={onClose} />
      <View
        style={[s.sheet, { backgroundColor: colors.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26 }]}
      >
        <View style={[s.handle, { backgroundColor: colors.bd }]} />
        <Text style={[s.title, { color: colors.tx }]}>More</Text>
        <View style={s.list}>
          {items.map((item) => (
            <TouchableOpacity key={item.route} onPress={() => go(item.route)} style={[s.row, { backgroundColor: colors.card, borderColor: colors.bd }]}>
              <View style={[s.iconWrap, { backgroundColor: colors.acs }]}>
                <item.icon size={20} color={colors.act} />
              </View>
              <View style={s.mid}>
                <Text style={[s.label, { color: colors.tx }]}>{item.label}</Text>
                <Text style={[s.sub, { color: colors.mut }]}>{item.sub}</Text>
              </View>
              <ChevronRight size={18} color={colors.fnt} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => { onClose(); router.replace('/login'); }} style={[s.row, { backgroundColor: colors.card, borderColor: colors.bd }]}>
            <View style={[s.iconWrap, { backgroundColor: colors.dngs }]}>
              <LogOut size={20} color={colors.dngt} />
            </View>
            <View style={s.mid}>
              <Text style={[s.label, { color: colors.dngt }]}>Sign Out</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: { zIndex: 9999, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11,11,16,0.4)' },
  sheet: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 40 : 30 },
  handle: { width: 38, height: 5, borderRadius: 99, alignSelf: 'center', marginBottom: 14 },
  title: { fontSize: 17, fontWeight: '800', marginBottom: 12 },
  list: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderRadius: 15, padding: 15 },
  iconWrap: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  mid: { flex: 1 },
  label: { fontSize: 15, fontWeight: '700' },
  sub: { fontSize: 12, fontWeight: '500', marginTop: 2 },
});
