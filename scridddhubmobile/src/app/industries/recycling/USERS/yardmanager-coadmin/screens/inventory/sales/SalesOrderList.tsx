import React, { useEffect, useState, useMemo } from 'react';
import {
    View, Text, FlatList, StyleSheet, TouchableOpacity,
    RefreshControl, ActivityIndicator, Animated, StatusBar
} from 'react-native';
import { getSalesOrders } from '../../../../../../../../shared/inventory/api';
import { SalesOrder, SOStatus } from '../../../../../../../../shared/inventory/types';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const TENANT = 'TENANT-001';
const APP_GREEN = '#1B6B2F';
const APP_GREEN_LIGHT = '#E8F5E9';

const STATUS_TABS = [
    { label: 'All', value: null },
    { label: 'Draft', value: SOStatus.Draft },
    { label: 'Confirmed', value: SOStatus.Confirmed },
    { label: 'Dispatched', value: SOStatus.Dispatched },
];

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
    [SOStatus.Draft]: { color: '#D97706', bg: '#FEF3C7', icon: 'pencil-outline' },
    [SOStatus.Confirmed]: { color: '#2563EB', bg: '#EFF6FF', icon: 'check-circle-outline' },
    [SOStatus.Dispatched]: { color: '#059669', bg: '#ECFDF5', icon: 'truck-delivery' },
};

const PAYMENT_CONFIG: Record<string, { color: string; label: string }> = {
    unpaid: { color: '#EF4444', label: 'Unpaid' },
    partial: { color: '#F59E0B', label: 'Partial' },
    paid: { color: '#10B981', label: 'Paid' },
};

export default function SalesOrderList({ navigation }: any) {
    const [orders, setOrders] = useState<SalesOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<SOStatus | null>(null);
    const fadeAnim = React.useRef(new Animated.Value(0)).current;

    const load = async () => {
        setLoading(true);
        try {
            const res = await getSalesOrders(TENANT);
            if (res.success) {
                const sorted = (res.data || []).sort((a: SalesOrder, b: SalesOrder) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                );
                setOrders(sorted);
                Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        load();
        const unsub = navigation.addListener('focus', load);
        return unsub;
    }, [navigation]);

    const filtered = useMemo(() =>
        activeTab ? orders.filter(o => o.status === activeTab) : orders,
        [orders, activeTab]
    );

    // ── Summary stats ────────────────────────────────────────────────
    const totalRevenue = orders
        .filter(o => o.status === SOStatus.Dispatched)
        .reduce((s, o) => s + (o.total_amount || 0), 0);

    const outstanding = orders.reduce((s, o) => {
        if (o.payment_status === 'unpaid' || o.payment_status === 'partial') {
            return s + ((o.total_amount || 0) - (o.amount_paid || 0));
        }
        return s;
    }, 0);

    const draftCount = orders.filter(o => o.status === SOStatus.Draft).length;

    const fmt = (n: number) =>
        '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

    // ── Order card ────────────────────────────────────────────────────
    const renderItem = ({ item }: { item: SalesOrder }) => {
        const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG[SOStatus.Draft];
        const pc = PAYMENT_CONFIG[item.payment_status || 'unpaid'];
        const unpaid = (item.total_amount || 0) - (item.amount_paid || 0);

        return (
            <TouchableOpacity
                style={styles.card}
                activeOpacity={0.82}
                onPress={() => navigation.navigate('SalesOrderDetail', { orderId: item.so_id })}
            >
                {/* Row 1: Customer + Amount */}
                <View style={styles.cardTop}>
                    <View style={styles.avatarWrap}>
                        <Text style={styles.avatarText}>
                            {(item.customer_name || '?')[0].toUpperCase()}
                        </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.customerName}>{item.customer_name}</Text>
                        <Text style={styles.soId}>{item.so_id} · {item.items.length} item{item.items.length !== 1 ? 's' : ''}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.amount}>{fmt(item.total_amount || 0)}</Text>
                        <Text style={styles.date}>
                            {new Date(item.so_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </Text>
                    </View>
                </View>

                {/* Row 2: Status + Payment */}
                <View style={styles.cardBottom}>
                    <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
                        <Icon name={sc.icon} size={12} color={sc.color} />
                        <Text style={[styles.statusText, { color: sc.color }]}>
                            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                        </Text>
                    </View>

                    <View style={[styles.payPill, { borderColor: pc.color + '44' }]}>
                        <View style={[styles.payDot, { backgroundColor: pc.color }]} />
                        <Text style={[styles.payText, { color: pc.color }]}>{pc.label}</Text>
                        {item.payment_status !== 'paid' && unpaid > 0 && (
                            <Text style={[styles.payAmt, { color: pc.color }]}> · {fmt(unpaid)}</Text>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.root}>
            {/* ── Header ─────────────────────────────────────────── */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Icon name="arrow-left" size={22} color="#FFF" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Sales Orders</Text>
                    <Text style={styles.headerSub}>{orders.length} total</Text>
                </View>
                <TouchableOpacity
                    style={styles.crmBtn}
                    onPress={() => navigation.navigate('CRMOutstanding')}
                >
                    <Icon name="account-group" size={18} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.crmBtn}
                    onPress={() => navigation.navigate('SalesConfig')}
                >
                    <Icon name="cog-outline" size={18} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => navigation.navigate('CreateSalesOrder')}
                >
                    <Icon name="plus" size={22} color={APP_GREEN} />
                </TouchableOpacity>
            </View>

            {/* ── Stats Bar ──────────────────────────────────────── */}
            <View style={styles.statsBar}>
                <View style={styles.statItem}>
                    <Text style={styles.statValue}>{fmt(totalRevenue)}</Text>
                    <Text style={styles.statLabel}>Dispatched</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                    <Text style={[styles.statValue, outstanding > 0 && { color: '#EF4444' }]}>
                        {fmt(outstanding)}
                    </Text>
                    <Text style={styles.statLabel}>Outstanding</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                    <Text style={[styles.statValue, draftCount > 0 && { color: '#D97706' }]}>
                        {draftCount}
                    </Text>
                    <Text style={styles.statLabel}>Drafts</Text>
                </View>
            </View>

            {/* ── Filter Tabs ────────────────────────────────────── */}
            <View style={styles.tabsRow}>
                {STATUS_TABS.map(tab => (
                    <TouchableOpacity
                        key={String(tab.value)}
                        style={[styles.tab, activeTab === tab.value && styles.tabActive]}
                        onPress={() => setActiveTab(tab.value)}
                    >
                        <Text style={[styles.tabText, activeTab === tab.value && styles.tabTextActive]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* ── List ────────────────────────────────────────────── */}
            {loading && orders.length === 0 ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#10B981" />
                    <Text style={styles.loadingText}>Loading orders…</Text>
                </View>
            ) : (
                <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
                    <FlatList
                        data={filtered}
                        keyExtractor={item => item.so_id}
                        renderItem={renderItem}
                        contentContainerStyle={styles.listContent}
                        refreshControl={
                            <RefreshControl refreshing={loading} onRefresh={load} colors={['#10B981']} />
                        }
                        ListEmptyComponent={
                            <View style={styles.empty}>
                                <View style={styles.emptyIcon}>
                                    <Icon name="receipt-text-outline" size={52} color="#D1D5DB" />
                                </View>
                                <Text style={styles.emptyTitle}>
                                    {activeTab ? `No ${activeTab} orders` : 'No sales orders yet'}
                                </Text>
                                <Text style={styles.emptyDesc}>
                                    {activeTab
                                        ? 'Try a different filter above'
                                        : 'Tap the + button to create your first order'}
                                </Text>
                                {!activeTab && (
                                    <TouchableOpacity
                                        style={styles.emptyBtn}
                                        onPress={() => navigation.navigate('CreateSalesOrder')}
                                    >
                                        <Icon name="plus" size={16} color="#FFF" />
                                        <Text style={styles.emptyBtnText}>New Order</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        }
                    />
                </Animated.View>
            )}
        </View>
    );
}


const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F5F5F5' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 80 },
    loadingText: { marginTop: 12, color: '#9CA3AF', fontSize: 14 },

    /* Header — dark green, same as rest of app */
    header: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingHorizontal: 16,
        paddingTop: (StatusBar.currentHeight ?? 24) + 10,
        paddingBottom: 14,
        backgroundColor: APP_GREEN,
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFF' },
    headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
    crmBtn: {
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center', justifyContent: 'center',
    },
    addBtn: {
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: '#FFF',
        alignItems: 'center', justifyContent: 'center',
    },

    /* Stats — white card below header */
    statsBar: {
        flexDirection: 'row', backgroundColor: '#FFF',
        paddingVertical: 14, paddingHorizontal: 8,
        borderBottomWidth: 1, borderColor: '#E5E7EB',
    },
    statItem: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 16, fontWeight: '800', color: '#111827' },
    statLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 3 },
    statDivider: { width: 1, backgroundColor: '#E5E7EB', marginVertical: 4 },

    /* Tabs */
    tabsRow: {
        flexDirection: 'row', backgroundColor: '#FFF',
        paddingHorizontal: 12, paddingVertical: 10, gap: 8,
        borderBottomWidth: 1, borderColor: '#E5E7EB',
    },
    tab: {
        paddingHorizontal: 14, paddingVertical: 6,
        borderRadius: 20, backgroundColor: '#F3F4F6',
    },
    tabActive: { backgroundColor: APP_GREEN },
    tabText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
    tabTextActive: { color: '#FFF' },

    /* List */
    listContent: { padding: 14, paddingBottom: 80 },

    /* Card */
    card: {
        backgroundColor: '#FFF', borderRadius: 14, padding: 16,
        marginBottom: 12, elevation: 1,
        shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    avatarWrap: {
        width: 42, height: 42, borderRadius: 12,
        backgroundColor: APP_GREEN, alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { color: '#FFF', fontSize: 18, fontWeight: '800' },
    customerName: { fontSize: 15, fontWeight: '700', color: '#111827' },
    soId: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
    amount: { fontSize: 16, fontWeight: '800', color: '#111827' },
    date: { fontSize: 11, color: '#9CA3AF', marginTop: 3 },

    cardBottom: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    statusPill: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
    },
    statusText: { fontSize: 12, fontWeight: '700' },
    payPill: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: 10, paddingVertical: 4,
        borderRadius: 8, borderWidth: 1.5,
    },
    payDot: { width: 6, height: 6, borderRadius: 3 },
    payText: { fontSize: 12, fontWeight: '700' },
    payAmt: { fontSize: 11, fontWeight: '600' },

    /* Empty */
    empty: { alignItems: 'center', marginTop: 80, paddingHorizontal: 30 },
    emptyIcon: {
        width: 90, height: 90, borderRadius: 28,
        backgroundColor: APP_GREEN_LIGHT, alignItems: 'center', justifyContent: 'center',
        marginBottom: 20,
    },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151', marginBottom: 8 },
    emptyDesc: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 21, marginBottom: 24 },
    emptyBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: APP_GREEN, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12,
    },
    emptyBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});
