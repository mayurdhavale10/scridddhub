import React, { useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    StatusBar, TextInput, ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { updateTripStatus } from '../../../../../../../shared/logistics/api';

const APP_GREEN = '#1B6B2F';
const RED = '#DC2626';
const TENANT = 'TENANT-001';

export const DeliveryVerificationScreen = ({ navigation, route }: any) => {
    const { trip } = route.params;
    const [delWeight, setDelWeight] = useState(trip.dispatch_weight?.toString() || '');
    const [odoEnd, setOdoEnd] = useState('');
    const [fuel, setFuel] = useState('');
    const [hasProof, setHasProof] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const dispatchWeight = trip.dispatch_weight || 0;
    const currentDelWeight = parseFloat(delWeight) || 0;
    const shortage = dispatchWeight - currentDelWeight;
    const isShortage = shortage > 0;

    const handleComplete = async () => {
        if (!delWeight || !odoEnd) {
            return Alert.alert("Required", "Please enter destination weight and final odometer reading.");
        }

        try {
            setSubmitting(true);
            await updateTripStatus(TENANT, trip.trip_id, 'completed', {
                delivery_weight: currentDelWeight,
                odometer_end: parseFloat(odoEnd),
                fuel_cost: parseFloat(fuel) || 0
            });
            Alert.alert("Trip Verified", shortage > 0 ? `Completed with ${shortage}kg shortage.` : "Completed successfully.");
            navigation.navigate('Trips');
        } catch (e) {
            Alert.alert("Error", "Failed to update trip");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFF" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Icon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Verify Delivery</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.body}>
                <View style={[styles.alertBox, isShortage ? styles.shortageBox : styles.safeBox]}>
                    <Icon name={isShortage ? "alert-circle" : "check-decagram"} size={24} color={isShortage ? RED : APP_GREEN} />
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.alertTitle, { color: isShortage ? RED : APP_GREEN }]}>
                            {isShortage ? 'Shortage Detected' : 'Weight Verified'}
                        </Text>
                        <Text style={styles.alertSub}>
                            {isShortage
                                ? `Destination weight is ${shortage}kg less than dispatch.`
                                : 'Cargo weight matches dispatch records.'}
                        </Text>
                    </View>
                </View>

                <View style={styles.statGrid}>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Dispatch Weight</Text>
                        <Text style={styles.statVal}>{dispatchWeight} kg</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Shortage</Text>
                        <Text style={[styles.statVal, { color: isShortage ? RED : APP_GREEN }]}>
                            {isShortage ? `-${shortage} kg` : '0 kg'}
                        </Text>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>INPUT DESTINATION WEIGHT</Text>
                <View style={styles.inputBox}>
                    <Icon name="scale-balance" size={20} color={APP_GREEN} />
                    <TextInput
                        style={styles.input}
                        placeholder="Weight at destination (kg)"
                        keyboardType="numeric"
                        value={delWeight}
                        onChangeText={setDelWeight}
                    />
                </View>

                <Text style={[styles.sectionTitle, { marginTop: 24 }]}>END TRIP DETAILS</Text>
                <View style={styles.inputBox}>
                    <Icon name="counter" size={20} color="#6B7280" />
                    <TextInput
                        style={styles.input}
                        placeholder="Final Odometer (km)"
                        keyboardType="numeric"
                        value={odoEnd}
                        onChangeText={setOdoEnd}
                    />
                </View>

                <View style={[styles.inputBox, { marginTop: 12 }]}>
                    <Icon name="gas-station" size={20} color="#6B7280" />
                    <TextInput
                        style={styles.input}
                        placeholder="Total Fuel Cost (₹)"
                        keyboardType="numeric"
                        value={fuel}
                        onChangeText={setFuel}
                    />
                </View>

                <Text style={[styles.sectionTitle, { marginTop: 24 }]}>PROOF OF DELIVERY</Text>
                <TouchableOpacity
                    style={[styles.proofBtn, hasProof && styles.proofBtnActive]}
                    onPress={() => {
                        Alert.alert("Camera", "Simulating Camera Capture...");
                        setHasProof(true);
                    }}
                >
                    <Icon name={hasProof ? "file-check" : "camera-plus"} size={24} color={hasProof ? APP_GREEN : '#6B7280'} />
                    <Text style={[styles.proofText, hasProof && { color: APP_GREEN }]}>
                        {hasProof ? "Weigh-Slip Captured" : "Attach Destination Weigh-Slip"}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.confirmBtn, (submitting || (isShortage && !hasProof)) && { opacity: 0.7 }]}
                    onPress={handleComplete}
                    disabled={submitting || (isShortage && !hasProof)}
                >
                    {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmBtnText}>Finalize & Close Trip</Text>}
                </TouchableOpacity>
                {isShortage && !hasProof && (
                    <Text style={styles.warningText}>* Photo proof required for weight shortages</Text>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#FFF' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
    body: { padding: 20 },

    alertBox: { flexDirection: 'row', gap: 15, padding: 20, borderRadius: 20, marginBottom: 24, borderWidth: 1 },
    shortageBox: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
    safeBox: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
    alertTitle: { fontSize: 16, fontWeight: '800' },
    alertSub: { fontSize: 13, color: '#4B5563', marginTop: 2, fontWeight: '600' },

    statGrid: { flexDirection: 'row', gap: 12, marginBottom: 32 },
    statCard: { flex: 1, backgroundColor: '#F9FAFB', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#F3F4F6' },
    statLabel: { fontSize: 11, fontWeight: '800', color: '#9CA3AF', marginBottom: 4 },
    statVal: { fontSize: 18, fontWeight: '900', color: '#111827' },

    sectionTitle: { fontSize: 11, fontWeight: '900', color: '#9CA3AF', letterSpacing: 1.2, marginBottom: 12 },
    inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 16, paddingHorizontal: 16, gap: 12, borderWidth: 1, borderColor: '#F3F4F6' },
    input: { flex: 1, paddingVertical: 16, fontSize: 15, fontWeight: '600', color: '#111827' },

    proofBtn: { borderStyle: 'dashed', borderWidth: 2, borderColor: '#D1D5DB', borderRadius: 16, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 4 },
    proofBtnActive: { borderColor: APP_GREEN, backgroundColor: '#F0FDF4' },
    proofText: { fontSize: 14, fontWeight: '700', color: '#6B7280' },

    confirmBtn: { backgroundColor: APP_GREEN, paddingVertical: 18, borderRadius: 16, marginTop: 32, alignItems: 'center', elevation: 4, shadowColor: APP_GREEN, shadowOpacity: 0.2, shadowRadius: 10 },
    confirmBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
    warningText: { color: RED, fontSize: 11, fontWeight: '800', textAlign: 'center', marginTop: 12, textTransform: 'uppercase' }
});
