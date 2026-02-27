import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import OperatorLayout from "../../../dashboard/OperatorLayout";
import { getSplitAnalytics } from "../../../../../../../../shared/inventory/api";
import { SplitAnalytics } from "../../../../../../../../shared/inventory/types";

export default function SplitAnalyticsScreen({ navigation }: any) {
    const [data, setData] = useState<SplitAnalytics | null>(null);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        try {
            const res = await getSplitAnalytics("TENANT-001");
            if (res.success) {
                setData(res.data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const onRefresh = React.useCallback(() => {
        setLoading(true);
        loadData();
    }, []);

    if (loading && !data) {
        return (
            <OperatorLayout title="Yield Analytics" navigation={navigation}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#047857" />
                </View>
            </OperatorLayout>
        );
    }

    return (
        <OperatorLayout title="Yield Analytics" navigation={navigation}>
            <ScrollView
                contentContainerStyle={styles.container}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
            >
                {/* KPI Section */}
                <View style={styles.kpiRow}>
                    <View style={styles.kpiCard}>
                        <Text style={styles.kpiLabel}>AVG YIELD</Text>
                        <Text style={[styles.kpiValue, { color: (data?.globalYield || 0) > 90 ? '#10B981' : '#F59E0B' }]}>
                            {data?.globalYield.toFixed(1)}%
                        </Text>
                    </View>
                    <View style={styles.kpiCard}>
                        <Text style={styles.kpiLabel}>LOSS</Text>
                        <Text style={[styles.kpiValue, { color: '#EF4444' }]}>
                            {data?.totalLoss.toFixed(1)} <Text style={{ fontSize: 14 }}>kg</Text>
                        </Text>
                    </View>
                </View>

                <View style={styles.kpiRow}>
                    <View style={[styles.kpiCard, { flex: 1 }]}>
                        <Text style={styles.kpiLabel}>TOTAL PROCESSED</Text>
                        <Text style={styles.kpiValue}>{data?.totalProcessed.toFixed(0)} <Text style={{ fontSize: 14 }}>kg</Text></Text>
                    </View>
                </View>

                {/* Machine Performance */}
                <Text style={styles.sectionTitle}>Machine Efficiency</Text>
                {data?.machineStats.map(m => (
                    <View key={m.machineId} style={styles.machineCard}>
                        <View>
                            <Text style={styles.machineName}>{m.machineId}</Text>
                            <Text style={styles.machineSub}>{m.processed.toFixed(0)} kg processed</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[styles.yieldValue, { color: m.yield > 90 ? '#10B981' : m.yield > 80 ? '#F59E0B' : '#EF4444' }]}>
                                {m.yield.toFixed(1)}%
                            </Text>
                            <Text style={styles.yieldLabel}>Yield</Text>
                        </View>
                    </View>
                ))}

                {/* Supplier Performance */}
                <Text style={styles.sectionTitle}>Supplier Quality</Text>
                {data?.supplierStats?.map(s => (
                    <View key={s.supplierId} style={styles.machineCard}>
                        <View>
                            <Text style={styles.machineName}>{s.supplierId}</Text>
                            <Text style={styles.machineSub}>{s.processed.toFixed(0)} kg processed • {s.loss.toFixed(1)} kg loss</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[styles.yieldValue, { color: s.yield > 90 ? '#10B981' : s.yield > 80 ? '#F59E0B' : '#EF4444' }]}>
                                {s.yield.toFixed(1)}%
                            </Text>
                            <Text style={styles.yieldLabel}>Yield</Text>
                        </View>
                    </View>
                ))}

                {/* Recent History */}
                <Text style={styles.sectionTitle}>Recent Jobs</Text>
                {data?.recentSplits.map(tx => (
                    <View key={tx.split_id} style={styles.historyCard}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                            <Text style={styles.txId}>{tx.split_id}</Text>
                            <Text style={styles.txDate}>{new Date(tx.created_at).toLocaleDateString()}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View>
                                <Text style={styles.txInfo}>In: {tx.input_weight} kg</Text>
                                <Text style={styles.txInfo}>Out: {tx.output_weight} kg</Text>
                            </View>
                            <View>
                                {tx.loss_weight > 0 && <Text style={styles.txLoss}>Loss: {tx.loss_weight.toFixed(1)} kg</Text>}
                                <Text style={styles.txMachine}>{tx.machine_id || 'Unknown Machine'}</Text>
                            </View>
                        </View>
                    </View>
                ))}
            </ScrollView>
        </OperatorLayout>
    );
}

const styles = StyleSheet.create({
    container: { padding: 20 },
    kpiRow: { flexDirection: 'row', gap: 15, marginBottom: 15 },
    kpiCard: { flex: 1, backgroundColor: '#FFF', padding: 20, borderRadius: 12, elevation: 2, alignItems: 'center' },
    kpiLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 5, letterSpacing: 0.5 },
    kpiValue: { fontSize: 28, fontWeight: '800', color: '#111' },

    sectionTitle: { fontSize: 18, fontWeight: '800', color: '#374151', marginTop: 20, marginBottom: 15 },

    machineCard: { backgroundColor: '#FFF', padding: 15, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, elevation: 1 },
    machineName: { fontSize: 16, fontWeight: '700', color: '#111' },
    machineSub: { fontSize: 12, color: '#6B7280' },
    yieldValue: { fontSize: 20, fontWeight: '800' },
    yieldLabel: { fontSize: 10, color: '#9CA3AF' },

    historyCard: { backgroundColor: '#F9FAFB', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
    txId: { fontSize: 10, fontFamily: 'monospace', color: '#9CA3AF' },
    txDate: { fontSize: 10, color: '#9CA3AF' },
    txInfo: { fontSize: 13, fontWeight: '600', color: '#374151' },
    txLoss: { fontSize: 12, color: '#EF4444', fontWeight: '700', marginBottom: 2 },
    txMachine: { fontSize: 10, color: '#6B7280', fontStyle: 'italic', textAlign: 'right' }
});
