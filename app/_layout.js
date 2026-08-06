import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { JetBrainsMono_500Medium, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import { ThemeProvider, useTheme } from '../lib/theme';
import { DataProvider } from '../store/data';
import { AuthProvider, useAuth } from '../store/auth';

function InnerLayout() {
  const { colors, ready: themeReady } = useTheme();
  const { ready } = useAuth();

  // Firebase restores a persisted session asynchronously. Rendering the stack
  // before that resolves would flash a signed-in user past the login screen and
  // back, so hold until the first auth state is known. When Firebase is not
  // configured this is already true on the first render and costs nothing.
  // Also wait for the stored theme, or a dark-preference user sees a light
  // flash on every launch while the preference is read.
  if (!ready || !themeReady) return null;

  return (
    <>
      <StatusBar style={colors.statusBar} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="capture/index" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="session/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="login" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider>
      <AuthProvider>
        <DataProvider>
          <InnerLayout />
        </DataProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
