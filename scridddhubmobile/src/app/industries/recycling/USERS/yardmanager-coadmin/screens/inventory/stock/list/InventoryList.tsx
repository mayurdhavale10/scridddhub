
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TextInput, RefreshControl, ActivityIndicator, Platform, SafeAreaView, TouchableOpacity, StatusBar, Alert, Modal } from 'react-native';
import { useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { getStockLots, voidStockLot } from '../../../../../../../../../shared/inventory/api';
import { useNavigation } from '@react-navigation/native';

export const InventoryList = () => {
    const navigation = useNavigation();
    const user = useSelector((state: any) => state.auth.user);
    const [loading, setLoading] = useState(true);
    const [stockLots, setStockLots] = useState<any[]>([]);
    const [filteredData, setFilteredData] = useState<any[]>([]);
    const [search, setSearch] = useState('');

    // Void State
    const [voidModalVisible, setVoidModalVisible] = useState(false);
    const [voidReason, setVoidReason] = useState("");
    const [lotToVoid, setLotToVoid] = useState<string | null>(null);
    const [expandedLot, setExpandedLot] = useState<string | null>(null);

    const isManager = user?.role === 'yard_manager' || user?.role === 'admin' || user?.role === 'owner';

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await getStockLots("TENANT-001");
            if (res && res.data) {
                const list = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
                setStockLots(list);
                setFilteredData(list);
            }
        } catch (error) {
            console.error("Stock load failed", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleSearch = (text: string) => {
        setSearch(text);
        if (!text) {
            setFilteredData(stockLots);
            return;
        }
        const lower = text.toLowerCase();
        setFilteredData(stockLots.filter(item =>
            item.lot_id?.toLowerCase().includes(lower) ||
            item.material_id?.toLowerCase().includes(lower)
        ));
    };

    const getAge = (dateStr?: string) => {
        if (!dateStr) return 0;
        const diff = new Date().getTime() - new Date(dateStr).getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    };

    const handleVoidConfirm = async () => {
        if (!voidReason.trim()) {
            Alert.alert("Reason Required", "Please enter a reason for voiding this lot.");
            return;
        }
        if (!lotToVoid) return;

        try {
            await voidStockLot("TENANT-001", lotToVoid, voidReason);
            setVoidModalVisible(false);
            setVoidReason("");
            setLotToVoid(null);
            loadData();
            Alert.alert("Success", "Lot has been voided.");
        } catch (e: any) {
            Alert.alert("Error", e.message || "Failed to void lot");
        }
    };

    const renderItem = ({ item }: any) => {
        const age = item.days_in_yard || getAge(item.created_at);
        const createdDate = item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Unknown';
        const isOld = age > 30;
        const isExpanded = expandedLot === item.lot_id;

        return (
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setExpandedLot(isExpanded ? null : item.lot_id)}
                style={styles.card}
            >
                <View style={[styles.topAccent, { backgroundColor: item.status === 'stored' ? '#10B981' : '#EF4444' }]} />
                <View style={styles.cardBody}>
                    <View style={styles.cardHeader}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.itemTitle}>{item.material_id}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={[styles.badge, { backgroundColor: item.status === 'stored' ? '#D1FAE5' : '#FEE2E2', marginRight: 8 }]}>
                                <Text style={[styles.badgeText, { color: item.status === 'stored' ? '#065F46' : '#991B1B' }]}>
                                    {item.status ? item.status.toUpperCase() : 'UNKNOWN'}
                                </Text>
                            </View>
                            <Icon name={isExpanded ? "chevron-up" : "chevron-down"} size={24} color="#6B7280" />
                        </View>
                    </View>

                    <View style={styles.metaSection}>
                        <Text style={styles.lotLabel}>Lot ID</Text>
                        <Text style={styles.lotId} numberOfLines={1}>{item.lot_id}</Text>
                    </View>

                    <View style={styles.weightRow}>
                        <Text style={styles.weightLabel}>Net Weight</Text>
                        <Text style={styles.weightValue}>{item.available_weight} kg</Text>
                    </View>

                    {isExpanded && (
                        <View style={styles.expandedContent}>
                            <View style={styles.divider} />

                            <View style={styles.detailGrid}>
                                <View style={styles.detailItem}>
                                    <Text style={styles.detailLabel}>Inbound Date</Text>
                                    <Text style={styles.detailValue}>{createdDate}</Text>
                                </View>
                                <View style={styles.detailItem}>
                                    <Text style={styles.detailLabel}>Yard Area</Text>
                                    <Text style={styles.detailValue}>{item.zone_id || 'Not Assigned'}</Text>
                                </View>
                                <View style={styles.detailItem}>
                                    <Text style={styles.detailLabel}>FIFO Priority</Text>
                                    <Text style={[styles.detailValue, { color: isOld ? '#EF4444' : '#10B981' }]}>
                                        {age} Days Old
                                    </Text>
                                </View>
                                <View style={styles.detailItem}>
                                    <Text style={styles.detailLabel}>Lot Status</Text>
                                    <Text style={styles.detailValue}>{item.status || 'Active'}</Text>
                                </View>
                            </View>

                            <View style={styles.actionRow}>
                                <TouchableOpacity
                                    onPress={() => {
                                        setLotToVoid(item.lot_id);
                                        setVoidModalVisible(true);
                                    }}
                                    style={styles.voidBtn}
                                >
                                    <Icon name="delete-outline" size={20} color="#EF4444" />
                                    <Text style={styles.voidBtnText}>Void Lot</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Icon name="chevron-left" size={32} color="#111827" />
                </TouchableOpacity>
                <View style={styles.searchWrapper}>
                    <Icon name="magnify" size={20} color="#6B7280" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search FIFO Stock..."
                        placeholderTextColor="#9CA3AF"
                        value={search}
                        onChangeText={handleSearch}
                    />
                </View>
            </View>

            {/* Manager Simulation Banner */}
            {isManager && (
                <TouchableOpacity
                    style={styles.simulationBanner}
                    onPress={() => (navigation as any).navigate('YardManagerDashboard')}
                >
                    <Text style={styles.simulationText}>👀 Viewing as Operator — Tap to Return to Manager Dashboard</Text>
                </TouchableOpacity>
            )}

            {loading ? (
                <ActivityIndicator size="large" color="#059669" style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={filteredData}
                    keyExtractor={(item) => item.lot_id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} tintColor="#059669" />}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', marginTop: 50 }}>
                            <Text style={styles.emptyText}>No stock found.</Text>
                            <Text style={{ color: '#666', fontSize: 12 }}>Pass items in QC to see them here.</Text>
                        </View>
                    }
                />
            )}

            {/* Void Modal */}
            <Modal visible={voidModalVisible} transparent animationType="fade">
                <View style={styles.modalBg}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Icon name="delete-alert" size={32} color="#EF4444" />
                            <Text style={styles.modalTitle}>Void Stock Lot</Text>
                        </View>
                        <Text style={styles.modalSub}>
                            This will mark the lot as VOID and remove it from active inventory. This action cannot be undone.
                        </Text>

                        <TextInput
                            style={styles.input}
                            placeholder="Reason for voiding (e.g. Data entry error)"
                            placeholderTextColor="#9CA3AF"
                            value={voidReason}
                            onChangeText={setVoidReason}
                            multiline
                            numberOfLines={3}
                        />

                        <View style={styles.modalBtns}>
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={() => {
                                    setVoidModalVisible(false);
                                    setVoidReason("");
                                }}
                            >
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.confirmBtn} onPress={handleVoidConfirm}>
                                <Text style={styles.confirmBtnText}>Void Lot</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingTop: Platform.OS === 'android' ? 45 : 12, // Reduced slightly for banner
        paddingBottom: 15,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderColor: '#E5E7EB',
    },
    simulationBanner: {
        backgroundColor: '#15803D',
        padding: 10,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 5,
        zIndex: 10
    },
    simulationText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 12
    },
    backBtn: {
        padding: 4,
        marginRight: 8,
    },
    searchWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: '#111827',
        fontWeight: '500',
        padding: 0, // Reset default Android padding
    },

    listContent: { padding: 16, paddingBottom: 40 },
    card: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 4,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E5E7EB'
    },
    topAccent: {
        height: 6,
    },
    cardBody: {
        padding: 16,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12
    },
    itemTitle: {
        fontSize: 20,
        color: '#111827',
        fontWeight: '900',
        textTransform: 'capitalize',
        flexShrink: 1,
        marginRight: 10
    },
    badge: {
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 20
    },
    badgeText: {
        color: '#FFF',
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.5
    },

    metaSection: {
        marginBottom: 16,
    },
    lotLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#9CA3AF',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 2
    },
    lotId: {
        fontSize: 14,
        color: '#374151',
        fontWeight: '600',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        marginBottom: 8
    },
    dateText: {
        fontSize: 12,
        color: '#6B7280',
        fontStyle: 'italic'
    },

    fifoHighlight: {
        backgroundColor: '#F0FDF4',
        padding: 12,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#DCFCE7',
        marginBottom: 12
    },
    fifoLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#166534'
    },
    fifoValue: {
        fontSize: 18,
        fontWeight: '900',
    },

    weightRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    weightLabel: {
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '500'
    },
    weightValue: {
        fontSize: 16,
        color: '#111827',
        fontWeight: '800'
    },

    zoneTag: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    zoneText: {
        fontSize: 13,
        color: '#4B5563',
        fontWeight: '700'
    },

    emptyText: { color: '#374151', fontSize: 16, fontWeight: '600' },

    deleteBtn: {
        padding: 4,
    },
    expandedContent: {
        marginTop: 12,
    },
    divider: {
        height: 1,
        backgroundColor: '#F3F4F6',
        marginVertical: 12,
    },
    detailGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 16,
    },
    detailItem: {
        width: '45%',
    },
    detailLabel: {
        fontSize: 11,
        color: '#9CA3AF',
        fontWeight: '600',
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    detailValue: {
        fontSize: 14,
        color: '#111827',
        fontWeight: '700',
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    voidBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FEE2E2',
        backgroundColor: '#FEF2F2',
    },
    voidBtnText: {
        color: '#EF4444',
        fontSize: 13,
        fontWeight: '700',
        marginLeft: 6,
    },

    // Modal Styles
    modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#FFF', borderRadius: 20, padding: 24, elevation: 5 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827', marginLeft: 10 },
    modalSub: { fontSize: 14, color: '#6B7280', marginBottom: 20, lineHeight: 20 },
    input: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 12,
        height: 100,
        textAlignVertical: 'top',
        color: '#111827',
        marginBottom: 24,
    },
    modalBtns: { flexDirection: 'row', gap: 12 },
    cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' },
    cancelBtnText: { color: '#4B5563', fontWeight: 'bold', fontSize: 16 },
    confirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#EF4444', alignItems: 'center' },
    confirmBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
});
