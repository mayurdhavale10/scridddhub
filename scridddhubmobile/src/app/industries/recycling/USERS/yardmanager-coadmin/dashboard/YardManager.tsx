import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    StatusBar,
    ScrollView,
    Image,
    Dimensions,
    Animated,
    useWindowDimensions,
    Platform
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { setDemoRole } from '../../../../../../store/slices/authSlice';

// Feature List Configuration (Adjusted paths for this file location)
const MODULES = [
    { key: "inventory", title: "Inventory", subtitle: "Collection & Sorting", icon: require("../../../../../../assets/feature/inventory.png") },
    { key: "custom_fields", title: "Weigh Fields", subtitle: "Configure Templates", icon: require("../../../../../../assets/feature/inventory.png") },
    { key: "fifo", title: "FIFO Stock", subtitle: "First-In First-Out", icon: require("../../../../../../assets/feature/inventory.png") }, // Using inventory icon as placeholder
    { key: "waste", title: "Waste Mgmt", subtitle: "Logs & Disposals", icon: require("../../../../../../assets/feature/wastemanagement.png") },
    { key: "machines", title: "Machine Health", subtitle: "Machines & Sensors", icon: require("../../../../../../assets/feature/machine.png") },
    { key: "logistics", title: "Logistics", subtitle: "Trips & Vehicles", icon: require("../../../../../../assets/feature/logistic.png") },
    { key: "finance", title: "Finance", subtitle: "Expenses & Payroll", icon: require("../../../../../../assets/feature/finance.png") },
    { key: "access", title: "Access", subtitle: "Roles & Staff", icon: require("../../../../../../assets/feature/access.png") },
    { key: "integrations", title: "Integrations", subtitle: "API & Webhooks", icon: require("../../../../../../assets/feature/integrations.png") },
    { key: "reports", title: "Reports", subtitle: "KPIs & Exports", icon: require("../../../../../../assets/feature/reports.png") },
    { key: "compliance", title: "Compliance", subtitle: "Documents & Audits", icon: require("../../../../../../assets/feature/compliance.png") },
    { key: "suppliers", title: "Suppliers", subtitle: "Vendors & Rates", icon: require("../../../../../../assets/feature/suppliers.png") },
    { key: "customers", title: "Customers", subtitle: "Buyers & Orders", icon: require("../../../../../../assets/feature/customers.png") },
    { key: "quality", title: "Quality", subtitle: "Grades & QC", icon: require("../../../../../../assets/feature/quality.png") },
    { key: "maintenance", title: "Maintenance", subtitle: "Work Orders", icon: require("../../../../../../assets/feature/maintenance.png") },
    { key: "procurement", title: "Procurement", subtitle: "Purchase & Spend", icon: require("../../../../../../assets/feature/procurement.png") },
    { key: "ai_ca", title: "AI CA", subtitle: "Books & GST help", icon: require("../../../../../../assets/feature/ai_ca.png") },
    { key: "ai_secretary", title: "AI Secretary", subtitle: "Daily summary", icon: require("../../../../../../assets/feature/ai_secretary.png") },
    { key: "ai_analyst", title: "AI Analyst", subtitle: "Insights & actions", icon: require("../../../../../../assets/feature/ai_analyst.png") },
];

export const YardManagerDashboard = ({ navigation, route }: any) => {
    const dispatch = useDispatch();
    const user = useSelector((state: any) => state.auth.user);

    const activeModuleKeys = Array.from(new Set([...(route.params?.modules || ["inventory", "custom_fields"]), "fifo"]));
    const groupedKeys = ["custom_fields", "fifo"];
    const activeModules = MODULES.filter(m => activeModuleKeys.includes(m.key) && !groupedKeys.includes(m.key));

    // Responsive Hooks
    const dimensions = useWindowDimensions();
    const isLargeScreen = dimensions.width >= 768;

    // Sidebar Animation
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [inventoryOpen, setInventoryOpen] = useState(false);
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

    const handleSwitchRole = () => {
        // Yard Manager switching to view Operator Dashboard
        navigation.navigate('OperatorsDashboard', { modules: route.params?.modules || [] });
    };

    const handleModulePress = (module: any) => {
        if (!isLargeScreen && isSidebarOpen) toggleSidebar();

        if (module.key === 'inventory') {
            navigation.navigate('InventoryDashboard');
        } else if (module.key === 'custom_fields') {
            navigation.navigate('YardManagerFieldsScreen');
        } else if (module.key === 'fifo') {
            navigation.navigate('InventoryList');
        } else if (module.key === 'logistics') {
            navigation.navigate('LogisticsHome');
        } else {
            console.log(`Navigating to ${module.title}`);
        }
    };

    // Safe Area
    const insets = useSafeAreaInsets();

    // Reusable Sidebar Component
    const SidebarContent = () => (
        <View style={[styles.sidebarContainer, { paddingTop: insets.top }]}>
            <View style={styles.sidebarHeader}>
                <Text style={styles.sidebarTitle}>Yard Ops</Text>
                {!isLargeScreen && (
                    <TouchableOpacity onPress={toggleSidebar}>
                        <Icon name="close" size={24} color="#666" />
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView style={styles.sidebarScroll}>
                <View style={styles.menuSection}>
                    <Text style={styles.sectionHeader}>MODULES</Text>
                    {activeModules.filter(m => m.key !== 'inventory').map((module) => (
                        <TouchableOpacity
                            key={module.key}
                            style={styles.menuItem}
                            onPress={() => handleModulePress(module)}
                        >
                            <Image source={module.icon} style={{ width: 22, height: 22, marginRight: 12 }} resizeMode="contain" />
                            <Text style={styles.menuText}>{module.title}</Text>
                        </TouchableOpacity>
                    ))}

                    {activeModuleKeys.includes('inventory') && (
                        <>
                            <TouchableOpacity
                                style={[styles.menuItem, inventoryOpen && styles.menuItemActive]}
                                onPress={() => setInventoryOpen(!inventoryOpen)}
                            >
                                <Icon name="warehouse" size={22} color="#1B5E20" />
                                <Text style={[styles.menuText, { flex: 1 }]}>Inventory</Text>
                                <Icon name={inventoryOpen ? "chevron-up" : "chevron-down"} size={20} color="#9CA3AF" />
                            </TouchableOpacity>

                            {inventoryOpen && (
                                <View style={styles.subMenu}>
                                    <TouchableOpacity style={styles.subItem} onPress={() => { if (!isLargeScreen) toggleSidebar(); navigation.navigate('InventoryDashboard'); }}>
                                        <Text style={styles.subItemText}>Overview Hub</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.subItem} onPress={() => { if (!isLargeScreen) toggleSidebar(); navigation.navigate('InventoryList'); }}>
                                        <Text style={styles.subItemText}>FIFO Stock</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.subItem} onPress={() => { if (!isLargeScreen) toggleSidebar(); navigation.navigate('YardManagerFieldsScreen'); }}>
                                        <Text style={styles.subItemText}>Weigh Fields</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.subItem} onPress={() => { if (!isLargeScreen) toggleSidebar(); navigation.navigate('QCListScreen'); }}>
                                        <Text style={styles.subItemText}>Quality (QC)</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.subItem} onPress={() => { if (!isLargeScreen) toggleSidebar(); navigation.navigate('SalesGateway'); }}>
                                        <Text style={styles.subItemText}>Sales Gateway</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </>
                    )}
                </View>

                <View style={styles.divider} />

                <View style={styles.menuSection}>
                    <Text style={styles.sectionHeader}>SYSTEM</Text>
                    <TouchableOpacity style={styles.menuItem} onPress={handleSwitchRole}>
                        <Icon name="swap-horizontal" size={22} color="#666" />
                        <Text style={styles.menuText}>Switch Role</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <View style={styles.sidebarFooter}>
                <TouchableOpacity style={styles.logoutBtn} onPress={() => navigation.replace('AuthRoleScreen')}>
                    <Icon name="logout" size={20} color="#C62828" />
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
            <StatusBar barStyle="light-content" backgroundColor="#1B6B2F" />

            {/* RESPONSIVE LAYOUT CONTAINER */}
            <View style={{ flex: 1, flexDirection: 'row' }}>

                {/* 1. LARGE SCREEN SIDEBAR (Fixed) */}
                {isLargeScreen && (
                    <View style={styles.fixedSidebar}>
                        <SidebarContent />
                    </View>
                )}

                {/* 2. MAIN CONTENT AREA */}
                <View style={{ flex: 1 }}>
                    {/* Header */}
                    <View style={styles.header}>
                        {!isLargeScreen && (
                            <TouchableOpacity onPress={toggleSidebar} style={styles.menuBtn}>
                                <Icon name="menu" size={28} color="#FFF" />
                            </TouchableOpacity>
                        )}
                        <View style={{ flex: 1, marginLeft: isLargeScreen ? 0 : 5 }}>
                            <Text style={styles.headerTitle}>Yard Manager</Text>
                            <Text style={styles.headerSub}>Control Center</Text>
                        </View>
                        <View style={styles.profileSection}>
                            <View style={styles.avatar}>
                                <Text style={styles.avatarText}>{user?.fullName?.slice(0, 1) || 'Y'}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Content Body */}
                    <ScrollView contentContainerStyle={styles.mainContent}>
                        {/* Status Cards Row */}
                        {!isLargeScreen ? (
                            // Mobile: Stacked or scrollable
                            <View style={styles.statusRow}>
                                <View style={[styles.statusCard, { backgroundColor: '#E8F5E9' }]}>
                                    <Text style={styles.statusLabel}>Trucks Today</Text>
                                    <Text style={[styles.statusValue, { color: '#1B5E20' }]}>12</Text>
                                </View>
                                <View style={[styles.statusCard, { backgroundColor: '#E3F2FD' }]}>
                                    <Text style={styles.statusLabel}>Processed</Text>
                                    <Text style={[styles.statusValue, { color: '#0D47A1' }]}>14.5t</Text>
                                </View>
                            </View>
                        ) : (
                            // Desktop: Row of specific metrics
                            <View style={styles.desktopStatsRow}>
                                <View style={styles.desktopStatCard}>
                                    <Text style={styles.desktopStatLabel}>Inbound Trucks</Text>
                                    <Text style={styles.desktopStatValue}>12</Text>
                                </View>
                                <View style={styles.desktopStatCard}>
                                    <Text style={styles.desktopStatLabel}>Pending QC</Text>
                                    <Text style={styles.desktopStatValue}>4</Text>
                                </View>
                                <View style={styles.desktopStatCard}>
                                    <Text style={styles.desktopStatLabel}>Processed Today</Text>
                                    <Text style={styles.desktopStatValue}>14,500 kg</Text>
                                </View>
                                <View style={styles.desktopStatCard}>
                                    <Text style={styles.desktopStatLabel}>Active Staff</Text>
                                    <Text style={styles.desktopStatValue}>8</Text>
                                </View>
                            </View>
                        )}

                        <Text style={styles.gridTitle}>Your Modules</Text>

                        <View style={styles.gridContainer}>
                            {activeModules.map((module) => (
                                <TouchableOpacity
                                    key={module.key}
                                    style={[
                                        styles.featureCard,
                                        isLargeScreen ? styles.featureCardLarge : styles.featureCardMobile,
                                        module.key === 'inventory' && styles.inventoryCard
                                    ]}
                                    activeOpacity={0.7}
                                    onPress={() => handleModulePress(module)}
                                >
                                    <Image
                                        source={module.icon}
                                        style={styles.featureImage}
                                        resizeMode="contain"
                                    />
                                    <Text style={styles.featureLabel}>{module.title}</Text>
                                    <Text style={styles.featureSub}>{module.subtitle}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={{ height: 40 }} />
                    </ScrollView>
                </View>
            </View>

            {/* 3. MOBILE SIDEBAR (Drawer) */}
            {!isLargeScreen && (
                <>
                    {/* Overlay */}
                    {isSidebarOpen && (
                        <TouchableOpacity
                            style={styles.overlay}
                            activeOpacity={1}
                            onPress={toggleSidebar}
                        />
                    )}
                    {/* Sliding Drawer */}
                    <Animated.View style={[styles.drawerStyle, { transform: [{ translateX: slideAnim }] }]}>
                        <SidebarContent />
                    </Animated.View>
                </>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3F4F6',
    },
    // Sidebar Styles
    fixedSidebar: {
        width: 260,
        backgroundColor: '#FFFFFF',
        borderRightWidth: 1,
        borderRightColor: '#E5E7EB',
        height: '100%',
    },
    drawerStyle: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        width: 280,
        backgroundColor: '#FFFFFF',
        zIndex: 50,
        shadowColor: "#000",
        shadowOffset: { width: 4, height: 0 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
    },
    sidebarContainer: {
        flex: 1,
        backgroundColor: '#FFF',
    },
    sidebarHeader: {
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sidebarTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1B5E20',
        letterSpacing: -0.5,
    },
    sidebarScroll: {
        flex: 1,
    },
    menuSection: {
        paddingVertical: 15,
        paddingHorizontal: 15,
    },
    sectionHeader: {
        fontSize: 11,
        fontWeight: '700',
        color: '#9CA3AF',
        marginBottom: 10,
        letterSpacing: 1,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 15,
        borderRadius: 8,
        marginBottom: 4,
    },
    menuItemActive: {
        backgroundColor: '#F0FDF4',
    },
    menuText: {
        marginLeft: 12,
        fontSize: 15,
        fontWeight: '500',
        color: '#4B5563',
    },
    menuTextActive: {
        color: '#15803D',
        fontWeight: '700',
    },
    divider: {
        height: 1,
        backgroundColor: '#E5E7EB',
        marginHorizontal: 15,
    },
    sidebarFooter: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
    },
    logoutText: {
        marginLeft: 10,
        color: '#DC2626',
        fontWeight: '600',
    },
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

    // Main Header
    header: {
        height: 70 + (StatusBar.currentHeight || 0),
        paddingTop: StatusBar.currentHeight || 0,
        backgroundColor: '#1B6B2F',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        elevation: 4,
    },
    menuBtn: {
        marginRight: 10,
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    headerSub: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.7)',
        fontWeight: '500',
    },
    profileSection: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    userName: {
        marginRight: 12,
        fontWeight: '600',
        color: '#374151',
        display: 'none', // Hide on mobile primarily, enable via media query logically if needed, but flex handles overlap
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#10B981',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    avatarText: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 14,
    },

    // Main Content
    mainContent: {
        padding: 20,
    },

    // Stats
    statusRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    statusCard: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        backgroundColor: '#FFF',
        alignItems: 'center',
    },
    statusLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 4,
        textTransform: 'uppercase',
        fontWeight: '600',
    },
    statusValue: {
        fontSize: 20,
        fontWeight: '800',
    },
    desktopStatsRow: {
        flexDirection: 'row',
        gap: 20,
        marginBottom: 30,
    },
    desktopStatCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        padding: 20,
        borderRadius: 12,
        shadowColor: 'rgba(0,0,0,0.05)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 4,
        elevation: 2,
    },
    desktopStatLabel: {
        fontSize: 13,
        color: '#6B7280',
        fontWeight: '600',
        marginBottom: 8,
    },
    desktopStatValue: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
    },

    // Grid
    gridTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 16,
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
    },
    featureCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: 'rgba(0,0,0,0.05)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 6,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    featureCardMobile: {
        width: '47%', // 2 cols with gap
        aspectRatio: 1,
    },
    featureCardLarge: {
        width: '23%', // 4 cols approx
        aspectRatio: 1.2,
    },
    inventoryCard: {
        borderColor: '#86EFAC',
        backgroundColor: '#F0FDF4',
    },
    featureImage: {
        width: 60,
        height: 60,
        marginBottom: 12,
    },
    featureEmoji: {
        fontSize: 32,
        marginBottom: 12,
    },
    featureLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        textAlign: 'center',
    },
    featureSub: {
        fontSize: 10,
        color: '#9CA3AF',
        textAlign: 'center',
        marginTop: 4,
    },

    // Overlay
    overlay: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.3)',
        zIndex: 40,
    },
});
