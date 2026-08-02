import { Tabs, useRouter, usePathname } from 'expo-router';
import { View, TouchableOpacity, StyleSheet, Platform, Pressable, Text } from 'react-native';
import { Home, History, Camera, ChartColumn, Menu } from 'lucide-react-native';
import { useTheme } from '../../lib/theme';
import { useState, useCallback, useRef, useEffect } from 'react';
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
  const moreRef = useRef(null);
  const pathname = usePathname();

  // Close the sheet whenever the route changes. MoreSheet's own onClose fires
  // on tap, but the sheet was surviving the navigation and covering the tab
  // bar on the destination screen; keying off the route is unconditional.
  useEffect(() => { setMoreOpen(false); }, [pathname]);

  useEffect(() => {
    if (Platform.OS === 'web' && moreRef.current) {
      const el = moreRef.current;
      const handler = () => setMoreOpen(true);
      el.addEventListener('click', handler);
      return () => el.removeEventListener('click', handler);
    }
  }, []);

  const MoreButton = useCallback((props) => {
    return (
      <View ref={moreRef} style={props.style}>
        <Pressable
          onPress={() => setMoreOpen(true)}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          {props.children}
        </Pressable>
      </View>
    );
  }, []);

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
            tabBarButton: MoreButton,
          }}
        />

        {/* Reached from the More sheet, not the bar. They live inside the tab
            navigator so the bar stays visible — pushed on the root stack they
            covered it, stranding the user on screens with no back button.
            Listed explicitly: expo-router enumerates the children of <Tabs> to
            build its route table, and a mapped array made it mis-associate
            names, mounting several of these screens at once. */}
        <Tabs.Screen name="ballistics" options={{ href: null }} />
        <Tabs.Screen name="reloading" options={{ href: null }} />
        <Tabs.Screen name="equipment" options={{ href: null }} />
        <Tabs.Screen name="settings" options={{ href: null }} />
        <Tabs.Screen name="dopecards" options={{ href: null }} />
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
    backgroundColor: '#6D3BEB',
  },
});
