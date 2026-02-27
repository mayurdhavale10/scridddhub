import React, { useEffect, useState, useRef } from "react";
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator,
    TouchableOpacity, TextInput, Alert, Modal, RefreshControl,
    StatusBar, Animated
} from "react-native";
import OperatorLayout from "../../../dashboard/OperatorLayout";
import { getWeighEntries, deleteWeighEntry, updateWeighEntry, createWeighEntry } from "../../../../../../../../shared/inventory/api";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

const APP_GREEN = '#1B6B2F';
const APP_GREEN_LIGHT = '#E8F5E9';

type ReportGroup = {
    date: string;
    totalWeight: number;
    items: any[];
};

export default function DailyReportScreen({ navigation }: any) {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [report, setReport] = useState<ReportGroup[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [rawLogs, setRawLogs] = useState<any[]>([]);

    // Filter Stats
    const [showFilter, setShowFilter] = useState(false);
    const [filterIntake, setFilterIntake] = useState("");

    // Quick Add Modal
    const [showAddModal, setShowAddModal] = useState(false);
    const [newEntry, setNewEntry] = useState({ materialId: '', supplierId: '', weight: '' });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        processReport(rawLogs);
    }, [searchQuery, rawLogs, filterIntake]);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await getWeighEntries("TENANT-001");
            if (res.success) {
                setRawLogs(res.data || []);
            }
        } catch (error: any) {
            Alert.alert("Connection Error", "Could not reach server. Please check your network.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const processReport = (allLogs: any[]) => {
        const query = searchQuery.toLowerCase();
        const logs = allLogs.filter(log => {
            const matchesSearch = !searchQuery || (
                log.material_id?.toLowerCase().includes(query) ||
                log.batch_id?.toLowerCase().includes(query) ||
                log.supplier_id?.toLowerCase().includes(query)
            );
            const matchesIntake = !filterIntake || log.intake_type === filterIntake;
            return matchesSearch && matchesIntake;
        });

        const groups: Record<string, ReportGroup> = {};
        logs.forEach(log => {
            const dateObj = new Date(log.created_at);
            const key = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            if (!groups[key]) groups[key] = { date: key, totalWeight: 0, items: [] };
            groups[key].totalWeight += (Number(log.net_weight) || 0);
            groups[key].items.push(log);
        });

        setReport(Object.values(groups).sort((a, b) =>
            new Date(b.items[0].created_at).getTime() - new Date(a.items[0].created_at).getTime()
        ));
    };

    const handleDelete = (batchId: string) => {
        Alert.alert(
            "Delete Entry",
            `Are you sure you want to delete ${batchId}? This action cannot be undone.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete", style: "destructive", onPress: async () => {
                        try {
                            await deleteWeighEntry("TENANT-001", batchId);
                            loadData();
                        } catch (e) { Alert.alert("Error", "Failed to delete."); }
                    }
                }
            ]
        );
    };

    const handleQuickAdd = async () => {
        if (!newEntry.materialId || !newEntry.weight) return Alert.alert("Missing Details", "Material and weight are required.");
        setSubmitting(true);
        try {
            await createWeighEntry({
                materialId: newEntry.materialId,
                supplierId: newEntry.supplierId || "Cash Purchase",
                grossWeight: Number(newEntry.weight),
                tareWeight: 0,
                weighMethod: "manual",
                intakeType: "purchase",
                yardId: "YARD-001",
                employeeId: "MGR-01"
            }, "TENANT-001");
            setShowAddModal(false);
            setNewEntry({ materialId: '', supplierId: '', weight: '' });
            loadData();
        } catch (e: any) {
            Alert.alert("Save Error", e.message || "Could not save entry.");
        } finally {
            setSubmitting(false);
        }
    };

    const EntryCard = ({ item }: { item: any }) => (
        <View style={styles.entryCard}>
            <View style={styles.cardMain}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardBatchId}>{item.batch_id}</Text>
                    <View style={[styles.statusBadge, {
                        backgroundColor: item.qc_status === 'pass' ? '#DCFCE7' : item.qc_status === 'reject' ? '#FEE2E2' : '#FEF3C7'
                    }]}>
                        <Text style={[styles.statusText, {
                            color: item.qc_status === 'pass' ? '#166534' : item.qc_status === 'reject' ? '#991B1B' : '#92400E'
                        }]}>
                            {item.qc_status?.toUpperCase() || 'PENDING'}
                        </Text>
                    </View>
                </View>

                <View style={styles.cardRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.cardMaterial}>{item.material_id}</Text>
                        <Text style={styles.cardSupplier}>{item.supplier_id || 'Walk-in Customer'}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.cardWeight}>{item.net_weight.toLocaleString()} kg</Text>
                        <Text style={styles.cardTime}>
                            {new Date(item.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </View>
                </View>
            </View>

            <View style={styles.cardFooter}>
                <View style={styles.intakeType}>
                    <Icon name={item.intake_type === 'purchase' ? 'wallet-outline' : 'swap-horizontal'} size={14} color="#6B7280" />
                    <Text style={styles.intakeLabel}>{item.intake_type?.toUpperCase()}</Text>
                </View>
                <View style={styles.actions}>
                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => navigation.navigate('QCInspectionScreen', { batchId: item.batch_id, logData: item })}
                    >
                        <Icon name="clipboard-check-outline" size={18} color={APP_GREEN} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item.batch_id)}>
                        <Icon name="trash-can-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    return (
        <OperatorLayout title="Journal & Reports" navigation={navigation} showBack={true}>
            <StatusBar barStyle="dark-content" />
            <View style={styles.root}>

                {/* --- Search & Tools Header --- */}
                <View style={styles.toolbar}>
                    <View style={styles.searchBox}>
                        <Icon name="magnify" size={20} color="#ABABAB" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Find by Material or ID..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholderTextColor="#ABABAB"
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery("")}>
                                <Icon name="close-circle" size={18} color="#ABABAB" />
                            </TouchableOpacity>
                        )}
                    </View>
                    <TouchableOpacity
                        style={[styles.toolBtn, showFilter && styles.toolBtnActive]}
                        onPress={() => setShowFilter(!showFilter)}
                    >
                        <Icon name="filter-variant" size={20} color={showFilter ? "#FFF" : "#4B5563"} />
                    </TouchableOpacity>
                </View>

                {/* --- Filters Panel --- */}
                {showFilter && (
                    <View style={styles.filterBar}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                            {['', 'purchase', 'internal'].map(t => (
                                <TouchableOpacity
                                    key={t}
                                    style={[styles.filterChip, filterIntake === t && styles.filterChipActive]}
                                    onPress={() => setFilterIntake(t)}
                                >
                                    <Text style={[styles.filterChipText, filterIntake === t && styles.filterChipTextActive]}>
                                        {t === '' ? 'Everything' : t.toUpperCase()}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {loading && !refreshing ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={APP_GREEN} />
                        <Text style={styles.loadingText}>Fetching entries...</Text>
                    </View>
                ) : (
                    <ScrollView
                        style={{ flex: 1 }}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} colors={[APP_GREEN]} />}
                        contentContainerStyle={{ paddingBottom: 100 }}
                    >
                        {report.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Icon name="text-box-search-outline" size={64} color="#D1D5DB" />
                                <Text style={styles.emptyTitle}>No Entries Found</Text>
                                <Text style={styles.emptySub}>Try adjusting your search or filters.</Text>
                            </View>
                        ) : (
                            report.map((group) => (
                                <View key={group.date} style={styles.dateGroup}>
                                    <View style={styles.dateHeader}>
                                        <Text style={styles.dateText}>{group.date}</Text>
                                        <View style={styles.dateSum}>
                                            <Icon name="scale" size={14} color="#6B7280" style={{ marginRight: 4 }} />
                                            <Text style={styles.dateSumText}>{group.totalWeight.toLocaleString()} kg</Text>
                                        </View>
                                    </View>
                                    {group.items.map(item => <EntryCard key={item.batch_id} item={item} />)}
                                </View>
                            ))
                        )}
                    </ScrollView>
                )}

                {/* --- Floating Action Button --- */}
                <TouchableOpacity style={styles.fab} onPress={() => setShowAddModal(true)}>
                    <Icon name="plus" size={28} color="#FFF" />
                </TouchableOpacity>

                {/* --- Quick Entry Modal --- */}
                <Modal visible={showAddModal} transparent animationType="fade">
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalBox}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Quick Manual Entry</Text>
                                <TouchableOpacity onPress={() => setShowAddModal(false)}>
                                    <Icon name="close" size={24} color="#4B5563" />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Material Name</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="e.g. Copper Scrap"
                                    value={newEntry.materialId}
                                    onChangeText={m => setNewEntry({ ...newEntry, materialId: m })}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Weight (kg)</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="0"
                                    keyboardType="numeric"
                                    value={newEntry.weight}
                                    onChangeText={w => setNewEntry({ ...newEntry, weight: w })}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Supplier (Optional)</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="e.g. Acme Traders"
                                    value={newEntry.supplierId}
                                    onChangeText={s => setNewEntry({ ...newEntry, supplierId: s })}
                                />
                            </View>

                            <TouchableOpacity
                                style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                                onPress={handleQuickAdd}
                                disabled={submitting}
                            >
                                {submitting ? <ActivityIndicator color="#FFF" /> : (
                                    <>
                                        <Icon name="check" size={20} color="#FFF" style={{ marginRight: 8 }} />
                                        <Text style={styles.submitBtnText}>Save Entry</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            </View>
        </OperatorLayout>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F9FAFB' },
    toolbar: {
        flexDirection: 'row', padding: 16, backgroundColor: '#FFF',
        borderBottomWidth: 1, borderBottomColor: '#E5E7EB', gap: 12, alignItems: 'center'
    },
    searchBox: {
        flex: 1, flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 12, height: 44
    },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: '#111827', padding: 0 },
    toolBtn: {
        width: 44, height: 44, borderRadius: 12, backgroundColor: '#F3F4F6',
        justifyContent: 'center', alignItems: 'center'
    },
    toolBtnActive: { backgroundColor: APP_GREEN },

    filterBar: { backgroundColor: '#FFF', paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
    filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6' },
    filterChipActive: { backgroundColor: APP_GREEN_LIGHT },
    filterChipText: { fontSize: 13, fontWeight: '700', color: '#4B5563' },
    filterChipTextActive: { color: APP_GREEN },

    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
    loadingText: { marginTop: 12, color: '#6B7280', fontSize: 14 },

    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
    emptyTitle: { fontSize: 18, fontWeight: '800', color: '#374151', marginTop: 16 },
    emptySub: { fontSize: 14, color: '#6B7280', marginTop: 4 },

    dateGroup: { marginTop: 12 },
    dateHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 8
    },
    dateText: { fontSize: 12, fontWeight: '800', color: '#9CA3AF', letterSpacing: 0.5 },
    dateSum: { flexDirection: 'row', alignItems: 'center' },
    dateSumText: { fontSize: 12, fontWeight: '700', color: '#6B7280' },

    entryCard: {
        backgroundColor: '#FFF', marginHorizontal: 16, marginBottom: 12,
        borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB',
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05, shadowRadius: 4, elevation: 2
    },
    cardMain: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' },
    cardBatchId: { fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    statusText: { fontSize: 10, fontWeight: '800' },

    cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardMaterial: { fontSize: 18, fontWeight: '800', color: '#111827' },
    cardSupplier: { fontSize: 13, color: '#6B7280', marginTop: 2 },
    cardWeight: { fontSize: 20, fontWeight: '900', color: APP_GREEN },
    cardTime: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },

    cardFooter: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#F9FAFB',
        borderBottomLeftRadius: 16, borderBottomRightRadius: 16
    },
    intakeType: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    intakeLabel: { fontSize: 11, fontWeight: '700', color: '#6B7280' },
    actions: { flexDirection: 'row', gap: 12 },
    actionBtn: {
        width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFF',
        borderWidth: 1, borderColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center'
    },

    fab: {
        position: 'absolute', bottom: 24, right: 24, width: 60, height: 60,
        borderRadius: 30, backgroundColor: APP_GREEN, elevation: 6,
        justifyContent: 'center', alignItems: 'center', shadowColor: APP_GREEN,
        shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8
    },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
    modalBox: { backgroundColor: '#FFF', borderRadius: 24, padding: 24 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    modalTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
    inputGroup: { marginBottom: 20 },
    inputLabel: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8 },
    modalInput: {
        backgroundColor: '#F3F4F6', borderRadius: 12, padding: 14,
        fontSize: 16, color: '#111827', borderWidth: 1, borderColor: '#E5E7EB'
    },
    submitBtn: {
        backgroundColor: APP_GREEN, borderRadius: 16, padding: 16,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8
    },
    submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' }
});