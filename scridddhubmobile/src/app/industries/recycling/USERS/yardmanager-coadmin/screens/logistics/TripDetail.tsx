import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    StatusBar, TextInput, ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { updateTripStatus } from '../../../../../../../shared/logistics/api';
import { trackingService } from '../../../../../../../shared/logistics/TrackingService';

const APP_GREEN = '#1B6B2F';
const TENANT = 'TENANT-001';

export const TripDetailScreen = ({ navigation, route }: any) => {
    const { trip } = route.params;
    const [submitting, setSubmitting] = useState(false);
    const [isTracking, setIsTracking] = useState(false);

    // Track the trip in real-time if it's en_route
    useEffect(() => {
        if (trip.status === 'en_route') {
            trackingService.startTracking(trip.trip_id);
            setIsTracking(true);

            // Simulation of movement for demo purposes
            const interval = setInterval(() => {
                const lat = 19.076 + (Math.random() - 0.5) * 0.01;
                const lon = 72.877 + (Math.random() - 0.5) * 0.01;
                trackingService.updateLocation({ latitude: lat, longitude: lon }, trip.destination);
            }, 5000);

            return () => {
                clearInterval(interval);
                trackingService.stopTracking();
            };
        }
    }, [trip.status]);

    // Lifecycle State
    const [odometer, setOdometer] = useState('');
    const [fuelLevel, setFuelLevel] = useState('75');

    const handleAction = async (newStatus: string) => {
        try {
            setSubmitting(true);
            const endData = newStatus === 'completed' ? {
                end_odometer: parseInt(odometer),
                fuel_used: 12 // Mock calculation
            } : undefined;

            await updateTripStatus(TENANT, trip.trip_id, newStatus, endData);
            Alert.alert("Success", `Trip marked as ${newStatus}`);
            navigation.goBack();
        } catch (e) {
            Alert.alert("Error", "Failed to update trip status");
        } finally {
            setSubmitting(false);
        }
    };

    const StatusStep = ({ title, desc, icon, completed, active }: any) => (
        <View style={styles.stepRow}>
            <View style={styles.stepLeft}>
                <View style={[styles.stepIcon, completed && styles.stepIconDone, active && styles.stepIconActive]}>
                    <Icon name={icon} size={20} color={completed || active ? '#FFF' : '#9CA3AF'} />
                </View>
                <View style={[styles.stepLine, completed && styles.stepLineDone]} />
            </View>
            <View style={styles.stepRight}>
                <Text style={[styles.stepTitle, active && styles.stepTitleActive]}>{title}</Text>
                <Text style={styles.stepDesc}>{desc}</Text>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFF" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Icon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Trip Management</Text>
                <View style={{ width: 40 }} />
            </View>

            {isTracking && (
                <View style={styles.trackingBanner}>
                    <View style={styles.pulse} />
                    <Text style={styles.trackingText}>LIVE GPS TRACKING ACTIVE - PORT 3030</Text>
                </View>
            )}

            <ScrollView contentContainerStyle={styles.body}>

                {/* ── Status Timeline ─────────────────────────── */}
                <View style={styles.timelineCard}>
                    <StatusStep
                        title="Scheduled"
                        desc={`Created on ${new Date(trip.created_at).toLocaleDateString()}`}
                        icon="calendar-check"
                        completed={trip.status !== 'scheduled'}
                        active={trip.status === 'scheduled'}
                    />
                    <StatusStep
                        title="En Route"
                        desc={`In transit from ${trip.origin || 'Yard'}`}
                        icon="truck-delivery"
                        completed={trip.status === 'completed'}
                        active={trip.status === 'en_route'}
                    />
                    <StatusStep
                        title="Delivered"
                        desc={`Arrival and unloading at ${trip.destination}`}
                        icon="check-circle"
                        completed={trip.status === 'completed'}
                        active={false}
                    />
                </View>

                {/* ── Shipment Cargo ──────────────────────────── */}
                <Text style={styles.sectionTitle}>CARGO & MANIFEST</Text>
                <View style={styles.cargoCard}>
                    <View style={styles.cargoHeader}>
                        <Icon name="package-variant-closed" size={20} color={APP_GREEN} />
                        <Text style={styles.cargoTitle}>{trip.linked_batch_ids.length} LOTS ATTACHED</Text>
                    </View>
                    {trip.linked_batch_ids.map((id: string) => (
                        <View key={id} style={styles.lotRow}>
                            <Text style={styles.lotId}>#{id}</Text>
                            <Icon name="information-outline" size={16} color="#9CA3AF" />
                        </View>
                    ))}
                </View>

                {/* ── Lifecycle Actions ─────────────────────────── */}
                <Text style={[styles.sectionTitle, { marginTop: 24 }]}>LIFECYCLE DATA</Text>

                {trip.status === 'scheduled' && (
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleAction('en_route')}>
                        <Icon name="play-circle" size={24} color="#FFF" />
                        <Text style={styles.actionBtnText}>START TRIP</Text>
                    </TouchableOpacity>
                )}

                {trip.status === 'en_route' && (
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: '#2563EB' }]}
                        onPress={() => navigation.navigate('DeliveryVerification', { trip })}
                    >
                        <Icon name="scale-balance" size={24} color="#FFF" />
                        <Text style={styles.actionBtnText}>PROCEED TO VERIFICATION</Text>
                    </TouchableOpacity>
                )}

                {trip.status === 'completed' && (
                    <View style={styles.completedBanner}>
                        <Icon name="check-decagram" size={56} color="#15803D" />
                        <Text style={styles.completedTitle}>Delivery Audit Complete</Text>

                        <View style={styles.auditCard}>
                            <View style={styles.auditRow}>
                                <Text style={styles.auditLabel}>Dispatch</Text>
                                <Text style={styles.auditVal}>{trip.dispatch_weight}kg</Text>
                            </View>
                            <View style={styles.auditRow}>
                                <Text style={styles.auditLabel}>Delivered</Text>
                                <Text style={styles.auditVal}>{trip.delivery_weight}kg</Text>
                            </View>
                            <View style={[styles.auditRow, { borderTopWidth: 1, borderColor: '#EEE', paddingTop: 8 }]}>
                                <Text style={styles.auditLabel}>Shortage</Text>
                                <Text style={[styles.auditVal, { color: trip.shortage_weight > 0 ? '#DC2626' : '#15803D' }]}>
                                    {trip.shortage_weight || 0}kg
                                </Text>
                            </View>
                        </View>
                    </View>
                )}

            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: '#FFF' },
    headerTitle: { fontSize: 18, fontWeight: '800' },

    body: { padding: 20 },

    trackingBanner: { backgroundColor: '#111827', paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
    trackingText: { color: '#22C55E', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
    pulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },

    timelineCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 24, marginBottom: 24, elevation: 2 },

    stepRow: { flexDirection: 'row', gap: 16 },
    stepLeft: { alignItems: 'center' },
    stepIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
    stepIconActive: { backgroundColor: '#2563EB' },
    stepIconDone: { backgroundColor: APP_GREEN },
    stepLine: { width: 2, height: 32, backgroundColor: '#F3F4F6', marginVertical: 4 },
    stepLineDone: { backgroundColor: APP_GREEN },

    stepRight: { flex: 1, paddingBottom: 24 },
    stepTitle: { fontSize: 16, fontWeight: '800', color: '#6B7280' },
    stepTitleActive: { color: '#111827' },
    stepDesc: { fontSize: 12, color: '#9CA3AF', marginTop: 2, fontWeight: '500' },

    sectionTitle: { fontSize: 11, fontWeight: '900', color: '#9CA3AF', letterSpacing: 1.2, marginBottom: 12 },
    cargoCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 16, gap: 12 },
    cargoHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
    cargoTitle: { fontSize: 12, fontWeight: '900', color: APP_GREEN },
    lotRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB', padding: 12, borderRadius: 12 },
    lotId: { fontSize: 14, fontWeight: '700', color: '#374151' },

    actionBtn: { backgroundColor: APP_GREEN, padding: 18, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 12 },
    actionBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },

    endFlow: { gap: 10 },
    label: { fontSize: 12, fontWeight: '800', color: '#6B7280', marginTop: 12 },
    input: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, fontSize: 16, fontWeight: '700', borderWidth: 1, borderColor: '#E5E7EB' },

    completedBanner: { alignItems: 'center', padding: 20, gap: 12 },
    completedTitle: { fontSize: 20, fontWeight: '900', color: '#15803D' },
    auditCard: { backgroundColor: '#FFF', width: '100%', borderRadius: 20, padding: 20, marginTop: 10, elevation: 2 },
    auditRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    auditLabel: { fontSize: 13, color: '#9CA3AF', fontWeight: '700' },
    auditVal: { fontSize: 15, fontWeight: '800', color: '#111827' }
});
