import React, { useEffect, useState, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    StatusBar, Animated, RefreshControl, ActivityIndicator,
    Dimensions, FlatList, Alert, TextInput, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { getWeighEntries, getStockLots, getSalesOrders } from '../../../../../../shared/inventory/api';

const { width } = Dimensions.get('window');
const TENANT = 'TENANT-001';
const GREEN = '#1B6B2F';
const GREEN_LIGHT = '#E8F5E9';

const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fmtKg = (n: number) => `${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })} kg`;

interface KPIs {
    totalStockKg: number;
    stockLots: number;
    todayWeighKg: number;
    todayEntries: number;
    totalOrders: number;
    pendingOrders: number;
    totalRevenue: number;
    collectedRevenue: number;
    outstandingRevenue: number;
    topMaterials: { name: string; kg: number }[];
    recentEntries: any[];
}

function AnimatedKPICard({ title, value, sub, icon, color, bg, delay }: any) {
    const scaleAnim = useRef(new Animated.Value(0.85)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(opacityAnim, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
            Animated.spring(scaleAnim, { toValue: 1, delay, useNativeDriver: true, friction: 8 }),
        ]).start();
    }, []);

    return (
        <Animated.View style={[styles.kpiCard, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
            <View style={[styles.kpiIconBox, { backgroundColor: bg }]}>
                <Icon name={icon} size={22} color={color} />
            </View>
            <Text style={styles.kpiValue}>{value}</Text>
            <Text style={styles.kpiTitle}>{title}</Text>
            {sub ? <Text style={styles.kpiSub}>{sub}</Text> : null}
        </Animated.View>
    );
}

export const OwnerDashboard = ({ navigation, route }: any) => {
    const { modules = [] } = route.params || {};
    const hasModule = (key: string) => modules.length === 0 || modules.includes(key);

    const [kpis, setKpis] = useState<KPIs | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [greeting, setGreeting] = useState('Good Morning');
    const [inventoryOpen, setInventoryOpen] = useState(false);
    const headerAnim = useRef(new Animated.Value(0)).current;

    // Sidebar Animation
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const slideAnim = useRef(new Animated.Value(-300)).current;

    const toggleSidebar = () => {
        const toValue = isSidebarOpen ? -300 : 0;
        Animated.timing(slideAnim, {
            toValue,
            duration: 300,
            useNativeDriver: true,
        }).start();
        setSidebarOpen(!isSidebarOpen);
    };

    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 12) setGreeting('Good Morning');
        else if (hour < 17) setGreeting('Good Afternoon');
        else setGreeting('Good Evening');

        Animated.timing(headerAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [weighRes, stockRes, salesRes] = await Promise.all([
                getWeighEntries(TENANT).catch(() => ({ data: [] })),
                getStockLots(TENANT).catch(() => ({ data: [] })),
                getSalesOrders(TENANT).catch(() => ({ data: [] })),
            ]);

            const weighLogs: any[] = weighRes.data || [];
            const stockLots: any[] = stockRes.data || [];
            const salesOrders: any[] = salesRes.data || [];

            const today = new Date().toDateString();
            const todayLogs = weighLogs.filter(l => new Date(l.created_at).toDateString() === today);
            const todayWeighKg = todayLogs.reduce((s: number, l: any) => s + (Number(l.net_weight) || 0), 0);

            const activeStock = stockLots.filter((l: any) => l.status === 'stored' && l.available_weight > 0);
            const totalStockKg = activeStock.reduce((s: number, l: any) => s + (Number(l.available_weight) || 0), 0);

            const matMap: Record<string, number> = {};
            activeStock.forEach((l: any) => {
                matMap[l.material_id] = (matMap[l.material_id] || 0) + Number(l.available_weight);
            });
            const topMaterials = Object.entries(matMap)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 4)
                .map(([name, kg]) => ({ name, kg }));

            const totalRevenue = salesOrders.reduce((s: number, o: any) => s + (Number(o.total_amount) || 0), 0);
            const collectedRevenue = salesOrders.reduce((s: number, o: any) => s + (Number(o.amount_paid) || 0), 0);
            const pendingOrders = salesOrders.filter((o: any) => o.status === 'draft' || o.status === 'confirmed').length;

            setKpis({
                totalStockKg,
                stockLots: activeStock.length,
                todayWeighKg,
                todayEntries: todayLogs.length,
                totalOrders: salesOrders.length,
                pendingOrders,
                totalRevenue,
                collectedRevenue,
                outstandingRevenue: totalRevenue - collectedRevenue,
                topMaterials,
                recentEntries: weighLogs.slice(0, 5),
            });
        } catch (e) {
            console.error('Dashboard load error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => { setRefreshing(true); loadData(); };

    const QuickAction = ({ icon, label, color, bg, onPress }: any) => (
        <TouchableOpacity style={[styles.quickAction, { backgroundColor: bg }]} onPress={onPress}>
            <View style={[styles.quickActionIcon, { backgroundColor: color + '22' }]}>
                <Icon name={icon} size={24} color={color} />
            </View>
            <Text style={[styles.quickActionLabel, { color }]}>{label}</Text>
        </TouchableOpacity>
    );

    const SidebarContent = () => (
        <View style={styles.sidebarInner}>
            <View style={styles.sidebarHeader}>
                <Icon name="shield-account" size={28} color={GREEN} />
                <Text style={styles.sidebarTitle}>Owner Admin</Text>
            </View>

            <ScrollView style={styles.sidebarScroll}>
                <View style={styles.menuSection}>
                    <Text style={styles.sectionHeader}>CORE MODULES</Text>
                    {hasModule('inventory') && (
                        <>
                            <TouchableOpacity
                                style={styles.menuItem}
                                onPress={() => setInventoryOpen(!inventoryOpen)}
                            >
                                <Icon name="warehouse" size={22} color={GREEN} />
                                <Text style={[styles.menuText, { flex: 1 }]}>Inventory</Text>
                                <Icon name={inventoryOpen ? "chevron-up" : "chevron-down"} size={20} color="#9CA3AF" />
                            </TouchableOpacity>

                            {inventoryOpen && (
                                <View style={styles.subMenu}>
                                    <TouchableOpacity style={styles.subItem} onPress={() => { toggleSidebar(); navigation.navigate('InventoryDashboard'); }}>
                                        <Text style={styles.subItemText}>Overview Hub</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.subItem} onPress={() => { toggleSidebar(); navigation.navigate('InventoryList'); }}>
                                        <Text style={styles.subItemText}>FIFO Stock</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.subItem} onPress={() => { toggleSidebar(); navigation.navigate('QCListScreen'); }}>
                                        <Text style={styles.subItemText}>Quality Control (QC)</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.subItem} onPress={() => { toggleSidebar(); navigation.navigate('InventoryLedger'); }}>
                                        <Text style={styles.subItemText}>Stock Ledger</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.subItem} onPress={() => { toggleSidebar(); navigation.navigate('SalesGateway'); }}>
                                        <Text style={styles.subItemText}>Sales Gateway</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.subItem} onPress={() => { toggleSidebar(); navigation.navigate('YardManagerFieldsScreen'); }}>
                                        <Text style={styles.subItemText}>Weigh Fields</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </>
                    )}
                    {hasModule('customers') && (
                        <TouchableOpacity style={styles.menuItem} onPress={() => { toggleSidebar(); navigation.navigate('SalesOrderList'); }}>
                            <Icon name="cart-outline" size={22} color="#4B5563" />
                            <Text style={styles.menuText}>Sales & Orders</Text>
                        </TouchableOpacity>
                    )}
                    {hasModule('logistics') && (
                        <TouchableOpacity style={styles.menuItem} onPress={() => { toggleSidebar(); navigation.navigate('LogisticsHome'); }}>
                            <Icon name="truck-fast-outline" size={22} color="#4B5563" />
                            <Text style={styles.menuText}>Logistics</Text>
                        </TouchableOpacity>
                    )}
                    {(hasModule('customers') || hasModule('finance')) && (
                        <TouchableOpacity style={styles.menuItem} onPress={() => { toggleSidebar(); navigation.navigate('CRMOutstanding'); }}>
                            <Icon name="account-cash-outline" size={22} color="#4B5563" />
                            <Text style={styles.menuText}>CRM & Dues</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.divider} />

                <View style={styles.menuSection}>
                    <Text style={styles.sectionHeader}>WORKFORCE PULSE</Text>
                    <TouchableOpacity style={styles.menuItem} onPress={() => { toggleSidebar(); navigation.navigate('GuardianHub'); }}>
                        <Icon name="pulse" size={22} color="#DC2626" />
                        <Text style={[styles.menuText, { color: '#DC2626' }]}>Live Presence Hub</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.menuItem} onPress={() => { toggleSidebar(); navigation.navigate('StaffList'); }}>
                        <Icon name="account-group-outline" size={22} color="#4B5563" />
                        <Text style={styles.menuText}>Attendance & Staff</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.menuItem} onPress={() => { toggleSidebar(); navigation.navigate('YardManagerDashboard', { modules }); }}>
                        <Icon name="swap-horizontal" size={22} color="#4B5563" />
                        <Text style={styles.menuText}>Switch to Yard View</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <TouchableOpacity style={styles.sidebarFooter} onPress={() => navigation.replace('AuthRoleScreen')}>
                <Icon name="logout" size={20} color="#DC2626" />
                <Text style={styles.logoutSidebarText}>Logout System</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
            <StatusBar barStyle="light-content" backgroundColor={GREEN} />

            <View style={{ flex: 1, flexDirection: 'row' }}>
                {/* 1. LARGE SCREEN SIDEBAR (Fixed) */}
                {width >= 768 && (
                    <View style={styles.fixedSidebar}>
                        <SidebarContent />
                    </View>
                )}

                <View style={{ flex: 1 }}>
                    {/* Header */}
                    <Animated.View style={[styles.header, {
                        opacity: headerAnim,
                        transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) }]
                    }]}>
                        <TouchableOpacity style={styles.menuBtn} onPress={toggleSidebar}>
                            <Icon name="menu" size={26} color="#FFF" />
                        </TouchableOpacity>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.greeting}>{greeting},</Text>
                            <Text style={styles.ownerName}>Owner Admin</Text>
                        </View>
                        <View style={styles.headerActions}>
                            <TouchableOpacity
                                style={styles.headerBtn}
                                onPress={() => navigation.navigate('StaffList', { filterRole: 'yard_manager' })}
                            >
                                <Icon name="account-group" size={22} color="#FFF" />
                            </TouchableOpacity>
                        </View>
                    </Animated.View>

                    {loading ? (
                        <View style={styles.loader}>
                            <ActivityIndicator size="large" color={GREEN} />
                            <Text style={styles.loadingText}>Loading dashboard…</Text>
                        </View>
                    ) : (
                        <ScrollView
                            contentContainerStyle={styles.body}
                            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[GREEN]} />}
                        >
                            <View style={styles.revenueBanner}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.revLabel}>TOTAL REVENUE</Text>
                                    <Text style={styles.revValue}>{fmt(kpis?.totalRevenue || 0)}</Text>
                                    <View style={styles.revRow}>
                                        <View style={styles.revChip}>
                                            <Icon name="check-circle" size={12} color="#4ADE80" />
                                            <Text style={styles.revChipText}>{fmt(kpis?.collectedRevenue || 0)} collected</Text>
                                        </View>
                                        <View style={[styles.revChip, { backgroundColor: 'rgba(251,113,113,0.2)' }]}>
                                            <Icon name="clock-outline" size={12} color="#FCA5A5" />
                                            <Text style={[styles.revChipText, { color: '#FCA5A5' }]}>{fmt(kpis?.outstandingRevenue || 0)} pending</Text>
                                        </View>
                                    </View>
                                </View>
                                <View style={styles.revIconBox}>
                                    <Icon name="cash-multiple" size={36} color="rgba(255,255,255,0.3)" />
                                </View>
                            </View>

                            <Text style={styles.sectionTitle}>INVENTORY INSIGHTS</Text>
                            <View style={styles.kpiGrid}>
                                <TouchableOpacity style={{ flex: 1 }} onPress={() => navigation.navigate('InventoryLedger')}>
                                    <AnimatedKPICard
                                        title="Total Stock" value={fmtKg(kpis?.totalStockKg || 0)}
                                        sub={`${kpis?.stockLots || 0} lots`}
                                        icon="warehouse" color={GREEN} bg={GREEN_LIGHT} delay={0}
                                    />
                                </TouchableOpacity>
                                <TouchableOpacity style={{ flex: 1 }} onPress={() => navigation.navigate('InventoryLedger')}>
                                    <AnimatedKPICard
                                        title="Today Intake" value={fmtKg(kpis?.todayWeighKg || 0)}
                                        sub={`${kpis?.todayEntries || 0} entries`}
                                        icon="scale" color="#7C3AED" bg="#F3E8FF" delay={80}
                                    />
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.sectionTitle}>SALES PERFORMANCE</Text>
                            <View style={styles.kpiGrid}>
                                <TouchableOpacity style={{ flex: 1 }} onPress={() => navigation.navigate('SalesOrderList')}>
                                    <AnimatedKPICard
                                        title="Total Orders" value={kpis?.totalOrders || 0}
                                        sub={`${kpis?.pendingOrders || 0} pending`}
                                        icon="clipboard-list" color="#2563EB" bg="#EFF6FF" delay={160}
                                    />
                                </TouchableOpacity>
                                <TouchableOpacity style={{ flex: 1 }} onPress={() => navigation.navigate('CRMOutstanding')}>
                                    <AnimatedKPICard
                                        title="Outstanding" value={fmt(kpis?.outstandingRevenue || 0)}
                                        sub="to collect"
                                        icon="currency-inr" color="#DC2626" bg="#FEF2F2" delay={240}
                                    />
                                </TouchableOpacity>
                            </View>

                            {(kpis?.topMaterials?.length ?? 0) > 0 && (
                                <>
                                    <View style={styles.sectionHeaderLine}>
                                        <Text style={styles.sectionTitle}>TOP MATERIALS IN YARD</Text>
                                        <TouchableOpacity onPress={() => navigation.navigate('InventoryList')}>
                                            <Text style={styles.viewMore}>View Lots</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <View style={styles.card}>
                                        {kpis!.topMaterials.map((m, i) => {
                                            const max = kpis!.topMaterials[0].kg;
                                            const pct = max > 0 ? (m.kg / max) * 100 : 0;
                                            const barColors = [GREEN, '#2563EB', '#7C3AED', '#D97706'];
                                            return (
                                                <View key={m.name} style={styles.matRow}>
                                                    <View style={styles.matRank}>
                                                        <Text style={styles.matRankText}>{i + 1}</Text>
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <View style={styles.matLabelRow}>
                                                            <Text style={styles.matName}>{m.name}</Text>
                                                            <Text style={styles.matKg}>{fmtKg(m.kg)}</Text>
                                                        </View>
                                                        <View style={styles.barBg}>
                                                            <View style={[styles.barFill, {
                                                                width: `${pct}%` as any,
                                                                backgroundColor: barColors[i % barColors.length]
                                                            }]} />
                                                        </View>
                                                    </View>
                                                </View>
                                            );
                                        })}
                                    </View>
                                </>
                            )}

                            <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
                            <View style={styles.quickActionsGrid}>
                                <QuickAction
                                    icon="text-box-search-outline" label="Stock Statement" color={GREEN} bg={GREEN_LIGHT}
                                    onPress={() => navigation.navigate('InventoryLedger')}
                                />
                                <QuickAction
                                    icon="cash-multiple" label="CRM & Dues" color="#2563EB" bg="#EFF6FF"
                                    onPress={() => navigation.navigate('CRMOutstanding')}
                                />
                                <QuickAction
                                    icon="pulse" label="Workforce Pulse" color="#DC2626" bg="#FEF2F2"
                                    onPress={() => navigation.navigate('GuardianHub')}
                                />
                                <QuickAction
                                    icon="account-group" label="Attendance" color="#7C3AED" bg="#F3E8FF"
                                    onPress={() => navigation.navigate('StaffList', { filterRole: 'operator' })}
                                />
                            </View>

                            {(kpis?.recentEntries?.length ?? 0) > 0 && (
                                <>
                                    <Text style={styles.sectionTitle}>RECENT WEIGH ENTRIES</Text>
                                    <View style={styles.card}>
                                        {kpis!.recentEntries.map((e: any, i: number) => (
                                            <View key={e.batch_id} style={[
                                                styles.recentRow,
                                                i < kpis!.recentEntries.length - 1 && styles.recentRowBorder
                                            ]}>
                                                <View style={styles.recentIcon}>
                                                    <Icon name="recycle" size={16} color={GREEN} />
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.recentMat}>{e.material_id}</Text>
                                                    <Text style={styles.recentMeta}>{e.supplier_id} · {new Date(e.created_at).toLocaleDateString('en-IN')}</Text>
                                                </View>
                                                <Text style={styles.recentWeight}>{e.net_weight} kg</Text>
                                            </View>
                                        ))}
                                    </View>
                                </>
                            )}
                        </ScrollView>
                    )}
                </View>
            </View>

            {/* 3. MOBILE SIDEBAR (Drawer) */}
            {width < 768 && (
                <>
                    {isSidebarOpen && (
                        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={toggleSidebar} />
                    )}
                    <Animated.View style={[styles.drawerStyle, { transform: [{ translateX: slideAnim }] }]}>
                        <SidebarContent />
                    </Animated.View>
                </>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F5F5F5' },
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 20, paddingVertical: 16,
        backgroundColor: GREEN,
    },
    greeting: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
    ownerName: { fontSize: 22, fontWeight: '800', color: '#FFF', marginTop: 2 },
    headerActions: { flexDirection: 'row', gap: 8 },
    headerBtn: {
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.18)',
        alignItems: 'center', justifyContent: 'center',
    },
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    loadingText: { marginTop: 12, color: '#9CA3AF', fontSize: 14 },
    body: { padding: 16, paddingBottom: 40 },
    revenueBanner: {
        backgroundColor: GREEN, borderRadius: 20, padding: 20,
        marginBottom: 20, flexDirection: 'row', alignItems: 'center',
        elevation: 3,
    },
    revLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.7)', letterSpacing: 0.8, marginBottom: 4 },
    revValue: { fontSize: 32, fontWeight: '800', color: '#FFF', marginBottom: 10 },
    revRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    revChip: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: 'rgba(74,222,128,0.2)',
        paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
    },
    revChipText: { fontSize: 11, color: '#4ADE80', fontWeight: '700' },
    revIconBox: { paddingLeft: 10 },
    sectionTitle: { fontSize: 11, fontWeight: '800', color: '#9CA3AF', letterSpacing: 0.8, marginBottom: 10, marginTop: 4 },
    kpiGrid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    kpiCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 16, padding: 16, elevation: 1 },
    kpiIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    kpiValue: { fontSize: 18, fontWeight: '800', color: '#111', marginBottom: 2 },
    kpiTitle: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
    kpiSub: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
    card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 1 },
    matRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    matRank: { width: 24, height: 24, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
    matRankText: { fontSize: 11, fontWeight: '800', color: '#374151' },
    matLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    matName: { fontSize: 13, fontWeight: '700', color: '#111' },
    matKg: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
    barBg: { height: 5, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: 3 },
    quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
    quickAction: { width: (width - 44) / 2, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, elevation: 1 },
    quickActionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    quickActionLabel: { fontSize: 14, fontWeight: '700' },
    recentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    recentRowBorder: { borderBottomWidth: 1, borderColor: '#F3F4F6' },
    recentIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: GREEN_LIGHT, alignItems: 'center', justifyContent: 'center' },
    recentMat: { fontSize: 14, fontWeight: '700', color: '#111' },
    recentMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
    recentWeight: { fontSize: 14, fontWeight: '800', color: GREEN },
    sectionHeaderLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 4 },
    viewMore: { fontSize: 12, fontWeight: '700', color: GREEN },
    // Sidebar Specific
    fixedSidebar: { width: 260, backgroundColor: '#FFF', borderRightWidth: 1, borderRightColor: '#E5E7EB' },
    drawerStyle: {
        position: 'absolute', top: 0, bottom: 0, left: 0, width: 280,
        backgroundColor: '#FFF', zIndex: 1000, elevation: 10,
        shadowColor: '#000', shadowOffset: { width: 4, height: 0 }, shadowOpacity: 0.1, shadowRadius: 10,
    },
    sidebarInner: { flex: 1 },
    sidebarHeader: { padding: 24, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', flexDirection: 'row', alignItems: 'center', gap: 12 },
    sidebarTitle: { fontSize: 18, fontWeight: '900', color: GREEN },
    sidebarScroll: { flex: 1 },
    menuSection: { padding: 20 },
    sectionHeader: { fontSize: 11, fontWeight: '800', color: '#9CA3AF', marginBottom: 12, letterSpacing: 1 },
    menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
    menuText: { fontSize: 15, fontWeight: '600', color: '#374151' },
    divider: { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 20 },
    sidebarFooter: { margin: 20, padding: 16, backgroundColor: '#FEF2F2', borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
    logoutSidebarText: { color: '#DC2626', fontWeight: '700', fontSize: 14 },
    subMenu: {
        marginLeft: 44,
        borderLeftWidth: 1,
        borderLeftColor: '#F3F4F6',
        paddingLeft: 12,
        marginBottom: 8,
    },
    subItem: {
        paddingVertical: 10,
    },
    subItemText: {
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '500',
    },
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 999 },
    menuBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
