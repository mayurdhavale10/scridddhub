import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    StatusBar, TextInput, ActivityIndicator, Alert,
    KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { getFleet, createTrip } from '../../../../../../../shared/logistics/api';
import { getStockLots } from '../../../../../../../shared/inventory/api';

const APP_GREEN = '#1B6B2F';
const TENANT = 'TENANT-001';

const RECENT_LOCATIONS = [
    'Mundra Port, Gujarat',
    'Nhava Sheva, Mumbai',
    'Warehouse Zone 7, Delhi',
    'Chennai Terminal 2'
];

export const CreateTripScreen = ({ navigation }: any) => {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Consolidated Data State
    const [data, setData] = useState<{ fleet: { vehicles: any[], drivers: any[] }, stocks: any[] }>({
        fleet: { vehicles: [], drivers: [] },
        stocks: []
    });

    // Consolidated Form State
    const [form, setForm] = useState({
        selectedVehicle: null as any,
        selectedDriver: null as any,
        selectedLots: [] as string[],
        origin: '',
        destination: '',
        stops: [] as string[]
    });

    // Consolidated Estimate State
    const [estimates, setEstimates] = useState({
        distance: 0,
        fuel: 0,
        driverCharge: 500,
        tollExpected: 0
    });

    useEffect(() => {
        loadData();
    }, []);

    // Logistics Calculator
    useEffect(() => {
        if (form.destination && form.origin) {
            const numPoints = form.stops.length + 2;
            const dist = Math.floor(Math.random() * 50) + (numPoints * 40);

            setEstimates({
                distance: dist,
                fuel: Math.ceil(dist / 5),
                driverCharge: 500 + (dist * 2) + (form.stops.length * 100),
                tollExpected: form.stops.length > 0 ? 300 : 0
            });
        } else {
            setEstimates({ distance: 0, fuel: 0, driverCharge: 0, tollExpected: 0 });
        }
    }, [form.destination, form.origin, form.stops]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [fleetRes, stockRes] = await Promise.all([
                getFleet(TENANT),
                getStockLots(TENANT)
            ]);
            setData({
                fleet: fleetRes.data,
                stocks: stockRes.data || []
            });
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const addStop = () => {
        setForm({ ...form, stops: [...form.stops, ''] });
    };

    const updateStop = (val: string, index: number) => {
        const newStops = [...form.stops];
        newStops[index] = val;
        setForm({ ...form, stops: newStops });
    };

    const removeStop = (index: number) => {
        setForm({ ...form, stops: form.stops.filter((_, i) => i !== index) });
    };

    const toggleLot = (lotId: string) => {
        const newLots = form.selectedLots.includes(lotId)
            ? form.selectedLots.filter(id => id !== lotId)
            : [...form.selectedLots, lotId];
        setForm({ ...form, selectedLots: newLots });
    };

    const handleCreate = async () => {
        const { selectedVehicle, selectedDriver, destination, stops, selectedLots, origin } = form;
        if (!selectedVehicle || !selectedDriver || !origin || !destination || selectedLots.length === 0) {
            return Alert.alert("Required", "Please select vehicle, driver, start point, destination and at least one stock lot.");
        }

        try {
            setSubmitting(true);
            const totalWeight = data.stocks
                .filter(s => selectedLots.includes(s.lot_id))
                .reduce((acc, curr) => acc + curr.available_weight, 0);

            await createTrip(TENANT, {
                vehicle_id: selectedVehicle.vehicle_id,
                driver_id: selectedDriver.driver_id,
                origin,
                destination,
                stops: stops.filter(s => s.trim() !== ''),
                linked_batch_ids: selectedLots,
                dispatch_weight: totalWeight,
                estimated_distance: estimates.distance,
                estimated_fuel_qty: estimates.fuel,
                driver_charge: estimates.driverCharge,
                toll_expected: estimates.tollExpected
            });
            Alert.alert("Success", "Trip scheduled successfully");
            navigation.goBack();
        } catch (e) {
            Alert.alert("Error", "Failed to schedule trip");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loader}>
                <ActivityIndicator color={APP_GREEN} size="large" />
                <Text style={styles.loadingText}>Initializing Fleet Systems...</Text>
            </View>
        );
    }

    const currentTotalWeight = data.stocks
        .filter(s => form.selectedLots.includes(s.lot_id))
        .reduce((acc, curr) => acc + curr.available_weight, 0);

    return (
        <SafeAreaView style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFF" />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Icon name="close" size={24} color="#111827" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Schedule Shipment</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView contentContainerStyle={styles.body}>

                    {/* ── Simulated Map Interface ────────────────── */}
                    <View style={styles.mapContainer}>
                        <View style={styles.mapMock}>
                            <View style={styles.mapGraphics}>
                                <View style={styles.routeLine} />
                                <View style={[styles.routeDot, { top: '30%', left: '25%' }]} />
                                <View style={[styles.routeDot, { bottom: '25%', right: '25%', backgroundColor: APP_GREEN }]} />
                            </View>

                            <View style={styles.mapOverlay}>
                                <View style={styles.mapHeaderRow}>
                                    <View>
                                        <Text style={styles.mapStatus}>GPS TRACKING ACTIVE</Text>
                                        <Text style={styles.mapDest}>{form.destination || 'Setting Destination...'}</Text>
                                    </View>
                                    <View style={styles.mapPin}>
                                        <Icon name="truck-delivery" size={20} color="#FFF" />
                                    </View>
                                </View>
                            </View>
                        </View>
                        <View style={styles.mapBadge}>
                            <Icon name="satellite-variant" size={14} color="#FFF" />
                            <Text style={styles.mapBadgeText}>SATELLITE SYNC</Text>
                        </View>
                    </View>

                    <Text style={[styles.sectionTitle, { marginTop: 24 }]}>1. ASSIGN VEHICLE</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                        {data.fleet.vehicles.filter(v => v.active).map(v => (
                            <TouchableOpacity
                                key={v.vehicle_id}
                                disabled={v.is_busy}
                                style={[
                                    styles.selectorCard,
                                    form.selectedVehicle?.vehicle_id === v.vehicle_id && styles.selectorCardActive,
                                    v.is_busy && { opacity: 0.4 }
                                ]}
                                onPress={() => setForm({ ...form, selectedVehicle: v })}
                            >
                                <Icon name="truck-cargo-container" size={24} color={form.selectedVehicle?.vehicle_id === v.vehicle_id ? '#FFF' : APP_GREEN} />
                                <Text style={[styles.selectorLabel, form.selectedVehicle?.vehicle_id === v.vehicle_id && styles.selectorLabelActive]}>
                                    {v.vehicle_number}
                                    {v.is_busy ? '\n(ON ROAD)' : ''}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <Text style={[styles.sectionTitle, { marginTop: 24 }]}>2. ASSIGN DRIVER</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                        {data.fleet.drivers.map(d => (
                            <TouchableOpacity
                                key={d.driver_id}
                                style={[styles.selectorCard, form.selectedDriver?.driver_id === d.driver_id && styles.selectorCardActive]}
                                onPress={() => setForm({ ...form, selectedDriver: d })}
                            >
                                <View style={[styles.miniAvatar, form.selectedDriver?.driver_id === d.driver_id && { backgroundColor: '#FFF' }]}>
                                    <Text style={[styles.miniAvatarText, form.selectedDriver?.driver_id === d.driver_id && { color: APP_GREEN }]}>{d.name.charAt(0)}</Text>
                                </View>
                                <Text style={[styles.selectorLabel, form.selectedDriver?.driver_id === d.driver_id && styles.selectorLabelActive]}>{d.name.split(' ')[0]}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 32, marginBottom: 16 }}>
                        <Text style={styles.sectionTitle}>3. ROUTE DETAILS & STOPS</Text>
                        <TouchableOpacity onPress={addStop} style={styles.addStopBtn}>
                            <Icon name="plus-circle" size={16} color={APP_GREEN} />
                            <Text style={styles.addStopText}>Add Stop</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.routeTimeline}>
                        <View style={styles.routeItem}>
                            <View style={styles.timelineSidebar}>
                                <View style={styles.dot} />
                                <View style={styles.line} />
                            </View>
                            <View style={styles.routeInputBox}>
                                <Icon name="office-building-marker" size={18} color="#9CA3AF" />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Starting Point (e.g. Factory A)"
                                    value={form.origin}
                                    onChangeText={(t) => setForm({ ...form, origin: t })}
                                />
                            </View>
                        </View>

                        {form.stops.map((stop, idx) => (
                            <View key={idx} style={styles.routeItem}>
                                <View style={styles.timelineSidebar}>
                                    <View style={[styles.dot, { backgroundColor: '#F59E0B' }]} />
                                    <View style={styles.line} />
                                </View>
                                <View style={[styles.routeInputBox, { borderColor: '#FDE68A', borderWidth: 1 }]}>
                                    <TextInput
                                        style={styles.input}
                                        placeholder={`Stop ${idx + 1}`}
                                        value={stop}
                                        onChangeText={(t) => updateStop(t, idx)}
                                    />
                                    <TouchableOpacity onPress={() => removeStop(idx)}>
                                        <Icon name="close-circle" size={20} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}

                        <View style={styles.routeItem}>
                            <View style={styles.timelineSidebar}>
                                <View style={[styles.dot, { backgroundColor: APP_GREEN }]} />
                            </View>
                            <View style={[styles.routeInputBox, { backgroundColor: '#F0FDF4' }]}>
                                <Icon name="map-marker" size={18} color={APP_GREEN} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Final Destination"
                                    value={form.destination}
                                    onChangeText={(t) => setForm({ ...form, destination: t })}
                                />
                            </View>
                        </View>
                    </View>

                    {/* Quick Selection for Destination */}
                    <View style={styles.recentBox}>
                        <Text style={styles.recentTitle}>SUGGESTED DROP POINTS</Text>
                        <View style={styles.recentTags}>
                            {RECENT_LOCATIONS.map(loc => (
                                <TouchableOpacity
                                    key={loc}
                                    style={styles.locTag}
                                    onPress={() => setForm({ ...form, destination: loc })}
                                >
                                    <Text style={styles.locTagText}>{loc}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {estimates.distance > 0 && (
                        <View style={styles.estimateCard}>
                            <View style={styles.estHeader}>
                                <Icon name="calculator" size={16} color="#4B5563" />
                                <Text style={styles.estTitle}>TRANSPORT ESTIMATE</Text>
                            </View>

                            <View style={styles.estGrid}>
                                <View style={styles.estItem}><Text style={styles.estLabel}>Distance</Text><Text style={styles.estValue}>{estimates.distance} km</Text></View>
                                <View style={styles.estItem}><Text style={styles.estLabel}>Fuel (Est.)</Text><Text style={styles.estValue}>{estimates.fuel} L</Text></View>
                                <View style={styles.estItem}><Text style={styles.estLabel}>Driver Fee</Text><Text style={styles.estValue}>₹{estimates.driverCharge.toFixed(0)}</Text></View>
                                <View style={styles.estItem}><Text style={styles.estLabel}>Tolls</Text><Text style={styles.estValue}>₹{estimates.tollExpected}</Text></View>
                            </View>

                            <View style={styles.totalCostRow}>
                                <Text style={styles.totalCostLabel}>Total Estimated Cost</Text>
                                <Text style={styles.totalCostValue}>₹{(estimates.fuel * 105 + estimates.driverCharge + estimates.tollExpected).toFixed(0)}</Text>
                            </View>
                        </View>
                    )}

                    <Text style={[styles.sectionTitle, { marginTop: 32 }]}>4. SELECT PAYLOAD (STOCK)</Text>
                    <View style={styles.stockList}>
                        {data.stocks.filter(s => s.available_weight > 0).map(s => (
                            <TouchableOpacity
                                key={s.lot_id}
                                style={[styles.stockCard, form.selectedLots.includes(s.lot_id) && styles.stockCardActive]}
                                onPress={() => toggleLot(s.lot_id)}
                            >
                                <View style={styles.stockInfo}>
                                    <Text style={styles.stockMat}>{s.material_id}</Text>
                                    <Text style={styles.stockBatch}>LOT: {s.lot_id}</Text>
                                </View>
                                <View style={styles.stockWeightBox}>
                                    <Text style={styles.stockWeight}>{s.available_weight}kg</Text>
                                    {form.selectedLots.includes(s.lot_id) && <Icon name="check-circle" size={20} color={APP_GREEN} />}
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    <View style={styles.summary}>
                        <Text style={styles.summaryTitle}>Payload Weight</Text>
                        <Text style={styles.summaryVal}>{currentTotalWeight} kg</Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.confirmBtn, (submitting || !form.destination || !form.origin) && { opacity: 0.6 }]}
                        onPress={handleCreate}
                        disabled={submitting || !form.destination || !form.origin}
                    >
                        {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmBtnText}>Schedule Trip</Text>}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#FFF' },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },
    loadingText: { marginTop: 16, color: '#6B7280', fontSize: 14, fontWeight: '600' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: '#FFF' },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6', borderRadius: 12 },
    headerTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
    body: { padding: 20 },
    sectionTitle: { fontSize: 11, fontWeight: '900', color: '#9CA3AF', letterSpacing: 1.2 },

    // Map Interface
    mapContainer: { height: 160, borderRadius: 24, overflow: 'hidden', backgroundColor: '#E5E7EB', marginBottom: 12 },
    mapMock: { flex: 1, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
    mapOverlay: { position: 'absolute', top: 20, left: 20, right: 20 },
    mapHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    mapStatus: { fontSize: 10, fontWeight: '900', color: '#3B82F6', letterSpacing: 1.5 },
    mapDest: { fontSize: 18, fontWeight: '900', color: '#1E3A8A', marginTop: 4 },
    mapPin: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8 },
    mapBadge: { position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(30, 58, 138, 0.8)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6 },
    mapBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
    mapGraphics: { position: 'absolute', width: '100%', height: '100%', opacity: 0.15 },
    routeLine: { position: 'absolute', top: '50%', left: '20%', right: '20%', height: 3, backgroundColor: '#2563EB', borderRadius: 2, transform: [{ rotate: '-10deg' }] },
    routeDot: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: '#2563EB', borderWidth: 3, borderColor: '#FFF' },

    horizontalScroll: { marginHorizontal: -20, paddingHorizontal: 20, marginTop: 12 },
    selectorCard: { backgroundColor: '#F3F4F6', padding: 16, borderRadius: 20, marginRight: 12, alignItems: 'center', minWidth: 110, gap: 8 },
    selectorCardActive: { backgroundColor: APP_GREEN },
    selectorLabel: { fontSize: 12, fontWeight: '800', color: '#374151', textAlign: 'center' },
    selectorLabelActive: { color: '#FFF' },
    miniAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: APP_GREEN, alignItems: 'center', justifyContent: 'center' },
    miniAvatarText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
    routeTimeline: { gap: 0 },
    routeItem: { flexDirection: 'row', alignItems: 'stretch' },
    timelineSidebar: { width: 30, alignItems: 'center' },
    dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#D1D5DB', marginTop: 22 },
    line: { width: 2, flex: 1, backgroundColor: '#E5E7EB' },
    routeInputBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 16, paddingHorizontal: 16, marginBottom: 12, gap: 10, height: 56 },
    input: { flex: 1, fontSize: 14, fontWeight: '700', color: '#111827' },
    addStopBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F0FDF4', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    addStopText: { fontSize: 11, fontWeight: '800', color: APP_GREEN },

    // Recent Suggestion Tags
    recentBox: { marginTop: 8, marginBottom: 12 },
    recentTitle: { fontSize: 9, fontWeight: '900', color: '#9CA3AF', marginBottom: 8, letterSpacing: 0.5 },
    recentTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    locTag: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9' },
    locTagText: { fontSize: 12, fontWeight: '700', color: '#64748B' },

    estimateCard: { backgroundColor: '#F8FAFC', borderRadius: 24, padding: 20, marginTop: 12, borderWidth: 1, borderColor: '#E2E8F0' },
    estHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
    estTitle: { fontSize: 11, fontWeight: '900', color: '#64748B', letterSpacing: 1 },
    estGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    estItem: { width: '47%', padding: 14, backgroundColor: '#FFF', borderRadius: 16, borderWeight: 1, borderColor: '#F1F5F9' },
    estLabel: { fontSize: 10, fontWeight: '700', color: '#94A3B8', marginBottom: 4 },
    estValue: { fontSize: 16, fontWeight: '900', color: '#0F172A' },
    totalCostRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
    totalCostLabel: { fontSize: 14, fontWeight: '800', color: '#475569' },
    totalCostValue: { fontSize: 20, fontWeight: '900', color: APP_GREEN },
    stockList: { gap: 10, marginTop: 16 },
    stockCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 16, backgroundColor: '#FFF', borderWidth: 1.5, borderColor: '#F3F4F6' },
    stockCardActive: { borderColor: APP_GREEN, backgroundColor: '#F0FDF4' },
    stockInfo: { gap: 2 },
    stockMat: { fontSize: 15, fontWeight: '800', color: '#111827' },
    stockBatch: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
    stockWeightBox: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    stockWeight: { fontSize: 15, fontWeight: '800', color: APP_GREEN },
    footer: { padding: 20, borderTopWidth: 1, borderTopColor: '#F3F4F6', flexDirection: 'row', alignItems: 'center', gap: 20, backgroundColor: '#FFF' },
    summary: { flex: 1 },
    summaryTitle: { fontSize: 12, color: '#9CA3AF', fontWeight: '700' },
    summaryVal: { fontSize: 20, fontWeight: '900', color: '#111827' },
    confirmBtn: { backgroundColor: APP_GREEN, paddingVertical: 18, paddingHorizontal: 32, borderRadius: 16, flex: 1, alignItems: 'center' },
    confirmBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' }
});
