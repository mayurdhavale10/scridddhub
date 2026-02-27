import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { logoutUser } from '../../../store/slices/authSlice';
import { AppDispatch, RootState } from '../../../store';
import { SafeAreaView } from 'react-native-safe-area-context';

export const ProfileScreen = ({ navigation }: any) => {
    const dispatch = useDispatch<AppDispatch>();
    const { user } = useSelector((state: RootState) => state.auth);

    const handleLogout = async () => {
        Alert.alert(
            "Logout",
            "Are you sure you want to logout?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Logout",
                    style: "destructive",
                    onPress: async () => {
                        await dispatch(logoutUser());
                        // Navigation reset handles the redirect to Login automatically via App.tsx/RootNavigator logic
                        // But if not, we can force it:
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'Login' }],
                        });
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Profile</Text>
            </View>

            <View style={styles.content}>
                <View style={styles.avatarContainer}>
                    <Text style={styles.avatarText}>
                        {user?.email?.charAt(0).toUpperCase() || 'U'}
                    </Text>
                </View>

                <Text style={styles.email}>{user?.email || 'user@example.com'}</Text>
                <Text style={styles.role}>Workspace Admin</Text>

                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <Text style={styles.logoutText}>Log Out</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
    },
    content: {
        flex: 1,
        alignItems: 'center',
        paddingTop: 40,
        paddingHorizontal: 20,
    },
    avatarContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#E0E7FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    avatarText: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#4338CA',
    },
    email: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    role: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 40,
    },
    logoutBtn: {
        width: '100%',
        paddingVertical: 14,
        backgroundColor: '#FEE2E2',
        borderRadius: 12,
        alignItems: 'center',
    },
    logoutText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#DC2626',
    },
});
