import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { resetTenant } from '../../store/slices/tenantSlice';

export const HomeScreen = ({ navigation }: any) => {
    const { industryName, industry } = useSelector((state: RootState) => state.tenant);
    const dispatch = useDispatch();

    const handleSwitch = () => {
        dispatch(resetTenant());
        navigation.replace('Onboarding');
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.greeting}>Welcome Back</Text>
                <Text style={styles.industryTag}>{industryName || 'General Business'}</Text>
            </View>

            <View style={styles.content}>
                <Text style={styles.placeholder}>
                    {industry === 'factory' && '🏭 Factory Modules Loaded'}
                    {industry === 'recycling' && '♻️ Recycling Plant Modules Loaded'}
                    {industry === 'hospital' && '🏥 Hospital Modules Loaded'}
                    {industry === 'home' && '🏠 General Dashboard'}
                </Text>
            </View>

            <TouchableOpacity onPress={handleSwitch} style={styles.switchButton}>
                <Text style={styles.switchText}>Switch Industry</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
        padding: 24,
    },
    header: {
        marginBottom: 32,
    },
    greeting: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#111827',
    },
    industryTag: {
        fontSize: 18,
        color: '#378839',
        fontWeight: '600',
        marginTop: 4,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholder: {
        fontSize: 20,
        color: '#6B7280',
        fontWeight: '500',
    },
    switchButton: {
        alignSelf: 'center',
        padding: 12,
    },
    switchText: {
        color: '#378839',
        fontWeight: '600',
    },
});
