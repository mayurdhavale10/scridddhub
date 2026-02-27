import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    ActivityIndicator, Alert, ScrollView
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { updateStaffSafety } from '../../../../../../../shared/safety/api';

const APP_GREEN = '#1B6B2F';
const TENANT = 'TENANT-001';

const ZONES = [
    { id: 'yard_alpha', name: 'Sorting Yard Alpha', icon: 'warehouse', color: '#1B6B2F' },
    { id: 'yard_beta', name: 'Processing Yard Beta', icon: 'factory', color: '#2563EB' },
    { id: 'office_main', name: 'Main Office', icon: 'office-building', color: '#7C3AED' },
    { id: 'storage_shed', name: 'Storage Shed', icon: 'dolly', color: '#D97706' },
    { id: 'loading_dock', name: 'Loading Dock', icon: 'truck-delivery', color: '#059669' },
];

export const CheckInScreen = ({ navigation }: any) => {
    const [loading, setLoading] = useState(false);
    const [activeZone, setActiveZone] = useState<string | null>(null);

    const handleCheckIn = async (zone: any) => {
        try {
            setLoading(true);
            const packet = {
                employeeId: 'EMP-001', // Should come from real auth context
                employeeName: 'John Doe',
                role: 'Operator',
                status: 'safe',
                location: {
                    zone: zone.name,
                },
                deviceStats: {
                    battery: 85, // Mock battery for now
                    isOnline: true
                }
            };

            await updateStaffSafety(TENANT, packet);
            setActiveZone(zone.id);
            Alert.alert("Success", `Checked into ${zone.name}`);
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Could not update location");
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.root}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Icon name="chevron-left" size={28} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Operational Pulse</Text>
            </View>

            <ScrollView contentContainerStyle={styles.container}>
                <View style={styles.infoCard}>
                    <Icon name="information-outline" size={24} color={APP_GREEN} />
                    <Text style={styles.infoText}>
                        Select your current work area. This helps the Yard Manager track operations and keeps you safe during emergencies.
                    </Text>
                </View>

                {ZONES.map((zone) => (
                    <TouchableOpacity
                        key={zone.id}
                        style={[
                            styles.zoneCard,
                            activeZone === zone.id && { borderColor: zone.color, backgroundColor: zone.color + '10', borderWidth: 2 }
                        ]}
                        onPress={() => handleCheckIn(zone)}
                        disabled={loading}
                    >
                        <View style={[styles.iconBox, { backgroundColor: zone.color + '20' }]}>
                            <Icon name={zone.icon} size={28} color={zone.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.zoneName, activeZone === zone.id && { color: zone.color }]}>
                                {zone.name}
                            </Text>
                            <Text style={styles.zoneType}>Zone: {zone.id.toUpperCase()}</Text>
                        </View>
                        {activeZone === zone.id && (
                            <Icon name="check-circle" size={24} color={zone.color} />
                        )}
                        {loading && activeZone !== zone.id && (
                            <ActivityIndicator color={APP_GREEN} />
                        )}
                    </TouchableOpacity>
                ))}

                <TouchableOpacity
                    style={styles.sosBtn}
                    onPress={() => Alert.alert("EMERGENCY", "Send SOS alert to Admin?", [
                        { text: "Cancel" },
                        { text: "SEND SOS", onPress: () => Alert.alert("SOS Sent!") }
                    ])}
                >
                    <Icon name="alert-octagon" size={24} color="#FFF" />
                    <Text style={styles.sosText}>TRIGGER EMERGENCY SOS</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F9FAFB' },
    header: {
        backgroundColor: APP_GREEN, padding: 20,
        flexDirection: 'row', alignItems: 'center', gap: 15
    },
    headerTitle: { fontSize: 20, fontWeight: '900', color: '#FFF' },
    container: { padding: 20 },
    infoCard: {
        flexDirection: 'row', backgroundColor: '#E8F5E9',
        padding: 15, borderRadius: 12, marginBottom: 25, gap: 10
    },
    infoText: { flex: 1, color: '#2E7D32', fontSize: 13, lineHeight: 18, fontWeight: '600' },
    zoneCard: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF',
        padding: 18, borderRadius: 16, marginBottom: 12,
        borderWidth: 1, borderColor: '#E5E7EB', elevation: 2
    },
    iconBox: { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
    zoneName: { fontSize: 16, fontWeight: '800', color: '#111827' },
    zoneType: { fontSize: 12, color: '#9CA3AF', marginTop: 2, fontWeight: '700' },
    sosBtn: {
        backgroundColor: '#DC2626', padding: 18, borderRadius: 16,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 10, marginTop: 20, elevation: 4
    },
    sosText: { color: '#FFF', fontSize: 15, fontWeight: '900' }
});
