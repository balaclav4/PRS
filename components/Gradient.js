import { View } from 'react-native';

// Simple gradient placeholder — in production use expo-linear-gradient
export function LinearGradient({ colors, style, children, ...props }) {
  return (
    <View style={[{ backgroundColor: colors?.[0] || '#6D3BEB' }, style]} {...props}>
      {children}
    </View>
  );
}
