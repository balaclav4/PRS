import { Tabs, useRouter } from 'expo-router';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Home, History, Camera, ChartColumn, Menu } from 'lucide-react-native';
import { useTheme } from '../../lib/theme';
import { useState } from 'react';
import MoreSheet from '../../components/MoreSheet';

function TabBarIcon({ icon: Icon, color, size }) {
  return <Icon size={size || 23} color={color} />;
}

function CaptureButton({ onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={s.fab} activeOpacity={0.8}>
      <Camera size={24} color="#fff" />
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  const { colors } = useTheme();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.act,
          tabBarInactiveTintColor: colors.fnt,
          tabBarStyle: {
            backgroundColor: colors.nav,
            borderTopColor: colors.bd,
            borderTopWidth: 1,
            paddingBottom: Platform.OS === 'ios' ? 24 : 10,
            paddingTop: 10,
            height: Platform.OS === 'ios' ? 88 : 64,
          },
          tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <TabBarIcon icon={Home} color={color} />,
          }}
        />
        <Tabs.Screen
          name="sessions"
          options={{
            title: 'Sessions',
            tabBarIcon: ({ color }) => <TabBarIcon icon={History} color={color} />,
          }}
        />
        <Tabs.Screen
          name="capture-placeholder"
          options={{
            title: '',
            tabBarButton: () => <CaptureButton onPress={() => router.push('/capture')} />,
          }}
        />
        <Tabs.Screen
          name="analytics"
          options={{
            title: 'Analytics',
            tabBarIcon: ({ color }) => <TabBarIcon icon={ChartColumn} color={color} />,
          }}
        />
        <Tabs.Screen
          name="more-placeholder"
          options={{
            title: 'More',
            tabBarIcon: ({ color }) => <TabBarIcon icon={Menu} color={color} />,
            tabBarButton: (props) => (
              <TouchableOpacity {...props} onPress={() => setMoreOpen(true)} />
            ),
          }}
        />
      </Tabs>
      <MoreSheet visible={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}

const s = StyleSheet.create({
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -24,
    shadowColor: '#6D3BEB',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 22,
    elevation: 8,
    backgroundImage: undefined,
    backgroundColor: '#6D3BEB',
  },
});
