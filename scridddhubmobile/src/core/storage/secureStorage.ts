// Abstraction layer for Secure Storage
// TODO: Replace with 'react-native-keychain' or 'react-native-encrypted-storage' in production
// Currently using logic to allow rapid development without native rebuilds

/* 
 * In a real build:
 * import * as Keychain from 'react-native-keychain';
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const storage = {
    async setToken(key: string, value: string) {
        try {
            // PROD: await Keychain.setGenericPassword(key, value, { service: key });
            await AsyncStorage.setItem(`@SECURE_${key}`, value);
        } catch (e) {
            console.error('Secure Storage Error:', e);
        }
    },

    async getToken(key: string) {
        try {
            // PROD: const credentials = await Keychain.getGenericPassword({ service: key });
            // return credentials ? credentials.password : null;
            return await AsyncStorage.getItem(`@SECURE_${key}`);
        } catch (e) {
            console.error('Secure Storage Error:', e);
            return null;
        }
    },

    async clearToken(key: string) {
        try {
            // PROD: await Keychain.resetGenericPassword({ service: key });
            await AsyncStorage.removeItem(`@SECURE_${key}`);
        } catch (e) {
            console.error('Secure Storage Error:', e);
        }
    }
};
