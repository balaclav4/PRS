import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../lib/theme';

export default function StatTile({ icon: Icon, value, label, iconColor }) {
  const { colors } = useTheme();
  return (
    <View style={[s.tile, { backgroundColor: colors.card, borderColor: colors.bd }]}>
      {Icon && <Icon size={20} color={iconColor || colors.act} style={s.icon} />}
      <Text style={[s.value, { color: colors.tx, fontFamily: 'JetBrainsMono_700Bold' }]}>{value}</Text>
      <Text style={[s.label, { color: colors.mut }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  tile: { borderWidth: 1, borderRadius: 16, padding: 14, paddingHorizontal: 12 },
  icon: { marginBottom: 10 },
  value: { fontSize: 22, fontWeight: '700' },
  label: { fontSize: 11, fontWeight: '600', marginTop: 2 },
});
