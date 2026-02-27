import React, { useEffect, useState } from "react";
import {
    View, Text, StyleSheet, FlatList, ActivityIndicator,
    TouchableOpacity, RefreshControl, Alert, TextInput,
    Modal, StatusBar, ScrollView
} from "react-native";
import OperatorLayout from "../../../dashboard/OperatorLayout";
import { getInventoryLedger, voidInventoryEntry } from "../../../../../../../../shared/inventory/api";
import { InventoryLedgerEntry, DailyLedgerSummary, InventoryEventType } from "../../../../../../../../shared/inventory/types";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

const APP_GREEN = '#1B6B2F';
const APP_GREEN_LIGHT = '#E8F5E9';

export default function InventoryLedgerScreen({ navigation }: any) {
    const [ledger, setLedger] = useState<InventoryLedgerEntry[]>([]);
    const [summary, setSummary] = useState<DailyLedgerSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>("ALL");

    // Void Modal State
    const [voidModal, setVoidModal] = useState<{ visible: boolean; item: InventoryLedgerEntry | null }>({ visible: false, item: null });
    const [voidReason, setVoidReason] = useState("");

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await getInventoryLedger("TENANT-001");
            if (res.success) {
                setLedger(res.data.ledger || []);
                setSummary(res.data.summary || null);
            }
        } catch (e: any) {
            Alert.alert("Sync Error", "Could not refresh ledger. Check your connection.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleVoid = async () => {
        if (!voidReason.trim()) return Alert.alert("Required", "Please provide a reason for voiding.");
        if (!voidModal.item) return;

        try {
            const type = voidModal.item.type === InventoryEventType.SPLIT ? 'split' : 'weigh';
            const originalId = voidModal.item.id
                .replace("EV-W-", "")
                .replace("EV-QC-", "")
                .replace("EV-S-", "");

            await voidInventoryEntry("TENANT-001", type, originalId!, voidReason);
            setVoidModal({ visible: false, item: null });
            setVoidReason("");
            fetchData();
        } catch (e: any) {
            Alert.alert("Action Failed", e.message || "Void failed");
        }
    };

    const getEventConfig = (type: InventoryEventType) => {
        switch (type) {
            case InventoryEventType.WEIGH_IN: return { color: '#3B82F6', icon: 'truck-delivery-outline', label: 'WEIGH IN' };
            case InventoryEventType.QC_PASS: return { color: '#10B981', icon: 'check-decagram-outline', label: 'QC PASS' };
            case InventoryEventType.QC_REJECT: return { color: '#EF4444', icon: 'close-octagon-outline', label: 'QC REJECT' };
            case InventoryEventType.SPLIT: return { color: '#8B5CF6', icon: 'source-branch', label: 'PROCESSING' };
            case InventoryEventType.VOID: return { color: '#6B7280', icon: 'cancel', label: 'VOIDED' };
            default: return { color: '#000', icon: 'help-circle-outline', label: type };
        }
    };

    const filteredLedger = filter === "ALL" ? ledger : ledger.filter(item => item.type === filter);

    const renderItem = ({ item }: { item: InventoryLedgerEntry }) => {
        const config = getEventConfig(item.type);
        return (
            <View style={[styles.card, item.type === InventoryEventType.VOID && styles.voidedCard]}>
                <View style={styles.cardHeader}>
                    <View style={[styles.badge, { backgroundColor: config.color + '15' }]}>
                        <Icon name={config.icon} size={14} color={config.color} />
                        <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
                    </View>
                    <Text style={styles.timestamp}>
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>

                <View style={styles.cardBody}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.batchId}>{item.batchId}</Text>
                        <Text style={styles.material}>{item.materialId}</Text>
                        {item.reason && (
                            <View style={styles.reasonBox}>
                                <Text style={styles.reasonText}>“{item.reason}”</Text>
                            </View>
                        )}
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[
                            styles.weight,
                            { color: item.weightChange > 0 ? '#10B981' : item.weightChange < 0 ? '#EF4444' : '#6B7280' }
                        ]}>
                            {item.weightChange > 0 ? '+' : ''}{item.weightChange.toLocaleString()} kg
                        </Text>
                        <View style={styles.opBadge}>
                            <Icon name="account-circle-outline" size={10} color="#9CA3AF" />
                            <Text style={styles.operator}>{item.operator || 'SYSTEM'}</Text>
                        </View>
                    </View>
                </View>

                {item.type !== InventoryEventType.VOID && item.type !== InventoryEventType.QC_PASS && item.type !== InventoryEventType.QC_REJECT && (
                    <TouchableOpacity
                        style={styles.voidBtn}
                        onPress={() => setVoidModal({ visible: true, item })}
                    >
                        <Icon name="alert-outline" size={12} color="#EF4444" />
                        <Text style={styles.voidBtnText}>VOID TRANSACTION</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    return (
        <OperatorLayout title="Stock Statement" navigation={navigation} showBack={true}>
            <StatusBar barStyle="dark-content" />
            <View style={styles.container}>

                {/* 1. Performance Summary */}
                <View style={styles.summaryGrid}>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Intake</Text>
                        <Text style={styles.summaryValue}>{summary?.totalWeighed.toLocaleString() || 0} kg</Text>
                    </View>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Processed</Text>
                        <Text style={styles.summaryValue}>{summary?.totalSplit.toLocaleString() || 0} kg</Text>
                    </View>
                    <View style={[styles.summaryItem, { borderRightWidth: 0 }]}>
                        <Text style={styles.summaryLabel}>Growth</Text>
                        <Text style={[styles.summaryValue, { color: APP_GREEN }]}>
                            {((summary?.totalApproved || 0) - (summary?.totalSplit || 0)).toLocaleString()} kg
                        </Text>
                    </View>
                </View>

                {/* 2. Quick Filters */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ gap: 8 }}>
                    {["ALL", InventoryEventType.WEIGH_IN, InventoryEventType.QC_PASS, InventoryEventType.SPLIT, InventoryEventType.VOID].map(t => (
                        <TouchableOpacity
                            key={t}
                            style={[styles.filterChip, filter === t && styles.filterChipActive]}
                            onPress={() => setFilter(t)}
                        >
                            <Text style={[styles.filterText, filter === t && styles.filterTextActive]}>
                                {t === "ALL" ? "Full Statement" : t.split('_')[0].replace('QC', 'Quality')}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {loading && !ledger.length ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={APP_GREEN} />
                    </View>
                ) : (
                    <FlatList
                        data={filteredLedger}
                        renderItem={renderItem}
                        keyExtractor={item => item.id}
                        contentContainerStyle={{ paddingBottom: 100, paddingTop: 10 }}
                        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchData} colors={[APP_GREEN]} />}
                        ListEmptyComponent={
                            <View style={styles.empty}>
                                <Icon name="text-box-outline" size={64} color="#D1D5DB" />
                                <Text style={styles.emptyTitle}>No Entries Found</Text>
                                <Text style={styles.emptySub}>Inventory history for today will appear here.</Text>
                            </View>
                        }
                    />
                )}
            </View>

            {/* Void Confirmation Modal */}
            <Modal visible={voidModal.visible} transparent animationType="fade">
                <View style={styles.modalBg}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeaderIcon}>
                            <Icon name="alert-decagram" size={40} color="#EF4444" />
                        </View>
                        <Text style={styles.modalTitle}>Void This Movement?</Text>
                        <Text style={styles.modalSub}>
                            This will reverse the inventory impact of batch <Text style={{ fontWeight: '800', color: '#111827' }}>{voidModal.item?.batchId}</Text>. This action is irreversible.
                        </Text>

                        <TextInput
                            style={styles.input}
                            placeholder="Reason for audit (e.g. Data entry error)"
                            value={voidReason}
                            onChangeText={setVoidReason}
                            multiline
                            placeholderTextColor="#9CA3AF"
                        />

                        <View style={styles.modalBtns}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setVoidModal({ visible: false, item: null }); setVoidReason(""); }}>
                                <Text style={styles.cancelText}>Keep Entry</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.confirmBtn} onPress={handleVoid}>
                                <Text style={styles.confirmText}>Void & Reverse</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </OperatorLayout>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },

    summaryGrid: {
        flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 20,
        paddingVertical: 20, margin: 16, marginBottom: 8, elevation: 4,
        shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10,
        borderWidth: 1, borderColor: '#E5E7EB'
    },
    summaryItem: { flex: 1, alignItems: 'center', borderRightWidth: 1, borderColor: '#F3F4F6' },
    summaryLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
    summaryValue: { fontSize: 18, fontWeight: '900', color: '#111827', marginTop: 4 },

    filterScroll: { maxHeight: 50, paddingHorizontal: 16, marginVertical: 12 },
    filterChip: {
        paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12,
        backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E7EB'
    },
    filterChipActive: { backgroundColor: APP_GREEN, borderColor: APP_GREEN },
    filterText: { fontSize: 13, color: '#4B5563', fontWeight: '700' },
    filterTextActive: { color: '#FFF' },

    card: {
        backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginHorizontal: 16,
        marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5,
        borderWidth: 1, borderColor: '#E5E7EB'
    },
    voidedCard: { opacity: 0.5, backgroundColor: '#F3F4F6', filter: 'grayscale(1)' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
    badgeText: { fontSize: 10, fontWeight: '900' },
    timestamp: { fontSize: 12, color: '#9CA3AF', fontWeight: '600' },

    cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    batchId: { fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace', fontWeight: '600' },
    material: { fontSize: 18, fontWeight: '800', color: '#111827', marginTop: 4 },
    reasonBox: { marginTop: 8, padding: 8, backgroundColor: '#F9FAFB', borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#EF4444' },
    reasonText: { fontSize: 12, color: '#6B7280', fontStyle: 'italic' },

    weight: { fontSize: 20, fontWeight: '900' },
    opBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    operator: { fontSize: 9, color: '#6B7280', fontWeight: '700' },

    voidBtn: {
        marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6',
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6
    },
    voidBtnText: { color: '#EF4444', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },

    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
    empty: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
    emptyTitle: { fontSize: 18, fontWeight: '800', color: '#374151', marginTop: 16 },
    emptySub: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginTop: 8 },

    modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#FFF', borderRadius: 32, padding: 24, alignItems: 'center' },
    modalHeaderIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 22, fontWeight: '900', color: '#111827', marginBottom: 8 },
    modalSub: { color: '#6B7280', fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
    input: {
        width: '100%', backgroundColor: '#F3F4F6', borderRadius: 16, padding: 16,
        height: 100, textAlignVertical: 'top', color: '#111827', fontSize: 15, marginBottom: 24
    },
    modalBtns: { flexDirection: 'row', gap: 12, width: '100%' },
    cancelBtn: { flex: 1, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#F3F4F6' },
    cancelText: { color: '#4B5563', fontWeight: '800', fontSize: 15 },
    confirmBtn: { flex: 1, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#EF4444' },
    confirmText: { color: '#FFF', fontWeight: '800', fontSize: 15 }
});
