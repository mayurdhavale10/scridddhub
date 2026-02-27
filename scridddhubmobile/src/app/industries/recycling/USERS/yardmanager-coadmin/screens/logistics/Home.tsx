import React, { useState, useEffect, useRef, memo } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    StatusBar, ActivityIndicator, Dimensions, RefreshControl,
    Animated, useWindowDimensions
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getFleet, getTrips } from '../../../../../../../shared/logistics/api';
import { useIsFocused } from '@react-navigation/native';
import io from 'socket.io-client';

const SOCKET_URL = "http://localhost:3030";

const APP_GREEN = '#1B6B2F';
const APP_GREEN_LIGHT = '#E8F5E9';
const TENANT = 'TENANT-001';

// Move MenuCard out of the main component to avoid re-definition and Hook confusion
const MenuCard = memo(({ title, sub, icon, color, bg, onPress }: any) => (
    <TouchableOpacity style={[styles.menuCard, { backgroundColor: bg }]} onPress={onPress}>
        <View style={[styles.iconBox, { backgroundColor: color + '22' }]}>
            <Icon name={icon} size={28} color={color} />
        </View>
        <View style={{ flex: 1 }}>
            <Text style={[styles.menuTitle, { color }]}>{title}</Text>
            <Text style={[styles.menuSub, { color: color + '99' }]}>{sub}</Text>
        </View>
        <Icon name="chevron-right" size={20} color={color} />
    </TouchableOpacity>
));

// Move SidebarContent out for better Hook safety
const SidebarContent = memo(({ insets, isLargeScreen, handleToggle, navigation, modules = [] }: any) => {
    const hasModule = (key: string) => modules.length === 0 || modules.includes(key);
    const [inventoryOpen, setInventoryOpen] = React.useState(false);

    return (
        <View style={styles.sidebarContainer}>
            <View style={[styles.sidebarHeader, { paddingTop: insets.top + 20 }]}>
                <Text style={styles.sidebarTitle}>Yard Ops</Text>
                {!isLargeScreen && (
                    <TouchableOpacity onPress={handleToggle}>
                        <Icon name="close" size={24} color="#666" />
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView style={styles.sidebarScroll}>
                <View style={styles.menuSection}>
                    <Text style={styles.sectionHeader}>LOGISTICS CORE</Text>
                    <TouchableOpacity style={styles.menuItem} onPress={() => { handleToggle(); navigation.navigate('Trips'); }}>
                        <Icon name="map-marker-path" size={22} color="#2563EB" />
                        <Text style={styles.menuText}>Live Trips</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.menuItem} onPress={() => { handleToggle(); navigation.navigate('Vehicles'); }}>
                        <Icon name="truck-cargo-container" size={22} color={APP_GREEN} />
                        <Text style={styles.menuText}>Fleet List</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.menuItem} onPress={() => { handleToggle(); navigation.navigate('Drivers'); }}>
                        <Icon name="card-account-details-outline" size={22} color="#7C3AED" />
                        <Text style={styles.menuText}>Driver Roster</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.divider} />

                <View style={styles.menuSection}>
                    <Text style={styles.sectionHeader}>SWITCH MODULE</Text>
                    {hasModule('inventory') && (
                        <>
                            <TouchableOpacity
                                style={styles.menuItem}
                                onPress={() => setInventoryOpen(!inventoryOpen)}
                            >
                                <Icon name="warehouse" size={22} color="#666" />
                                <Text style={[styles.menuText, { flex: 1 }]}>Inventory</Text>
                                <Icon name={inventoryOpen ? "chevron-up" : "chevron-down"} size={20} color="#9CA3AF" />
                            </TouchableOpacity>

                            {inventoryOpen && (
                                <View style={styles.subMenu}>
                                    <TouchableOpacity style={styles.subItem} onPress={() => { handleToggle(); navigation.navigate('InventoryDashboard', { modules }); }}>
                                        <Text style={styles.subItemText}>Overview Hub</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.subItem} onPress={() => { handleToggle(); navigation.navigate('InventoryList', { modules }); }}>
                                        <Text style={styles.subItemText}>FIFO Stock</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.subItem} onPress={() => { handleToggle(); navigation.navigate('QCListScreen', { modules }); }}>
                                        <Text style={styles.subItemText}>Quality (QC)</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </>
                    )}
                    <TouchableOpacity style={styles.menuItem} onPress={() => { handleToggle(); navigation.navigate('YardManagerDashboard', { modules }); }}>
                        <Icon name="view-dashboard-outline" size={22} color="#666" />
                        <Text style={styles.menuText}>Main Dashboard</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <TouchableOpacity
                style={styles.sidebarFooter}
                onPress={() => navigation.replace('AuthRoleScreen')}
            >
                <Icon name="logout" size={20} color="#DC2626" />
                <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
        </View>
    );
});

export const LogisticsHome = ({ navigation, route }: any) => {
    // 1. All hooks at the very top, unconditionally.
    const isFocused = useIsFocused();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        activeTrips: 0,
        totalFleet: 0,
        totalDrivers: 0,
        maintenance_due: 0
    });

    const [liveFleet, setLiveFleet] = useState<{ [key: string]: any }>({});

    useEffect(() => {
        const socket = io(SOCKET_URL);

        socket.on('location_stream', (data) => {
            console.log("Admin received movement:", data);
            // Implement simple "Snap to Road" simulation by rounding/smoothing
            setLiveFleet(prev => ({
                ...prev,
                [data.tripId]: {
                    ...data.coords,
                    destination: data.destination,
                    lastSeen: new Date().toLocaleTimeString()
                }
            }));
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const { width } = useWindowDimensions();
    const isLargeScreen = width >= 768;
    const insets = useSafeAreaInsets();

    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const slideAnim = useRef(new Animated.Value(-300)).current;

    const handleToggle = () => {
        const toValue = isSidebarOpen ? -300 : 0;
        Animated.timing(slideAnim, {
            toValue,
            duration: 300,
            useNativeDriver: true,
        }).start();
        setSidebarOpen(!isSidebarOpen);
    };

    const loadStats = async () => {
        try {
            setLoading(true);
            const [fleetRes, tripRes] = await Promise.all([
                getFleet(TENANT).catch(() => ({ data: { vehicles: [], drivers: [] } })),
                getTrips(TENANT).catch(() => ({ data: [] }))
            ]);

            const activeTripsList = Array.isArray(tripRes.data) ? tripRes.data : [];
            const activeTripsCount = activeTripsList.filter((t: any) => t.status === 'en_route').length;

            setStats({
                activeTrips: activeTripsCount,
                totalFleet: (fleetRes.data?.vehicles || []).length,
                totalDrivers: (fleetRes.data?.drivers || []).length,
                maintenance_due: 1
            });
        } catch (e) {
            console.error('Logistics stats load error:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isFocused) {
            loadStats();
        }
    }, [isFocused]);

    const { modules = [] } = route.params || {};

    return (
        <SafeAreaView style={styles.root} edges={['top', 'bottom', 'left', 'right']}>
            <StatusBar barStyle="light-content" backgroundColor={APP_GREEN} />

            <View style={{ flex: 1, flexDirection: 'row' }}>
                {/* Fixed Sidebar for Large Screens */}
                {isLargeScreen && (
                    <View style={styles.fixedSidebar}>
                        <SidebarContent
                            insets={insets}
                            isLargeScreen={isLargeScreen}
                            handleToggle={handleToggle}
                            navigation={navigation}
                            modules={modules}
                        />
                    </View>
                )}

                <View style={{ flex: 1 }}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            {!isLargeScreen && (
                                <TouchableOpacity onPress={handleToggle} style={styles.menuBtn}>
                                    <Icon name="menu" size={28} color="#FFF" />
                                </TouchableOpacity>
                            )}
                            <View>
                                <Text style={styles.headerLabel}>SUPPLY CHAIN</Text>
                                <Text style={styles.headerTitle}>Logistics Hub</Text>
                            </View>
                        </View>
                        <TouchableOpacity style={styles.avatar}>
                            <Icon name="truck-fast-outline" size={24} color="#FFF" />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View style={styles.loader}>
                            <ActivityIndicator size="large" color={APP_GREEN} />
                        </View>
                    ) : (
                        <ScrollView
                            contentContainerStyle={styles.body}
                            refreshControl={<RefreshControl refreshing={false} onRefresh={loadStats} />}
                        >
                            <View style={styles.statsRow}>
                                <View style={styles.statItem}>
                                    <Text style={styles.statVal}>{stats.activeTrips}</Text>
                                    <Text style={styles.statLabel}>Active Trips</Text>
                                </View>
                                <View style={styles.statItem}>
                                    <Text style={styles.statVal}>{stats.totalFleet}</Text>
                                    <Text style={styles.statLabel}>Fleet Size</Text>
                                </View>
                                <View style={[styles.statItem, { borderRightWidth: 0 }]}>
                                    <Text style={[styles.statVal, { color: stats.totalDrivers > 0 ? APP_GREEN : '#DC2626' }]}>{stats.totalDrivers}</Text>
                                    <Text style={styles.statLabel}>Staff Count</Text>
                                </View>
                            </View>

                            <Text style={styles.sectionTitle}>FLEET PULSE (LIVE STREAM)</Text>
                            <View style={styles.mapWidget}>
                                <View style={styles.mapPlaceholder}>
                                    {/* Real-time Visualization Layer */}
                                    <Icon name="map-search" size={32} color="rgba(255,255,255,0.1)" />

                                    {Object.entries(liveFleet).map(([id, pos]: any) => (
                                        <View key={id} style={styles.liveVehicleContainer}>
                                            <Animated.View style={[styles.truckDot, { backgroundColor: '#22C55E' }]} />
                                            <View style={styles.vehicleLabel}>
                                                <Text style={styles.vehicleLabelText}>{pos.destination || `TRIP-${id.slice(0, 4)}`}</Text>
                                                <Text style={styles.vehicleTime}>{pos.lastSeen}</Text>
                                            </View>
                                        </View>
                                    ))}

                                    {Object.keys(liveFleet).length === 0 && (
                                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700' }}>
                                            WAITING FOR INCOMING GPS STREAM...
                                        </Text>
                                    )}
                                </View>
                                <View style={styles.mapOverlay}>
                                    <View style={styles.activeIndicator}>
                                        <View style={styles.pulseDot} />
                                        <Text style={styles.activeText}>{Object.keys(liveFleet).length || stats.activeTrips} LIVE SIGNALS</Text>
                                    </View>
                                    <TouchableOpacity style={styles.mapExpandBtn}>
                                        <Icon name="broadcast" size={16} color="#FFF" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <Text style={styles.sectionTitle}>FLEET OPERATIONS</Text>

                            <MenuCard
                                title="Live Trips"
                                sub="Track active movements & fuel usage"
                                icon="map-marker-path"
                                color="#2563EB"
                                bg="#EFF6FF"
                                onPress={() => navigation.navigate('Trips')}
                            />

                            <MenuCard
                                title="Vehicle Fleet"
                                sub="Manage trucks, tempos & ownership"
                                icon="truck-cargo-container"
                                color={APP_GREEN}
                                bg={APP_GREEN_LIGHT}
                                onPress={() => navigation.navigate('Vehicles')}
                            />

                            <MenuCard
                                title="Driver Roster"
                                sub="Assignments, licenses & performance"
                                icon="card-account-details-outline"
                                color="#7C3AED"
                                bg="#F3E8FF"
                                onPress={() => navigation.navigate('Drivers')}
                            />

                            <TouchableOpacity
                                style={styles.scheduleBtn}
                                onPress={() => navigation.navigate('CreateTrip')}
                            >
                                <Icon name="plus-circle" size={22} color="#FFF" />
                                <Text style={styles.scheduleBtnText}>Schedule New Shipment</Text>
                            </TouchableOpacity>

                            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>RESOURCES & COSTS</Text>

                            <View style={styles.grid}>
                                <TouchableOpacity style={styles.gridCard}>
                                    <Icon name="gas-station-outline" size={24} color="#D97706" />
                                    <Text style={styles.gridTitle}>Fuel Ledger</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.gridCard}>
                                    <Icon name="wrench-outline" size={24} color="#6B7280" />
                                    <Text style={styles.gridTitle}>Maintenance</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.aiCard}>
                                <View style={styles.aiHeader}>
                                    <Icon name="robot-outline" size={20} color="#FFF" />
                                    <Text style={styles.aiTitle}>AI LOGISTICS PLANNER</Text>
                                </View>
                                <Text style={styles.aiBody}>
                                    "Route optimization could save 12% fuel this week by batching the Jodhpur delivery."
                                </Text>
                                <TouchableOpacity style={styles.aiBtn}>
                                    <Text style={styles.aiBtnText}>View AI Plan</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    )}
                </View>
            </View>

            {/* Mobile Drawer */}
            {!isLargeScreen && (
                <>
                    {isSidebarOpen && (
                        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleToggle} />
                    )}
                    <Animated.View style={[styles.drawerStyle, { transform: [{ translateX: slideAnim }] }]}>
                        <SidebarContent
                            insets={insets}
                            isLargeScreen={isLargeScreen}
                            handleToggle={handleToggle}
                            navigation={navigation}
                            modules={modules}
                        />
                    </Animated.View>
                </>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F9FAFB' },
    header: {
        backgroundColor: APP_GREEN, paddingHorizontal: 20, paddingTop: 32, paddingBottom: 24,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        borderBottomLeftRadius: 32, borderBottomRightRadius: 32
    },
    headerLabel: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.7)', letterSpacing: 1 },
    headerTitle: { fontSize: 24, fontWeight: '900', color: '#FFF' },
    avatar: { width: 44, height: 44, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    body: { padding: 20 },

    statsRow: {
        flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 24,
        paddingVertical: 20, marginBottom: 24, elevation: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10,
        marginTop: -40, borderWidth: 1, borderColor: '#E5E7EB'
    },
    statItem: { flex: 1, alignItems: 'center', borderRightWidth: 1, borderColor: '#F3F4F6' },
    statVal: { fontSize: 20, fontWeight: '900', color: '#111827' },
    statLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '800', textTransform: 'uppercase', marginTop: 4 },

    sectionTitle: { fontSize: 12, fontWeight: '900', color: '#9CA3AF', marginBottom: 16, letterSpacing: 1 },

    menuCard: {
        flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 24,
        marginBottom: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)'
    },
    iconBox: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 20 },
    menuTitle: { fontSize: 18, fontWeight: '800' },
    menuSub: { fontSize: 13, fontWeight: '600', marginTop: 2 },

    scheduleBtn: { backgroundColor: APP_GREEN, padding: 18, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 8, elevation: 4, shadowColor: APP_GREEN, shadowOpacity: 0.2, shadowRadius: 10 },
    scheduleBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },

    grid: { flexDirection: 'row', gap: 12 },
    gridCard: {
        flex: 1, backgroundColor: '#FFF', padding: 20, borderRadius: 24,
        alignItems: 'center', justifyContent: 'center', gap: 10,
        borderWidth: 1, borderColor: '#E5E7EB'
    },
    gridTitle: { fontSize: 14, fontWeight: '800', color: '#374151' },

    aiCard: {
        backgroundColor: '#111827', borderRadius: 24, padding: 24, marginTop: 32,
        elevation: 8, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 15
    },
    aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
    aiTitle: { fontSize: 11, fontWeight: '900', color: '#FFF', letterSpacing: 1 },
    aiBody: { fontSize: 15, color: 'rgba(255,255,255,0.8)', lineHeight: 22, fontStyle: 'italic', marginBottom: 20 },
    aiBtn: { backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
    aiBtnText: { color: '#FFF', fontWeight: '800', fontSize: 13 },

    // Sidebar Shared Styles
    fixedSidebar: { width: 260, backgroundColor: '#FFF', borderRightWidth: 1, borderRightColor: '#E5E7EB' },
    drawerStyle: {
        position: 'absolute', top: 0, bottom: 0, left: 0, width: 280,
        backgroundColor: '#FFF', zIndex: 1000, elevation: 10,
        shadowColor: '#000', shadowOffset: { width: 4, height: 0 }, shadowOpacity: 0.1, shadowRadius: 10,
    },
    sidebarContainer: { flex: 1 },
    sidebarHeader: {
        padding: 20, borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'
    },
    sidebarTitle: { fontSize: 20, fontWeight: '800', color: APP_GREEN, letterSpacing: -0.5 },
    sidebarScroll: { flex: 1 },
    menuSection: { padding: 15 },
    sectionHeader: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', marginBottom: 10, letterSpacing: 1 },
    menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15, borderRadius: 8, marginBottom: 4 },
    menuText: { marginLeft: 12, fontSize: 15, fontWeight: '500', color: '#4B5563' },
    divider: { height: 1, backgroundColor: '#E5E7EB', marginHorizontal: 15 },
    sidebarFooter: {
        padding: 20, borderTopWidth: 1, borderTopColor: '#F0F0F0',
        flexDirection: 'row', alignItems: 'center', gap: 10
    },
    logoutText: { color: '#DC2626', fontWeight: '600', marginLeft: 10 },
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 999 },
    menuBtn: { padding: 4 },

    mapWidget: { height: 160, backgroundColor: '#1F2937', borderRadius: 28, marginBottom: 24, overflow: 'hidden', elevation: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12 },
    mapPlaceholder: { flex: 1, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
    activeIndicator: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, gap: 8 },
    mapOverlay: { position: 'absolute', bottom: 12, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },

    liveVehicleContainer: { position: 'absolute', alignItems: 'center' },
    vehicleLabel: { backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 12 },
    vehicleLabelText: { fontSize: 8, fontWeight: '900', color: '#111827' },
    vehicleTime: { fontSize: 6, color: '#666', textAlign: 'center' },

    truckDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: APP_GREEN, shadowColor: '#22C55E', shadowOpacity: 1, shadowRadius: 10, elevation: 5 },
    activeText: { fontSize: 11, fontWeight: '800', color: '#FFF' },
    mapExpandBtn: { backgroundColor: 'rgba(255,255,255,0.2)', width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    subMenu: {
        marginLeft: 40,
        borderLeftWidth: 1,
        borderLeftColor: '#E5E7EB',
        paddingLeft: 12,
        marginTop: 4,
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
});
