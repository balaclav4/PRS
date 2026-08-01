import { Platform, Alert } from 'react-native';

/**
 * Save a CSV string to the device.
 *
 * Web triggers an anchor download from a Blob; native writes to the app's
 * document directory and opens the share sheet. expo-file-system and
 * expo-sharing are required lazily because importing them at module scope
 * crashes the web bundle.
 */
export async function saveCSV(csv, filename) {
  try {
    if (Platform.OS === 'web') {
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const FS = require('expo-file-system');
      const Share = require('expo-sharing');
      const path = FS.documentDirectory + filename;
      await FS.writeAsStringAsync(path, csv);
      if (await Share.isAvailableAsync()) {
        await Share.shareAsync(path, { mimeType: 'text/csv' });
      } else {
        Alert.alert('Export', 'File saved to app documents.');
      }
    }
    return true;
  } catch (e) {
    const msg = 'Export failed: ' + e.message;
    if (Platform.OS === 'web') alert(msg);
    else Alert.alert('Export Error', msg);
    return false;
  }
}

/** Filesystem-safe filename stem from a session name. */
export function slugify(name, fallback = 'session') {
  const slug = String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || fallback;
}
