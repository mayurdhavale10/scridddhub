import { Platform } from 'react-native';
import { createApiClient } from '@scridddhub/api-client';

// Android emulator can't reach the host machine via localhost — it needs the special
// 10.0.2.2 alias. iOS simulator and web both share the host's network namespace.
const API_BASE_URL = Platform.select({
  android: 'http://10.0.2.2:8080',
  default: 'http://localhost:8080',
});

export const api = createApiClient(API_BASE_URL!);
