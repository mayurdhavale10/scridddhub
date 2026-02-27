import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { InventoryAPI } from '../../../../../services/inventory.service';

const TENANT_ID = 'demo-tenant';

export const AIRecommendations = ({ navigation }: any) => {
    const [loading, setLoading] = useState(true);
    const [recs, setRecs] = useState<any[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await InventoryAPI.getRecommendations(TENANT_ID);
            setRecs(data.recommendations || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const getPriorityColor = (p: string) => {
        switch (p) {
            case 'high': return '#FF5252';
            case 'medium': return '#FFAB40';
            default: return '#00E676';
        }
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>AI Specialist View</Text>
                <Text style={styles.headerSubtitle}>Optimization Engine Active</Text>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#D500F9" style={{ marginTop: 50 }} />
            ) : (
                <View style={styles.list}>
                    {recs.length === 0 && (
                        <Text style={styles.emptyText}>All systems optimal. No actions required.</Text>
                    )}

                    {recs.map((item, i) => (
                        <View key={i} style={[styles.card, { borderLeftColor: getPriorityColor(item.priority) }]}>
                            <View style={styles.cardHeader}>
                                <Text style={[styles.typeBadge, { color: getPriorityColor(item.priority) }]}>
                                    {item.type.toUpperCase()}
                                </Text>
                                <Text style={styles.priorityText}>{item.priority.toUpperCase()}</Text>
                            </View>

                            <Text style={styles.itemSku}>{item.itemId}</Text>
                            <Text style={styles.message}>{item.message}</Text>

                            {item.suggestedQty && (
                                <View style={styles.actionBlock}>
                                    <Text style={styles.actionLabel}>Suggestion:</Text>
                                    <Text style={styles.actionValue}>Order {item.suggestedQty} Units</Text>
                                </View>
                            )}

                            <TouchableOpacity
                                style={styles.actButton}
                                onPress={() => {
                                    if (item.type === 'reorder') {
                                        navigation.navigate('MovementForm', { type: 'receive' });
                                    }
                                }}
                            >
                                <Text style={styles.actText}>EXECUTE ACTION</Text>
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#100019' }, // Deep Purple tint for AI
    header: { padding: 20, paddingTop: 60, backgroundColor: '#2C1A4D' },
    headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#E1BEE7' },
    headerSubtitle: { color: '#AB47BC', marginTop: 5 },

    list: { padding: 15 },
    card: { backgroundColor: '#1E1E1E', borderRadius: 12, padding: 15, marginBottom: 15, borderLeftWidth: 4 },

    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    typeBadge: { fontWeight: 'bold', fontSize: 12 },
    priorityText: { color: '#666', fontSize: 10 },

    itemSku: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
    message: { color: '#ccc', marginBottom: 15 },

    actionBlock: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, backgroundColor: '#2a2a2a', padding: 8, borderRadius: 6 },
    actionLabel: { color: '#888', marginRight: 8 },
    actionValue: { color: '#00E676', fontWeight: 'bold' },

    actButton: { backgroundColor: '#D500F9', padding: 12, borderRadius: 8, alignItems: 'center' },
    actText: { color: '#fff', fontWeight: 'bold' },

    emptyText: { color: '#aaa', textAlign: 'center', marginTop: 50, fontSize: 16 }
});
