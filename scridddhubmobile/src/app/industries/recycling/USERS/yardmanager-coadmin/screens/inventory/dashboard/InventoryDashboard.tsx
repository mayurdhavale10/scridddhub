import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getWeighEntries } from '../../../../../../../../shared/inventory/api';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// Helper to format currency/numbers
const formatNumber = (num: number) => num.toLocaleString();

export const InventoryDashboard = ({ navigation }: any) => {
    const [loading, setLoading] = useState(true);
    const [weighEntries, setWeighEntries] = useState<any[]>([]);

    // Derived KPIs
    const [totalWeight, setTotalWeight] = useState(0);
    const [entriesToday, setEntriesToday] = useState(0);
    const [recentActivity, setRecentActivity] = useState<any[]>([]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Fetch live data from our new backend API
            const res = await getWeighEntries("TENANT-001");
            if (res.success) {
                const entries = res.data || [];
                setWeighEntries(entries);

                // Calculate KPIs
                let weight = 0;
                let todayCount = 0;
                const today = new Date().toISOString().split('T')[0];

                entries.forEach((e: any) => {
                    const net = (e.grossWeight || 0) - (e.tareWeight || 0);
                    weight += net;

                    if (e.createdAt && e.createdAt.startsWith(today)) {
                        todayCount++;
                    }
                });

                setTotalWeight(weight);
                setEntriesToday(todayCount);
                setRecentActivity(entries.slice(0, 5)); // Top 5 recent
            }
        } catch (error) {
            console.error("Failed to load inventory data", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="dark-content" backgroundColor="#F3F4F6" />

            {/* Top Navigation Bar */}
            <View style={styles.topBar}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Icon name="arrow-left" size={24} color="#374151" />
                    <Text style={styles.backButtonText}>Dashboard</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Inventory Overview</Text>
            </View>

            <ScrollView
                style={styles.container}
                contentContainerStyle={{ paddingBottom: 40 }}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} tintColor="#1D7A27" />}
            >
                {/* Header Subtitle */}
                <View style={styles.header}>
                    <Text style={styles.headerSubtitle}>Live Weighbridge Data</Text>
                </View>

                {/* KPI Grid */}
                <View style={styles.kpiContainer}>
                    <View style={styles.kpiCard}>
                        <Text style={styles.kpiLabel}>Total Weight (Kg)</Text>
                        <Text style={styles.kpiValue}>{formatNumber(totalWeight)}</Text>
                    </View>
                    <View style={styles.kpiCard}>
                        <Text style={styles.kpiLabel}>Trucks Today</Text>
                        <Text style={styles.kpiValue}>{entriesToday}</Text>
                    </View>
                    <View style={styles.kpiCard}>
                        <Text style={styles.kpiLabel}>Total Entries</Text>
                        <Text style={styles.kpiValue}>{weighEntries.length}</Text>
                    </View>
                </View>

                {/* Quick Actions */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Actions</Text>
                </View>
                <View style={styles.actionRow}>
                    {/* Pointing to YardManagerFieldsScreen as a shortcut, or listing generic actions */}
                    <TouchableOpacity
                        style={[styles.actionButton, styles.primaryBtn]}
                        onPress={() => navigation.navigate('YardManagerFieldsScreen')}
                    >
                        <Text style={styles.actionText}>Manage Fields</Text>
                        <Text style={styles.actionSub}>Configure Templates</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionButton, styles.secondaryBtn]}
                        onPress={() => navigation.navigate('InventoryList')}
                    >
                        <Text style={[styles.actionText, { color: '#1D7A27' }]}>View All Stock</Text>
                        <Text style={styles.actionSub}>Full List</Text>
                    </TouchableOpacity>
                </View>

                {/* Recent Activity Section */}
                {recentActivity.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Recent Weigh-ins</Text>
                        {recentActivity.map((entry: any, i: number) => (
                            <View key={i} style={styles.listRow}>
                                <View>
                                    <Text style={styles.itemTitle}>{entry.materialId || 'Unknown Material'}</Text>
                                    <Text style={styles.itemSub}>Ticket #{entry.id?.substring(0, 8)}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={styles.itemValue}>
                                        {formatNumber((entry.grossWeight || 0) - (entry.tareWeight || 0))} kg
                                    </Text>
                                    <Text style={styles.itemDate}>
                                        {entry.createdAt ? new Date(entry.createdAt).toLocaleTimeString() : ''}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* Empty State */}
                {!loading && recentActivity.length === 0 && (
                    <View style={{ padding: 40, alignItems: 'center' }}>
                        <Text style={{ color: '#999' }}>No inventory data found.</Text>
                        <Text style={{ color: '#999', fontSize: 12 }}>Operators need to submit weigh entries first.</Text>
                    </View>
                )}

            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#F3F4F6' },
    container: { flex: 1, backgroundColor: '#F3F4F6' },
    loadingContainer: { flex: 1, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },

    topBar: { paddingHorizontal: 15, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#E5E7EB' },
    backButton: { marginRight: 15, flexDirection: 'row', alignItems: 'center' },
    backButtonText: { color: '#374151', fontSize: 16, fontWeight: '600', marginLeft: 4 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },

    header: { padding: 20, paddingTop: 10 },
    headerSubtitle: { fontSize: 14, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1, fontWeight: '600' },

    kpiContainer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 15, marginBottom: 20 },
    kpiCard: { flex: 1, backgroundColor: '#FFF', padding: 15, borderRadius: 12, marginHorizontal: 5, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
    kpiLabel: { color: '#6B7280', fontSize: 12, marginBottom: 5, fontWeight: '600' },
    kpiValue: { color: '#111827', fontSize: 20, fontWeight: '800' },

    sectionHeader: { paddingHorizontal: 20, marginBottom: 10 },
    sectionTitle: { color: '#374151', fontSize: 16, fontWeight: '700' },

    actionRow: { flexDirection: 'row', paddingHorizontal: 15, marginBottom: 25 },
    actionButton: { flex: 1, padding: 15, borderRadius: 12, marginHorizontal: 5, elevation: 1 },
    primaryBtn: { backgroundColor: '#1D7A27' },
    secondaryBtn: { backgroundColor: '#DCFCE7', borderWidth: 1, borderColor: '#86EFAC' },
    actionText: { color: '#FFF', fontWeight: 'bold', fontSize: 14, marginBottom: 2 },
    actionSub: { color: 'rgba(0,0,0,0.6)', fontSize: 11 },

    section: { paddingHorizontal: 15 },
    listRow: { backgroundColor: '#FFF', padding: 15, borderRadius: 12, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 1 },
    itemTitle: { color: '#111827', fontWeight: 'bold', fontSize: 15, marginBottom: 2 },
    itemSub: { color: '#9CA3AF', fontSize: 12 },
    itemValue: { color: '#1D7A27', fontWeight: '700', fontSize: 16 },
    itemDate: { color: '#9CA3AF', fontSize: 11, marginTop: 2 },
});
