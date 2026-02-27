import AsyncStorage from '@react-native-async-storage/async-storage';

// TODO: Integrate 'react-native-keychain' for production
export const secureStorage = {
    async set(key: string, value: string) {
        try {
            await AsyncStorage.setItem(`@SECURE_${key}`, value);
        } catch (e) {
            console.error('[SecureStorage] Set Error:', e);
        }
    },

    async get(key: string): Promise<string | null> {
        try {
            return await AsyncStorage.getItem(`@SECURE_${key}`);
        } catch (e) {
            console.error('[SecureStorage] Get Error:', e);
            return null;
        }
    },

    async remove(key: string) {
        try {
            await AsyncStorage.removeItem(`@SECURE_${key}`);
        } catch (e) {
            console.error('[SecureStorage] Remove Error:', e);
        }
    }
};
