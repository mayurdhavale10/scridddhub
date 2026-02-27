import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    StatusBar, ActivityIndicator, Alert, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { getTrips } from '../../../../../../../shared/logistics/api';

const APP_GREEN = '#1B6B2F';
const TENANT = 'TENANT-001';

export const MyTripsScreen = ({ navigation }: any) => {
    const [trips, setTrips] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadMyTrips();
    }, []);

    const loadMyTrips = async () => {
        try {
            setLoading(true);
            const res = await getTrips(TENANT);
            // In a real app, we would filter by Driver ID. For demo, we show en_route trips.
            const myTrips = res.data.filter((t: any) => t.status === 'en_route' || t.status === 'scheduled');
            setTrips(myTrips);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const TripCard = ({ item }: any) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('TripDetail', { trip: item })}
        >
            <View style={styles.cardHeader}>
                <View style={[styles.statusBadge, { backgroundColor: item.status === 'en_route' ? '#DBEAFE' : '#F3F4F6' }]}>
                    <Text style={[styles.statusText, { color: item.status === 'en_route' ? '#2563EB' : '#6B7280' }]}>
                        {item.status === 'en_route' ? 'ON ROAD' : 'NEXT ASSIGNMENT'}
                    </Text>
                </View>
                <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
            </View>

            <View style={styles.routeContainer}>
                <View style={styles.routePoint}>
                    <Icon name="map-marker-outline" size={20} color={APP_GREEN} />
                    <Text style={styles.locName}>{item.origin}</Text>
                </View>
                <View style={styles.routeLine} />
                <View style={styles.routePoint}>
                    <Icon name="map-marker-check" size={20} color="#DC2626" />
                    <Text style={styles.locName}>{item.destination}</Text>
                </View>
            </View>

            <View style={styles.cargoInfo}>
                <Icon name="package-variant-closed" size={16} color="#6B7280" />
                <Text style={styles.cargoText}>{item.linked_batch_ids.length} Clusters / {item.dispatch_weight}kg</Text>
            </View>

            {item.status === 'scheduled' && (
                <TouchableOpacity
                    style={styles.startBtn}
                    onPress={() => navigation.navigate('TripDetail', { trip: item })}
                >
                    <Text style={styles.startBtnText}>START TRIP</Text>
                    <Icon name="chevron-right" size={20} color="#FFF" />
                </TouchableOpacity>
            )}
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Icon name="close" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Assignments</Text>
                <TouchableOpacity onPress={loadMyTrips}>
                    <Icon name="sync" size={24} color={APP_GREEN} />
                </TouchableOpacity>
            </View>

            {loading && !refreshing ? (
                <View style={styles.loader}>
                    <ActivityIndicator color={APP_GREEN} size="large" />
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.container}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadMyTrips(); }} />}
                >
                    {trips.length === 0 ? (
                        <View style={styles.empty}>
                            <Icon name="calendar-blank" size={64} color="#D1D5DB" />
                            <Text style={styles.emptyText}>No assignments scheduled for today.</Text>
                        </View>
                    ) : (
                        trips.map(t => <TripCard key={t.trip_id} item={t} />)
                    )}
                </ScrollView>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: '#FFF' },
    headerTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    container: { padding: 20 },

    card: { backgroundColor: '#FFF', borderRadius: 24, padding: 20, marginBottom: 16, elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    statusText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
    date: { fontSize: 12, color: '#9CA3AF', fontWeight: '600' },

    routeContainer: { marginBottom: 20 },
    routePoint: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    locName: { fontSize: 15, fontWeight: '700', color: '#111827' },
    routeLine: { width: 2, height: 20, backgroundColor: '#E5E7EB', marginLeft: 9, marginVertical: 2 },

    cargoInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    cargoText: { fontSize: 13, color: '#6B7280', fontWeight: '600' },

    startBtn: { backgroundColor: APP_GREEN, paddingVertical: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20 },
    startBtnText: { color: '#FFF', fontSize: 14, fontWeight: '900' },

    empty: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: '#9CA3AF', fontSize: 14, fontWeight: '600', marginTop: 12 }
});
