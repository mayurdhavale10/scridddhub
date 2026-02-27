import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, RefreshControl } from "react-native";
import OperatorLayout from "../../dashboard/OperatorLayout";
import { getWeighEntries, deleteWeighEntry } from "../../../../../../../shared/inventory/api";
import { useFocusEffect } from '@react-navigation/native';

export default function QCListScreen({ navigation }: any) {
    const [loading, setLoading] = useState(true);
    const [pendingLogs, setPendingLogs] = useState<any[]>([]);

    const fetchPendingQC = async () => {
        setLoading(true);
        try {
            const res = await getWeighEntries("TENANT-001");
            if (res.success && Array.isArray(res.data)) {
                // Filter for "pending" status (or undefined for legacy items)
                const filtered = res.data.filter((log: any) => log.qc_status === 'pending' || !log.qc_status);
                setPendingLogs(filtered);
            }
        } catch (e) {
            console.error("Failed to fetch QC list", e);
            Alert.alert("Error", "Could not load pending QC items");
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        React.useCallback(() => {
            fetchPendingQC();
        }, [])
    );

    const handleDelete = (batchId: string) => {
        Alert.alert(
            "Delete Batch",
            "Are you sure you want to delete this pending item?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete", style: "destructive", onPress: async () => {
                        try {
                            setLoading(true);
                            await deleteWeighEntry("TENANT-001", batchId);
                            fetchPendingQC();
                        } catch (e: any) {
                            Alert.alert("Error", "Failed to delete item");
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    return (
        <OperatorLayout title="Pending QC Inspection" navigation={navigation}>
            <View style={styles.container}>
                {loading ? (
                    <ActivityIndicator size="large" color="#1D7A27" />
                ) : pendingLogs.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={{ fontSize: 40, marginBottom: 10 }}>✅</Text>
                        <Text style={styles.emptyText}>All Caught Up!</Text>
                        <Text style={styles.emptySub}>No pending items for Quality Control.</Text>
                    </View>
                ) : (
                    <ScrollView
                        contentContainerStyle={{ paddingBottom: 50 }}
                        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchPendingQC} colors={['#1D7A27']} />}
                    >
                        {pendingLogs.map((log) => (
                            <TouchableOpacity
                                key={log.batch_id}
                                style={styles.card}
                                onPress={() => navigation.navigate("QCInspectionScreen", { batchId: log.batch_id, logData: log })}
                            >
                                <View style={styles.cardHeader}>
                                    <View>
                                        <Text style={styles.batchId}>{log.batch_id}</Text>
                                        <Text style={styles.highlight}>{log.gross_weight} {log.unit || 'kg'}</Text>
                                    </View>
                                    <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(log.batch_id)}>
                                        <Text style={{ fontSize: 18 }}>🗑️</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.row}>
                                    <Text style={styles.label}>Material:</Text>
                                    <Text style={styles.value}>{log.material_id}</Text>
                                </View>
                                <View style={styles.row}>
                                    <Text style={styles.label}>Supplier:</Text>
                                    <Text style={styles.value}>{log.supplier_id}</Text>
                                </View>
                                <View style={styles.row}>
                                    <Text style={styles.label}>Date:</Text>
                                    <Text style={styles.value}>{new Date(log.created_at).toLocaleDateString()}</Text>
                                </View>

                                {/* Show Flags if custom values indicate issues */}
                                {log.custom_values && (
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                                        {Object.entries(log.custom_values).slice(0, 3).map(([k, v]) => (
                                            <View key={k} style={styles.tag}>
                                                <Text style={styles.tagText}>{k}: {String(v)}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}
            </View>
        </OperatorLayout>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20 },
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { fontSize: 20, fontWeight: '700', color: '#111' },
    emptySub: { fontSize: 14, color: '#666', marginTop: 5 },
    card: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, alignItems: 'flex-start' },
    deleteBtn: { padding: 8, backgroundColor: '#FEE2E2', borderRadius: 8 },
    batchId: { fontSize: 12, color: '#9CA3AF', fontFamily: 'monospace' },
    highlight: { fontSize: 16, fontWeight: '800', color: '#1D7A27' },
    row: { flexDirection: 'row', marginBottom: 4 },
    label: { width: 70, fontSize: 13, color: '#6B7280', fontWeight: '600' },
    value: { flex: 1, fontSize: 13, color: '#111', fontWeight: '600' },
    tag: { backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    tagText: { fontSize: 10, color: '#4B5563' }
});
