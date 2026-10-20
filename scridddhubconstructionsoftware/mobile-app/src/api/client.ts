import { Platform } from 'react-native';
import { createApiClient } from '@scridddhub/api-client';

// Android emulator can't reach the host machine via localhost â€” it needs the special
// 10.0.2.2 alias. iOS simulator and web both share the host's network namespace.
// Release (demo) APKs on a real phone use the laptop's address on the local Wi-Fi: the phone must
// be on the same Wi-Fi with the backend running. If the laptop's address changes (ipconfig),
// update DEMO_HOST and rebuild the APK.
const DEMO_HOST = 'http://10.137.106.98:8080';

export const API_BASE_URL = __DEV__
  ? Platform.select({ android: 'http://10.0.2.2:8080', default: 'http://localhost:8080' })!
  : DEMO_HOST;

export const api = createApiClient(API_BASE_URL);
