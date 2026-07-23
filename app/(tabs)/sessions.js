import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useTheme } from '../../lib/theme';
import { useData } from '../../store/data';
import FilterChips from '../../components/FilterChips';
import SessionRow from '../../components/SessionRow';

export default function SessionsScreen() {
  const { colors } = useTheme();
  const { sessions, rifles, getRifleName } = useData();
  const router = useRouter();
  const [filter, setFilter] = useState('all');

  const chips = [
    { key: 'all', label: 'All rifles' },
    ...rifles.map(r => ({ key: r.id, label: r.name })),
  ];

  const filtered = filter === 'all'
    ? sessions
    : sessions.filter(s => s.rifleId === filter);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <View>
            <Text style={[s.title, { color: colors.tx }]}>Sessions</Text>
            <Text style={[s.count, { color: colors.mut }]}>
              <Text style={{ fontFamily: 'JetBrainsMono_700Bold' }}>{filtered.length}</Text> sessions
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/capture')}
            style={[s.newBtn, { backgroundColor: colors.acs }]}
          >
            <Plus size={15} color={colors.act} />
            <Text style={[s.newText, { color: colors.act }]}>New</Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginHorizontal: -20, marginBottom: 16 }}>
          <FilterChips items={chips} selected={filter} onSelect={setFilter} />
        </View>

        <View style={s.list}>
          {filtered.map((sess) => (
            <SessionRow
              key={sess.id}
              name={sess.name}
              date={sess.date}
              rifle={getRifleName(sess.rifleId)}
              meta={`${sess.distanceYd} yd · ${sess.targetCount} targets`}
              best={sess.best}
              onPress={() => router.push(`/session/${sess.id}`)}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  count: { fontSize: 13, fontWeight: '600', marginTop: 3 },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12 },
  newText: { fontSize: 13, fontWeight: '700' },
  list: { gap: 10 },
});
