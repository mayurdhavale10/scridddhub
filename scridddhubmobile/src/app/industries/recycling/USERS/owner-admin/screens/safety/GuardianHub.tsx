import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    StatusBar, ActivityIndicator, Alert, RefreshControl
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMusterReport, triggerSOS } from '../../../../../../../shared/safety/api';

const APP_GREEN = '#1B6B2F';
const RED = '#DC2626';
const TENANT = 'TENANT-001';

export const GuardianHub = ({ navigation }: any) => {
    const [loading, setLoading] = useState(true);
    const [report, setReport] = useState<any>(null);
    const [isEmergencyMode, setEmergencyMode] = useState(false);

    useEffect(() => {
        loadMuster();
        const timer = setInterval(loadMuster, 30000); // Auto-refresh every 30s
        return () => clearInterval(timer);
    }, []);

    const loadMuster = async () => {
        try {
            const data = await getMusterReport(TENANT);
            setReport(data);

            // Check if anyone is in "emergency" status
            const inDanger = data.locations.some((p: any) => p.status === 'emergency');
            if (inDanger) setEmergencyMode(true);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => navigation.goBack();

    const renderStaffItem = (staff: any) => (
        <View key={staff.employeeId} style={[
            styles.staffCard,
            staff.status === 'emergency' && styles.alertCard
        ]}>
            <View style={styles.staffMain}>
                <View style={[styles.avatar, { backgroundColor: staff.status === 'emergency' ? RED : '#E5E7EB' }]}>
                    <Icon name="account" size={24} color={staff.status === 'emergency' ? '#FFF' : '#666'} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.staffName}>{staff.employeeName}</Text>
                    <Text style={styles.staffRole}>{staff.role}</Text>
                </View>
                <View style={styles.statusBox}>
                    <View style={[styles.indicator, { backgroundColor: staff.status === 'emergency' ? RED : (staff.deviceStats.isOnline ? '#10B981' : '#9CA3AF') }]} />
                    <Text style={styles.statusText}>{staff.status === 'emergency' ? 'SOS' : (staff.deviceStats.isOnline ? 'Active' : 'Offline')}</Text>
                </View>
            </View>

            <View style={styles.staffFooter}>
                <View style={styles.locItem}>
                    <Icon name="map-marker" size={14} color="#666" />
                    <Text style={styles.locText}>{staff.location.zone} • {new Date(staff.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
                <View style={styles.locItem}>
                    <Icon name="battery" size={14} color="#666" />
                    <Text style={styles.locText}>{staff.deviceStats.battery}%</Text>
                </View>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={[styles.root, isEmergencyMode && { backgroundColor: '#FEF2F2' }]}>
            <StatusBar barStyle="light-content" backgroundColor={isEmergencyMode ? RED : APP_GREEN} />

            {/* Header */}
            <View style={[styles.header, isEmergencyMode && { backgroundColor: RED }]}>
                <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
                    <Icon name="chevron-left" size={28} color="#FFF" />
                </TouchableOpacity>
                <View>
                    <Text style={styles.headerLabel}>WORKFORCE PULSE</Text>
                    <Text style={styles.headerTitle}>Presence Terminal</Text>
                </View>
                <TouchableOpacity onPress={loadMuster} style={styles.refreshBtn}>
                    <Icon name="sync" size={24} color="#FFF" />
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={APP_GREEN} style={{ marginTop: 40 }} />
            ) : (
                <ScrollView contentContainerStyle={styles.body}>

                    {/* Muster Summary */}
                    <View style={styles.summaryGrid}>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryVal}>{report?.accountedFor || 0}</Text>
                            <Text style={styles.summaryLabel}>ON PREMISES</Text>
                        </View>
                        <View style={[styles.summaryItem, { borderColor: RED }]}>
                            <Text style={[styles.summaryVal, { color: RED }]}>{report?.missing || 0}</Text>
                            <Text style={[styles.summaryLabel, { color: RED }]}>OFF-RADAR</Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryVal}>{report?.totalStaff || 0}</Text>
                            <Text style={styles.summaryLabel}>TOTAL STAFF</Text>
                        </View>
                    </View>

                    {isEmergencyMode && (
                        <View style={styles.emergencyBanner}>
                            <Icon name="alert-decagram" size={24} color="#FFF" />
                            <Text style={styles.emergencyText}>EMERGENCY ALERT ACTIVE: SOS Pings Detected</Text>
                        </View>
                    )}

                    <Text style={styles.sectionTitle}>REAL-TIME STAFF TRACKER</Text>
                    {report?.locations.map(renderStaffItem)}

                    {/* Safety Tips / Disaster Protcols */}
                    <View style={styles.protocolCard}>
                        <Text style={styles.protocolTitle}>Disaster Protocol</Text>
                        <Text style={styles.protocolBody}>1. Trigger Muster Call (Pings all devices)</Text>
                        <Text style={styles.protocolBody}>2. Evacuate to Zone: ASSEMBLY POINT A</Text>
                        <Text style={styles.protocolBody}>3. Contact Emergency: 911 / 108</Text>
                    </View>
                </ScrollView>
            )}

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.musterBtn, isEmergencyMode && { backgroundColor: RED }]}
                    onPress={() => Alert.alert("Muster Call", "This will ping every employee's phone to check-in. Proceed?", [
                        { text: "Cancel" },
                        { text: "TRIGGER", onPress: () => Alert.alert("Pinging all devices...") }
                    ])}
                >
                    <Icon name="account-search" size={24} color="#FFF" />
                    <Text style={styles.musterBtnText}>TRIGGER MUSTER CALL</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F9FAFB' },
    header: {
        backgroundColor: APP_GREEN, padding: 20,
        flexDirection: 'row', alignItems: 'center',
        borderBottomLeftRadius: 24, borderBottomRightRadius: 24
    },
    backBtn: { marginRight: 15 },
    headerLabel: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.7)', letterSpacing: 1 },
    headerTitle: { fontSize: 20, fontWeight: '900', color: '#FFF' },
    refreshBtn: { marginLeft: 'auto' },
    body: { padding: 20 },
    summaryGrid: {
        flexDirection: 'row', gap: 10, marginBottom: 24
    },
    summaryItem: {
        flex: 1, backgroundColor: '#FFF', padding: 15, borderRadius: 16,
        alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB',
        elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5
    },
    summaryVal: { fontSize: 22, fontWeight: '900', color: APP_GREEN },
    summaryLabel: { fontSize: 9, fontWeight: '800', color: '#9CA3AF', marginTop: 4 },
    emergencyBanner: {
        backgroundColor: RED, padding: 15, borderRadius: 12,
        flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24
    },
    emergencyText: { color: '#FFF', fontWeight: '800', fontSize: 12, flex: 1 },
    sectionTitle: { fontSize: 12, fontWeight: '900', color: '#9CA3AF', marginBottom: 16, letterSpacing: 1 },
    staffCard: {
        backgroundColor: '#FFF', borderRadius: 16, padding: 15, marginBottom: 12,
        borderWidth: 1, borderColor: '#E5E7EB'
    },
    alertCard: { borderColor: RED, backgroundColor: '#FEF2F2', borderWidth: 2 },
    staffMain: { flexDirection: 'row', alignItems: 'center' },
    avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    staffName: { fontSize: 16, fontWeight: '800', color: '#111827' },
    staffRole: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
    statusBox: { alignItems: 'flex-end' },
    indicator: { width: 8, height: 8, borderRadius: 4, marginBottom: 4 },
    statusText: { fontSize: 10, fontWeight: '800', color: '#6B7280' },
    staffFooter: {
        flexDirection: 'row', justifyContent: 'space-between',
        marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6'
    },
    locItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    locText: { fontSize: 11, color: '#666', fontWeight: '600' },
    protocolCard: {
        backgroundColor: '#111827', padding: 20, borderRadius: 20, marginTop: 20
    },
    protocolTitle: { color: '#FFF', fontSize: 16, fontWeight: '900', marginBottom: 12 },
    protocolBody: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 8, fontWeight: '600' },
    footer: { padding: 20, borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: '#FFF' },
    musterBtn: {
        backgroundColor: APP_GREEN, paddingVertical: 16, borderRadius: 16,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10
    },
    musterBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' }
});
