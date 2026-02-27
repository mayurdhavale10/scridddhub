import React, { useState, useEffect } from "react";
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    TextInput, Alert, Modal, ActivityIndicator, RefreshControl,
    StatusBar
} from "react-native";
import OperatorLayout from "../../../dashboard/OperatorLayout";
import { getStockLots, getInventorySettings, splitStock, deleteStockLot } from "../../../../../../../../shared/inventory/api";
import { StockLot, StockStatus } from "../../../../../../../../shared/inventory/types";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

const APP_GREEN = '#1B6B2F';
const APP_GREEN_LIGHT = '#E8F5E9';

export default function SplitScreen({ navigation }: any) {
    // State
    const [lots, setLots] = useState<StockLot[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [materials, setMaterials] = useState<string[]>([]);

    // Split Form State
    const [selectedLot, setSelectedLot] = useState<StockLot | null>(null);
    const [splitRows, setSplitRows] = useState([{ materialId: "", weight: "" }]);
    const [processing, setProcessing] = useState(false);

    // V2 Machine Tracking
    const [machines, setMachines] = useState<string[]>([]);
    const [selectedMachine, setSelectedMachine] = useState<string | null>(null);

    // V3 Loss Reasoning
    const [lossReasons, setLossReasons] = useState<string[]>([]);
    const [selectedReason, setSelectedReason] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [stockRes, settingsRes] = await Promise.all([
                getStockLots("TENANT-001"),
                getInventorySettings("TENANT-001")
            ]);

            const stockData = stockRes.data || stockRes;
            const validLots = Array.isArray(stockData) ? stockData.filter((l: StockLot) =>
                l.status === StockStatus.Stored && (Number(l.available_weight) || 0) > 0
            ) : [];

            setLots(validLots);
            setMaterials(settingsRes.materials || []);
            setMachines(settingsRes.machines || []);
            setLossReasons(settingsRes.loss_reasons || ["Contamination", "Moisture", "Processing Waste"]);
        } catch (e) {
            Alert.alert("Error", "Failed to load stock for processing.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const openSplit = (lot: StockLot) => {
        setSelectedLot(lot);
        setSelectedMachine(null);
        setSelectedReason(null);
        setSplitRows([{ materialId: lot.material_id, weight: "" }]);
    };

    const addRow = () => {
        setSplitRows([...splitRows, { materialId: selectedLot?.material_id || "", weight: "" }]);
    };

    const removeRow = (idx: number) => {
        const newRows = [...splitRows];
        newRows.splice(idx, 1);
        setSplitRows(newRows);
    };

    const updateRow = (idx: number, field: string, value: string) => {
        const newRows = [...splitRows];
        (newRows[idx] as any)[field] = value;
        setSplitRows(newRows);
    };

    const calculateTotal = () => {
        return splitRows.reduce((sum, row) => sum + (Number(row.weight) || 0), 0);
    };

    const handleSplit = async () => {
        if (!selectedLot) return;

        const total = calculateTotal();
        const available = selectedLot.available_weight;
        const diff = available - total;
        const lossPercentage = available > 0 ? (Math.max(0, diff) / available) * 100 : 0;

        if (diff < -0.01) {
            Alert.alert("Weight Mismatch", `The total of split parts (${total}kg) cannot be more than the source lot (${available}kg).`);
            return;
        }

        if (lossPercentage > 5 && !selectedReason) {
            Alert.alert("Reason Required", `You reported a loss of ${lossPercentage.toFixed(1)}%. Please pick a reason.`);
            return;
        }

        Alert.alert(
            "Confirm Processing",
            `Split ${available}kg of ${selectedLot.material_id} into ${splitRows.length} parts?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Process & Create Lots",
                    onPress: async () => {
                        setProcessing(true);
                        try {
                            await splitStock("TENANT-001", {
                                sourceLotId: selectedLot.lot_id,
                                splits: splitRows.map(r => ({ materialId: r.materialId, weight: Number(r.weight) })),
                                machineId: selectedMachine || undefined,
                                lossReason: selectedReason || undefined
                            });
                            Alert.alert("Success", "Material processed and stock updated!");
                            setSelectedLot(null);
                            fetchData();
                        } catch (e: any) {
                            Alert.alert("Error", e.message || "Split failed");
                        } finally {
                            setProcessing(false);
                        }
                    }
                }
            ]
        );
    };

    return (
        <OperatorLayout title="Process & Grade" navigation={navigation} showBack={true}>
            <StatusBar barStyle="dark-content" />
            <View style={styles.container}>

                {/* --- Header Tools --- */}
                <View style={styles.topTools}>
                    <Text style={styles.statsLabel}>{lots.length} Lots Available</Text>
                    <TouchableOpacity
                        style={styles.analyticsBtn}
                        onPress={() => navigation.navigate("SplitAnalytics")}
                    >
                        <Icon name="chart-bell-curve-cumulative" size={16} color={APP_GREEN} />
                        <Text style={styles.analyticsText}>Analytics</Text>
                    </TouchableOpacity>
                </View>

                {loading && !refreshing ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={APP_GREEN} />
                    </View>
                ) : (
                    <ScrollView
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} colors={[APP_GREEN]} />}
                        contentContainerStyle={{ paddingBottom: 100 }}
                    >
                        {lots.length === 0 ? (
                            <View style={styles.empty}>
                                <Icon name="package-variant" size={60} color="#D1D5DB" />
                                <Text style={styles.emptyText}>No Stock to Process</Text>
                                <Text style={styles.emptySub}>Approved lots from QC will appear here.</Text>
                            </View>
                        ) : (
                            lots.map(lot => (
                                <View key={lot.lot_id} style={styles.lotCardContainer}>
                                    <TouchableOpacity style={styles.lotCard} onPress={() => openSplit(lot)}>
                                        <View style={{ flex: 1 }}>
                                            <View style={styles.lotHeader}>
                                                <Text style={styles.lotId}>{lot.lot_id}</Text>
                                                <Text style={styles.lotBatch}>{lot.batch_id}</Text>
                                            </View>
                                            <Text style={styles.lotMaterial}>{lot.material_id}</Text>
                                            <View style={styles.lotInfoRow}>
                                                <Icon name="clock-outline" size={12} color="#9CA3AF" />
                                                <Text style={styles.lotInfoText}>Entered {new Date(lot.created_at || Date.now()).toLocaleDateString()}</Text>
                                            </View>
                                        </View>
                                        <View style={styles.lotWeightBox}>
                                            <Text style={styles.lotWeight}>{lot.available_weight.toLocaleString()} kg</Text>
                                            <View style={styles.splitTag}>
                                                <Text style={styles.splitTagText}>TAP TO SPLIT</Text>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                </View>
                            ))
                        )}
                    </ScrollView>
                )}
            </View>

            {/* --- Split Modal --- */}
            <Modal visible={!!selectedLot} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Process Material</Text>
                                <Text style={styles.modalSub}>{selectedLot?.lot_id} • {selectedLot?.available_weight}kg</Text>
                            </View>
                            <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedLot(null)}>
                                <Icon name="close" size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                            {/* Machine Picker */}
                            <Text style={styles.sectionLabel}>PROCESSING MACHINE (OPTIONAL)</Text>
                            <View style={styles.chipRow}>
                                {machines.map(m => (
                                    <TouchableOpacity
                                        key={m}
                                        style={[styles.chip, selectedMachine === m && styles.chipActive]}
                                        onPress={() => setSelectedMachine(m === selectedMachine ? null : m)}
                                    >
                                        <Text style={[styles.chipText, selectedMachine === m && styles.chipTextActive]}>{m}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={[styles.sectionLabel, { marginTop: 24 }]}>OUTPUT GRADES / PRODUCTS</Text>
                            {splitRows.map((row, idx) => (
                                <View key={idx} style={styles.splitRow}>
                                    <View style={{ flex: 1 }}>
                                        <TextInput
                                            style={styles.splitInput}
                                            value={row.materialId}
                                            onChangeText={v => updateRow(idx, 'materialId', v)}
                                            placeholder="Material Name"
                                        />
                                    </View>
                                    <View style={{ width: 100, marginLeft: 12 }}>
                                        <TextInput
                                            style={[styles.splitInput, { fontWeight: '800', color: APP_GREEN }]}
                                            value={row.weight}
                                            keyboardType="numeric"
                                            onChangeText={v => updateRow(idx, 'weight', v)}
                                            placeholder="Weight"
                                        />
                                    </View>
                                    {splitRows.length > 1 && (
                                        <TouchableOpacity onPress={() => removeRow(idx)} style={styles.removeBtn}>
                                            <Icon name="minus-circle-outline" size={24} color="#EF4444" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ))}

                            <TouchableOpacity onPress={addRow} style={styles.addBtn}>
                                <Icon name="plus" size={18} color={APP_GREEN} />
                                <Text style={styles.addBtnText}>Add Another Grade</Text>
                            </TouchableOpacity>

                            {/* Loss Validation */}
                            {(() => {
                                const total = calculateTotal();
                                const loss = (selectedLot?.available_weight || 0) - total;
                                const pct = (selectedLot?.available_weight || 0) > 0 ? (loss / (selectedLot?.available_weight || 1)) * 100 : 0;

                                if (pct > 5) {
                                    return (
                                        <View style={styles.lossWarn}>
                                            <View style={styles.lossWarnHeader}>
                                                <Icon name="alert-circle" size={18} color="#B91C1C" />
                                                <Text style={styles.lossWarnTitle}>High Content Loss Detected ({pct.toFixed(1)}%)</Text>
                                            </View>
                                            <Text style={styles.lossWarnSub}>Please select a primary reason for this variance:</Text>
                                            <View style={styles.chipRow}>
                                                {lossReasons.map(r => (
                                                    <TouchableOpacity key={r}
                                                        style={[styles.chip, { borderColor: '#FCA5A5' }, selectedReason === r && styles.chipActiveRed]}
                                                        onPress={() => setSelectedReason(r === selectedReason ? null : r)}
                                                    >
                                                        <Text style={[styles.chipText, selectedReason === r && styles.chipTextActive]}>{r}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </View>
                                    );
                                }
                                return null;
                            })()}
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <View style={styles.summaryRow}>
                                <Text style={styles.totalLabel}>Total Output</Text>
                                <Text style={[styles.totalValue, calculateTotal() > (selectedLot?.available_weight || 0) && { color: '#EF4444' }]}>
                                    {calculateTotal()} / {selectedLot?.available_weight} kg
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={[styles.confirmBtn, (processing || calculateTotal() <= 0) && { opacity: 0.6 }]}
                                onPress={handleSplit}
                                disabled={processing || calculateTotal() <= 0}
                            >
                                {processing ? <ActivityIndicator color="#FFF" /> : (
                                    <>
                                        <Icon name="check-all" size={20} color="#FFF" style={{ marginRight: 8 }} />
                                        <Text style={styles.confirmBtnText}>Confirm Process</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </OperatorLayout>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB', padding: 16 },
    topTools: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    statsLabel: { fontSize: 13, fontWeight: '700', color: '#9CA3AF' },
    analyticsBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: APP_GREEN_LIGHT, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    analyticsText: { marginLeft: 6, fontSize: 12, fontWeight: '800', color: APP_GREEN },

    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 120 },
    emptyText: { fontSize: 18, fontWeight: '800', color: '#374151', marginTop: 16 },
    emptySub: { fontSize: 13, color: '#6B7280', marginTop: 4 },

    lotCardContainer: { marginBottom: 16 },
    lotCard: {
        backgroundColor: '#FFF', borderRadius: 20, padding: 16,
        flexDirection: 'row', alignItems: 'center',
        borderWidth: 1, borderColor: '#E5E7EB', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5
    },
    lotHeader: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 4 },
    lotId: { fontSize: 11, fontWeight: '600', color: '#9CA3AF', fontFamily: 'monospace' },
    lotBatch: { fontSize: 10, color: '#D1D5DB' },
    lotMaterial: { fontSize: 20, fontWeight: '800', color: '#111827' },
    lotInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    lotInfoText: { fontSize: 11, color: '#9CA3AF' },

    lotWeightBox: { alignItems: 'flex-end', minWidth: 100 },
    lotWeight: { fontSize: 22, fontWeight: '900', color: APP_GREEN },
    splitTag: { backgroundColor: APP_GREEN_LIGHT, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 6 },
    splitTagText: { fontSize: 9, fontWeight: '900', color: APP_GREEN },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalBox: { backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    modalTitle: { fontSize: 22, fontWeight: '900', color: '#111827' },
    modalSub: { fontSize: 14, color: '#6B7280', marginTop: 2 },
    closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },

    modalBody: { flexGrow: 0 },
    sectionLabel: { fontSize: 11, fontWeight: '900', color: '#9CA3AF', marginBottom: 12, letterSpacing: 1 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E7EB' },
    chipActive: { backgroundColor: APP_GREEN, borderColor: APP_GREEN },
    chipActiveRed: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
    chipText: { fontSize: 13, fontWeight: '700', color: '#4B5563' },
    chipTextActive: { color: '#FFF' },

    splitRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    splitInput: { backgroundColor: '#F3F4F6', borderRadius: 12, padding: 14, fontSize: 15, color: '#111827', borderWidth: 1, borderColor: '#E5E7EB' },
    removeBtn: { marginLeft: 8 },

    addBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        padding: 14, borderRadius: 12, borderStyle: 'dashed', borderWidth: 2, borderColor: '#D1D5DB', marginTop: 8
    },
    addBtnText: { marginLeft: 8, fontSize: 14, fontWeight: '800', color: APP_GREEN },

    lossWarn: { marginTop: 24, padding: 20, backgroundColor: '#FEF2F2', borderRadius: 20, borderWidth: 1, borderColor: '#FEE2E2' },
    lossWarnHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    lossWarnTitle: { fontSize: 14, fontWeight: '800', color: '#B91C1C' },
    lossWarnSub: { fontSize: 12, color: '#991B1B', marginBottom: 12 },

    modalFooter: { marginTop: 32, paddingBottom: 16 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    totalLabel: { fontSize: 14, fontWeight: '700', color: '#6B7280' },
    totalValue: { fontSize: 18, fontWeight: '900', color: '#111827' },
    confirmBtn: { backgroundColor: APP_GREEN, borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    confirmBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 }
});
