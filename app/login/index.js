import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Target } from 'lucide-react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useTheme } from '../../lib/theme';

export default function LoginScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const login = () => {
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.content}>
          <View style={s.center}>
            <View style={s.logo}>
              <Target size={40} color="#fff" />
            </View>
            <Text style={[s.appName, { color: colors.tx }]}>PRS Precision</Text>
            <Text style={[s.tagline, { color: colors.mut }]}>Measure groups. Track loads.{'\n'}Shoot tighter.</Text>

            <View style={s.form}>
              <View>
                <Text style={[s.label, { color: colors.mut }]}>Email</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="shooter@precision.com"
                  placeholderTextColor={colors.fnt}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={[s.input, { backgroundColor: colors.input, borderColor: colors.ibd, color: colors.tx }]}
                />
              </View>
              <View>
                <Text style={[s.label, { color: colors.mut }]}>Password</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={colors.fnt}
                  secureTextEntry
                  style={[s.input, { backgroundColor: colors.input, borderColor: colors.ibd, color: colors.tx }]}
                />
              </View>
            </View>

            <TouchableOpacity onPress={login} style={s.signIn}>
              <Text style={s.signInText}>Sign In</Text>
            </TouchableOpacity>

            <View style={s.divider}>
              <View style={[s.dividerLine, { backgroundColor: colors.ibd }]} />
              <Text style={[s.dividerText, { color: colors.fnt }]}>OR</Text>
              <View style={[s.dividerLine, { backgroundColor: colors.ibd }]} />
            </View>

            <TouchableOpacity onPress={login} style={[s.apple, { backgroundColor: colors.card, borderColor: colors.ibd }]}>
              <Text style={[s.appleText, { color: colors.tx }]}>Continue with Apple</Text>
            </TouchableOpacity>
          </View>

          <Text style={[s.footer, { color: colors.fnt }]}>
            New here? <Text style={{ color: colors.act }}>Create an account</Text>
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  content: { flex: 1, padding: 26, paddingTop: 28, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  logo: {
    width: 76, height: 76, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#6D3BEB',
    shadowColor: 'rgba(109,59,235,0.5)', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 1, shadowRadius: 30, elevation: 8,
    marginBottom: 22,
  },
  appName: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  tagline: { fontSize: 15, fontWeight: '500', lineHeight: 21, textAlign: 'center', marginTop: 6, marginBottom: 30 },
  form: { width: '100%', gap: 12 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input: { width: '100%', padding: 14, paddingHorizontal: 16, borderWidth: 1, borderRadius: 13, fontSize: 15 },
  signIn: {
    width: '100%', marginTop: 22, padding: 16, borderRadius: 14, alignItems: 'center',
    backgroundColor: '#6D3BEB',
    shadowColor: 'rgba(109,59,235,0.55)', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 1, shadowRadius: 24, elevation: 6,
  },
  signInText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontWeight: '600' },
  apple: { width: '100%', padding: 14, borderRadius: 14, borderWidth: 1, alignItems: 'center' },
  appleText: { fontSize: 15, fontWeight: '600' },
  footer: { textAlign: 'center', fontSize: 12 },
});
