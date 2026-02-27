import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    StatusBar, ActivityIndicator, Alert, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { getTrips } from '../../../../../../../shared/logistics/api';
import { useIsFocused } from '@react-navigation/native';

const APP_GREEN = '#1B6B2F';
const TENANT = 'TENANT-001';

export const TripsScreen = ({ navigation }: any) => {
    const isFocused = useIsFocused();
    const [trips, setTrips] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        if (isFocused) loadTrips();
    }, [isFocused]);

    const loadTrips = async () => {
        try {
            setLoading(true);
            const res = await getTrips(TENANT);
            setTrips(res.data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'en_route': return { bg: '#DBEAFE', text: '#2563EB', icon: 'truck-fast', label: 'EN ROUTE' };
            case 'completed': return { bg: '#DCFCE7', text: '#15803D', icon: 'check-circle', label: 'COMPLETED' };
            case 'scheduled': return { bg: '#F3F4F6', text: '#6B7280', icon: 'clock-outline', label: 'SCHEDULED' };
            default: return { bg: '#F3F4F6', text: '#6B7280', icon: 'clock-outline', label: 'PENDING' };
        }
    };

    const TripCard = ({ item }: any) => {
        const style = getStatusStyle(item.status);
        return (
            <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate('TripDetail', { trip: item })}
            >
                <View style={styles.cardHeader}>
                    <View style={[styles.statusBadge, { backgroundColor: style.bg }]}>
                        <Icon name={style.icon} size={14} color={style.text} />
                        <Text style={[styles.statusText, { color: style.text }]}>{style.label}</Text>
                    </View>
                    <Text style={styles.timestamp}>{new Date(item.created_at).toLocaleDateString('en-IN')}</Text>
                </View>

                <View style={styles.routeRow}>
                    <View style={styles.dotColumn}>
                        <View style={[styles.dot, { backgroundColor: APP_GREEN }]} />
                        <View style={styles.line} />
                        <Icon name="map-marker" size={16} color="#DC2626" />
                    </View>
                    <View style={styles.locationColumn}>
                        <Text style={styles.locText}>{item.origin || 'Origin'}</Text>
                        <Text style={[styles.locText, { marginTop: 24 }]}>{item.destination}</Text>
                    </View>
                </View>

                <View style={styles.footer}>
                    <View style={styles.meta}>
                        <Icon name="package-variant-closed" size={16} color="#6B7280" />
                        <Text style={styles.metaText}>{item.linked_batch_ids?.length || 0} Lots</Text>
                    </View>
                    <View style={styles.meta}>
                        <Icon name="truck-outline" size={16} color="#6B7280" />
                        <Text style={styles.metaText}>Fleet ID: {item.vehicle_id.slice(-4).toUpperCase()}</Text>
                    </View>
                    {item.status === 'completed' && item.shortage_weight > 0 && (
                        <View style={[styles.meta, { marginLeft: 'auto' }]}>
                            <Icon name="alert-circle" size={16} color="#DC2626" />
                            <Text style={[styles.metaText, { color: '#DC2626' }]}>{item.shortage_weight}kg Loss</Text>
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Icon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Live Trips</Text>
                <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('CreateTrip')}>
                    <Icon name="plus" size={22} color="#FFF" />
                </TouchableOpacity>
            </View>

            {loading && !refreshing ? (
                <View style={styles.loader}>
                    <ActivityIndicator color={APP_GREEN} size="large" />
                </View>
            ) : (
                <FlatList
                    data={trips}
                    keyExtractor={item => item.trip_id}
                    renderItem={({ item }) => <TripCard item={item} />}
                    contentContainerStyle={styles.list}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadTrips(); }} />}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Icon name="map-marker-path" size={48} color="#D1D5DB" />
                            <Text style={styles.emptyText}>No active trips found.</Text>
                            <TouchableOpacity style={styles.emptyAddBtn} onPress={() => navigation.navigate('CreateTrip')}>
                                <Text style={styles.emptyAddText}>Schedule Your First Shipment</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
    headerTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
    addBtn: { backgroundColor: APP_GREEN, width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    list: { padding: 20 },
    card: { backgroundColor: '#FFF', borderRadius: 24, padding: 20, marginBottom: 16, elevation: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, borderWidth: 1, borderColor: '#F3F4F6' },

    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, gap: 6 },
    statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
    timestamp: { fontSize: 12, color: '#9CA3AF', fontWeight: '600' },

    routeRow: { flexDirection: 'row', gap: 16, marginBottom: 20 },
    dotColumn: { alignItems: 'center', width: 20 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    line: { width: 2, flex: 1, backgroundColor: '#E5E7EB', marginVertical: 4 },
    locationColumn: { flex: 1 },
    locText: { fontSize: 15, fontWeight: '700', color: '#374151', letterSpacing: -0.2 },

    footer: { flexDirection: 'row', borderTopWidth: 1, borderColor: '#F3F4F6', paddingTop: 16, gap: 24 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    metaText: { fontSize: 13, color: '#6B7280', fontWeight: '600' },

    empty: { alignItems: 'center', marginTop: 100, padding: 40 },
    emptyText: { color: '#9CA3AF', marginTop: 12, fontSize: 15, fontWeight: '600', textAlign: 'center' },
    emptyAddBtn: { marginTop: 24, backgroundColor: '#F3F4F6', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
    emptyAddText: { color: APP_GREEN, fontWeight: '800', fontSize: 14 }
});
