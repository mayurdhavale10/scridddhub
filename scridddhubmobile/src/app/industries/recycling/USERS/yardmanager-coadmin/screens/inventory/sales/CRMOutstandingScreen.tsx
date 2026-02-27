import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, RefreshControl, Alert, StatusBar
} from 'react-native';
import { getOutstandingReport } from '../../../../../../../../shared/inventory/api';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const TENANT = 'TENANT-001';

export default function CRMOutstandingScreen({ navigation }: any) {
    const [report, setReport] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const res = await getOutstandingReport(TENANT);
            if (res.success) setReport(res.data);
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally { setLoading(false); }
    };

    useEffect(() => {
        load();
        const unsub = navigation.addListener('focus', load);
        return unsub;
    }, [navigation]);

    const renderCustomer = ({ item }: any) => {
        const c = item.customer;
        const orders = item.orders;
        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{c.name[0]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.customerName}>{c.name}</Text>
                        <Text style={styles.customerPhone}>📞 {c.contact_phone}</Text>
                    </View>
                    <View style={styles.balanceBadge}>
                        <Text style={styles.balanceText}>₹{c.outstanding_balance.toLocaleString('en-IN')}</Text>
                        <Text style={styles.balanceLabel}>Outstanding</Text>
                    </View>
                </View>

                {orders.length > 0 && (
                    <View style={styles.orderList}>
                        {orders.map((o: any) => (
                            <TouchableOpacity
                                key={o.so_id}
                                style={styles.orderRow}
                                onPress={() => navigation.navigate('SalesOrderDetail', { orderId: o.so_id })}
                            >
                                <Text style={styles.orderId}>{o.so_id}</Text>
                                <View style={[styles.payBadge, o.payment_status === 'partial' && { backgroundColor: '#FEF3C7' }]}>
                                    <Text style={[styles.payBadgeText, o.payment_status === 'partial' && { color: '#92400E' }]}>
                                        {o.payment_status.toUpperCase()}
                                    </Text>
                                </View>
                                <Text style={styles.orderAmount}>₹{o.total_amount.toLocaleString('en-IN')}</Text>
                                <Icon name="chevron-right" size={14} color="#9CA3AF" />
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={styles.root}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Icon name="arrow-left" size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Outstanding Payments</Text>
                <View style={{ width: 24 }} />
            </View>

            {report && (
                <View style={styles.summaryBar}>
                    <Icon name="alert-circle" size={18} color="#B45309" />
                    <Text style={styles.summaryText}>
                        Total Outstanding:{' '}
                        <Text style={styles.summaryAmount}>
                            ₹{report.total_outstanding.toLocaleString('en-IN')}
                        </Text>
                    </Text>
                </View>
            )}

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color="#10B981" /></View>
            ) : (
                <FlatList
                    data={report?.customers || []}
                    keyExtractor={item => item.customer.customer_id}
                    renderItem={renderCustomer}
                    contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
                    refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={['#10B981']} />}
                    ListEmptyComponent={
                        <View style={styles.center}>
                            <Icon name="check-circle-outline" size={56} color="#10B981" />
                            <Text style={{ color: '#10B981', marginTop: 12, fontWeight: '700', fontSize: 16 }}>All Cleared!</Text>
                            <Text style={{ color: '#9CA3AF', marginTop: 4 }}>No outstanding payments</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F5F5F5' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingBottom: 14,
        paddingTop: (StatusBar.currentHeight ?? 24) + 10,
        backgroundColor: '#1B6B2F', elevation: 4,
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
    summaryBar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: '#FEF3C7', borderBottomWidth: 1, borderColor: '#FDE68A' },
    summaryText: { fontSize: 14, color: '#92400E' },
    summaryAmount: { fontWeight: '800' },

    card: { backgroundColor: '#FFF', borderRadius: 14, marginBottom: 14, overflow: 'hidden', elevation: 1 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
    avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 18, fontWeight: '700', color: '#10B981' },
    customerName: { fontSize: 15, fontWeight: '700', color: '#111' },
    customerPhone: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    balanceBadge: { backgroundColor: '#FEF2F2', borderRadius: 10, padding: 10, alignItems: 'center' },
    balanceText: { fontSize: 14, fontWeight: '800', color: '#DC2626' },
    balanceLabel: { fontSize: 10, color: '#EF4444', marginTop: 2 },

    orderList: { borderTopWidth: 1, borderColor: '#F3F4F6' },
    orderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderColor: '#F3F4F6' },
    orderId: { flex: 1, fontSize: 13, color: '#374151', fontWeight: '600' },
    payBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
    payBadgeText: { fontSize: 10, color: '#DC2626', fontWeight: '700' },
    orderAmount: { fontSize: 13, color: '#111', fontWeight: '700' },
});
