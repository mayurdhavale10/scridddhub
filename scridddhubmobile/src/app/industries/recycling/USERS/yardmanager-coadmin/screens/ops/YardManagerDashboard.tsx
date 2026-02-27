import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { setDemoRole } from '../../../../../../../store/slices/authSlice'; // Adjust path if needed

export const YardManagerDashboard = ({ navigation }: any) => {
    const dispatch = useDispatch();
    const user = useSelector((state: any) => state.auth.user);

    const [todayCount, setTodayCount] = useState({ trucks: 12, weight: 14500 });

    // Simulate Scan Action
    const handleScanInbound = () => {
        // In real app: Open Camera
        // In demo: Navigate to Barcode Simulation
        navigation.navigate("ScanCameraScreen");
    };

    const handleSwitchRole = () => {
        dispatch(setDemoRole('admin'));
        // Navigation will automatically update via root navigator if we set it up that way,
        // or we manually push back to Home for now.
        navigation.reset({
            index: 0,
            routes: [{ name: 'RecyclingHome' }],
        });
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />

            {/* High Contrast Header for Outdoor Visibility */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.roleLabel}>YARD MANAGER</Text>
                    <Text style={styles.welcomeText}>👋 {user?.fullName || 'Manager'}</Text>
                </View>
                <TouchableOpacity onPress={handleSwitchRole} style={styles.switchBtn}>
                    <Text style={styles.switchText}>Exit Yard Mode</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scroll}>

                {/* Primary Action - GIANT BUTTON */}
                <TouchableOpacity
                    style={styles.scanButton}
                    activeOpacity={0.8}
                    onPress={handleScanInbound}
                >
                    <View style={styles.scanIconCircle}>
                        <Text style={{ fontSize: 40 }}>📷</Text>
                    </View>
                    <Text style={styles.scanTitle}>SCAN INBOUND</Text>
                    <Text style={styles.scanSub}>New Truck / Bale Arrival</Text>
                </TouchableOpacity>

                {/* Secondary Actions Grid */}
                <View style={styles.grid}>
                    <TouchableOpacity style={styles.gridBtn}>
                        <Text style={styles.gridIcon}>⚖️</Text>
                        <Text style={styles.gridLabel}>Verify Weight</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.gridBtn}>
                        <Text style={styles.gridIcon}>🏭</Text>
                        <Text style={styles.gridLabel}>Process Area</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.gridBtn}>
                        <Text style={styles.gridIcon}>🚚</Text>
                        <Text style={styles.gridLabel}>Dispatch</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.gridBtn}>
                        <Text style={styles.gridIcon}>⚠️</Text>
                        <Text style={styles.gridLabel}>Report Issue</Text>
                    </TouchableOpacity>
                </View>

                {/* Today's Stats */}
                <View style={styles.statsCard}>
                    <Text style={styles.statsTitle}>TODAY'S SHIFT</Text>
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statVal}>{todayCount.trucks}</Text>
                            <Text style={styles.statLabel}>Trucks</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statVal}>{todayCount.weight.toLocaleString()} kg</Text>
                            <Text style={styles.statLabel}>Processed</Text>
                        </View>
                    </View>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#121212' }, // Dark mode default for contrast
    scroll: { padding: 20 },

    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 30,
        backgroundColor: '#1E1E1E',
        padding: 20,
        marginHorizontal: -20, // Full width
        marginTop: -10,
    },
    roleLabel: { color: '#FFD700', fontWeight: 'bold', fontSize: 12, letterSpacing: 1 },
    welcomeText: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },

    switchBtn: { backgroundColor: '#333', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#555' },
    switchText: { color: '#ccc', fontSize: 12, fontWeight: '600' },

    scanButton: {
        backgroundColor: '#00E676', // High vis green
        borderRadius: 20,
        padding: 30,
        alignItems: 'center',
        marginBottom: 30,
        elevation: 8,
        shadowColor: '#00E676',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    scanIconCircle: {
        width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(0,0,0,0.1)',
        alignItems: 'center', justifyContent: 'center', marginBottom: 15
    },
    scanTitle: { fontSize: 28, fontWeight: '900', color: '#000', letterSpacing: 0.5 },
    scanSub: { fontSize: 16, color: '#004D25', fontWeight: '600' },

    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 30 },
    gridBtn: {
        width: '48%',
        backgroundColor: '#252525',
        padding: 20,
        borderRadius: 16,
        alignItems: 'center',
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#333'
    },
    gridIcon: { fontSize: 32, marginBottom: 10 },
    gridLabel: { color: '#FFF', fontWeight: '600', fontSize: 15 },

    statsCard: { backgroundColor: '#1E1E1E', padding: 20, borderRadius: 16 },
    statsTitle: { color: '#888', fontSize: 12, fontWeight: 'bold', marginBottom: 15 },
    statsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
    statItem: { alignItems: 'center' },
    statVal: { color: '#FFF', fontSize: 24, fontWeight: 'bold' },
    statLabel: { color: '#888', fontSize: 14 },
    divider: { width: 1, height: 40, backgroundColor: '#333' },
});
