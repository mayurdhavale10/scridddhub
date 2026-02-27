import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    FlatList, Modal, Alert, ActivityIndicator, StatusBar
} from 'react-native';
import { getStockLots, fulfillSalesOrder, suggestFIFOAllocation } from '../../../../../../../../shared/inventory/api';
import { StockLot, StockStatus, SalesOrderItem } from '../../../../../../../../shared/inventory/types';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const TENANT = 'TENANT-001';

interface PickedLot {
    lot_id: string;
    weight_picked: number;  // Exact kg to take from this lot
}

interface ItemPickState {
    pickedLots: PickedLot[];
    autoFilled: boolean;    // Was this filled by FIFO auto?
}

export default function FulfillOrder({ route, navigation }: any) {
    const { orderId, orderItems } = route.params;
    const [stock, setStock] = useState<StockLot[]>([]);
    const [loading, setLoading] = useState(true);
    const [dispatching, setDispatching] = useState(false);

    // Per-item pick state
    const [pickState, setPickState] = useState<Record<string, ItemPickState>>({});

    // Which item's modal is open?
    const [modalItem, setModalItem] = useState<SalesOrderItem | null>(null);
    const [tempPicked, setTempPicked] = useState<PickedLot[]>([]);
    const [autoFilling, setAutoFilling] = useState(false);

    useEffect(() => { loadStock(); }, []);

    const loadStock = async () => {
        try {
            const res = await getStockLots(TENANT);
            const all: StockLot[] = Array.isArray(res.data) ? res.data : [];
            // Keep only stored lots, sorted FIFO (oldest first)
            const stored = all
                .filter(l => l.status === StockStatus.Stored && l.available_weight > 0)
                .sort((a, b) => {
                    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
                    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
                    return ta - tb; // Ascending = oldest first
                });
            setStock(stored);
        } catch (e) {
            console.error('Load stock failed:', e);
        } finally {
            setLoading(false);
        }
    };

    // --------------------------------------------------------------
    // AUTO-FILL: Call backend FIFO suggestion and apply for one item
    // --------------------------------------------------------------
    const autoFillItem = async (item: SalesOrderItem) => {
        setAutoFilling(true);
        try {
            const res = await suggestFIFOAllocation(TENANT, item.material_id, item.ordered_weight);
            if (!res.success || !res.data?.plan) {
                Alert.alert('FIFO Error', 'Could not get suggestion from server');
                return;
            }

            const { plan, missingWeight } = res.data;

            // Convert backend plan → PickedLot[]
            const newPicked: PickedLot[] = plan.map((p: any) => ({
                lot_id: p.lotId,
                weight_picked: p.weightToPick
            }));

            setPickState(prev => ({
                ...prev,
                [item.item_id]: { pickedLots: newPicked, autoFilled: true }
            }));

            if (missingWeight > 0) {
                Alert.alert(
                    '⚠️ Partial Stock',
                    `Only ${item.ordered_weight - missingWeight}kg available for ${item.material_id}.\n${missingWeight}kg short.`
                );
            }
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setAutoFilling(false);
        }
    };

    // AUTO-FILL ALL items at once
    const autoFillAll = async () => {
        for (const item of orderItems) {
            await autoFillItem(item);
        }
    };

    // --------------------------------------------------------------
    // MANUAL PICK MODAL
    // --------------------------------------------------------------
    const openModal = (item: SalesOrderItem) => {
        setModalItem(item);
        setTempPicked(pickState[item.item_id]?.pickedLots || []);
    };

    const toggleLot = (lot: StockLot) => {
        const exists = tempPicked.find(p => p.lot_id === lot.lot_id);
        if (exists) {
            setTempPicked(prev => prev.filter(p => p.lot_id !== lot.lot_id));
        } else {
            // Pick full lot by default (user can't partial-pick in manual mode)
            setTempPicked(prev => [...prev, { lot_id: lot.lot_id, weight_picked: lot.available_weight }]);
        }
    };

    const saveManualPick = () => {
        if (modalItem) {
            setPickState(prev => ({
                ...prev,
                [modalItem.item_id]: { pickedLots: tempPicked, autoFilled: false }
            }));
        }
        setModalItem(null);
    };

    // --------------------------------------------------------------
    // DISPATCH
    // --------------------------------------------------------------
    const handleDispatch = async () => {
        // Check all items have at least some picks
        for (const item of orderItems) {
            const state = pickState[item.item_id];
            if (!state || state.pickedLots.length === 0) {
                Alert.alert('Incomplete', `No lots picked for ${item.material_id}. Use Auto-Fill or pick manually.`);
                return;
            }
        }

        Alert.alert(
            'Confirm Dispatch',
            'This will deduct the picked weight from inventory permanently.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Dispatch ✅', onPress: doDispatch }
            ]
        );
    };

    const doDispatch = async () => {
        setDispatching(true);
        try {
            const pickedItems = orderItems.map((item: SalesOrderItem) => ({
                itemId: item.item_id,
                pickedLots: pickState[item.item_id]?.pickedLots || []
            }));

            const res = await fulfillSalesOrder(TENANT, orderId, pickedItems);
            if (res.success) {
                Alert.alert('✅ Dispatched!', 'Order fulfilled & inventory updated.', [
                    { text: 'Done', onPress: () => navigation.popToTop() }
                ]);
            }
        } catch (e: any) {
            Alert.alert('Dispatch Failed', e.message);
        } finally {
            setDispatching(false);
        }
    };

    // --------------------------------------------------------------
    // HELPERS
    // --------------------------------------------------------------
    const getPickedWeight = (itemId: string) =>
        (pickState[itemId]?.pickedLots || []).reduce((s, p) => s + p.weight_picked, 0);

    const isAutoFilled = (itemId: string) => pickState[itemId]?.autoFilled === true;

    const allReady = orderItems.every((item: SalesOrderItem) => {
        const w = getPickedWeight(item.item_id);
        return w > 0;
    });

    // Modal: FIFO warning if user skipped older lot
    const renderFIFOWarning = (material: string, currentPicked: PickedLot[]) => {
        const relevantStock = stock.filter(l => l.material_id === material);
        if (relevantStock.length === 0 || currentPicked.length === 0) return null;
        const oldestLot = relevantStock[0]; // Already sorted oldest-first
        const isOldestPicked = currentPicked.some(p => p.lot_id === oldestLot.lot_id);
        if (!isOldestPicked) {
            return (
                <View style={styles.fifoWarn}>
                    <Icon name="alert" size={14} color="#B45309" />
                    <Text style={styles.fifoWarnText}>⚠️ Skipping older stock! ({oldestLot.lot_id})</Text>
                </View>
            );
        }
        return null;
    };

    if (loading) return (
        <View style={styles.center}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={{ color: '#6B7280', marginTop: 10 }}>Loading stock…</Text>
        </View>
    );

    return (
        <View style={styles.root}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Icon name="arrow-left" size={24} color="#FFF" />
                </TouchableOpacity>
                <View>
                    <Text style={styles.headerTitle}>Fulfill Order</Text>
                    <Text style={styles.headerSub}>{orderId}</Text>
                </View>
                <View style={{ width: 24 }} />
            </View>

            {/* AUTO-FILL ALL BANNER */}
            <TouchableOpacity
                style={[styles.autoFillBanner, (autoFilling || dispatching) && { opacity: 0.6 }]}
                onPress={autoFillAll}
                disabled={autoFilling || dispatching}
            >
                {autoFilling ? (
                    <ActivityIndicator size="small" color="#FFF" />
                ) : (
                    <Icon name="lightning-bolt" size={20} color="#FFF" />
                )}
                <Text style={styles.autoFillText}>
                    {autoFilling ? 'Running FIFO Auto-Fill…' : '⚡ Auto-Fill All (FIFO)'}
                </Text>
                <View style={styles.fifoBadge}>
                    <Text style={styles.fifoBadgeText}>Oldest First</Text>
                </View>
            </TouchableOpacity>

            <ScrollView contentContainerStyle={styles.body}>
                {orderItems.map((item: SalesOrderItem) => {
                    const picked = getPickedWeight(item.item_id);
                    const isFull = picked >= item.ordered_weight;
                    const isPartial = picked > 0 && picked < item.ordered_weight;
                    const autoFilled = isAutoFilled(item.item_id);
                    const lotCount = (pickState[item.item_id]?.pickedLots || []).length;

                    return (
                        <View key={item.item_id} style={styles.itemCard}>
                            {/* Item Header */}
                            <View style={styles.itemHeader}>
                                <View style={styles.materialIcon}>
                                    <Icon name="recycle" size={20} color="#10B981" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.materialName}>{item.material_id}</Text>
                                    <Text style={styles.materialRate}>₹{item.rate_per_kg}/kg</Text>
                                </View>
                                <View style={[
                                    styles.statusBadge,
                                    isFull ? styles.statusFull :
                                        isPartial ? styles.statusPartial :
                                            styles.statusEmpty
                                ]}>
                                    <Text style={styles.statusText}>
                                        {isFull ? '✅ Ready' : isPartial ? '⚠️ Partial' : '○ Pending'}
                                    </Text>
                                </View>
                            </View>

                            {/* Progress Bar */}
                            <View style={styles.progressBg}>
                                <View style={[
                                    styles.progressFill,
                                    { width: `${Math.min(100, (picked / item.ordered_weight) * 100)}%` as any },
                                    isFull && { backgroundColor: '#10B981' }
                                ]} />
                            </View>
                            <View style={styles.progressRow}>
                                <Text style={styles.progressLabel}>
                                    Picked: <Text style={{ fontWeight: '800', color: isFull ? '#10B981' : '#374151' }}>
                                        {picked.toLocaleString('en-IN')} kg
                                    </Text>
                                </Text>
                                <Text style={styles.progressLabel}>
                                    Target: <Text style={{ fontWeight: '700' }}>{item.ordered_weight.toLocaleString('en-IN')} kg</Text>
                                </Text>
                            </View>

                            {/* Auto-fill tag */}
                            {autoFilled && (
                                <View style={styles.autoTag}>
                                    <Icon name="lightning-bolt" size={12} color="#7C3AED" />
                                    <Text style={styles.autoTagText}>FIFO Auto-filled • {lotCount} lot{lotCount !== 1 ? 's' : ''}</Text>
                                </View>
                            )}

                            {/* FIFO Warning */}
                            {renderFIFOWarning(item.material_id, pickState[item.item_id]?.pickedLots || [])}

                            {/* Action Buttons */}
                            <View style={styles.btnRow}>
                                <TouchableOpacity
                                    style={[styles.autoBtn, autoFilling && { opacity: 0.5 }]}
                                    onPress={() => autoFillItem(item)}
                                    disabled={autoFilling}
                                >
                                    <Icon name="lightning-bolt" size={14} color="#7C3AED" />
                                    <Text style={styles.autoBtnText}>Auto-Fill</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.manualBtn}
                                    onPress={() => openModal(item)}
                                >
                                    <Icon name="hand-pointing-right" size={14} color="#374151" />
                                    <Text style={styles.manualBtnText}>
                                        {lotCount > 0 ? `Edit (${lotCount} lots)` : 'Pick Manually'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    );
                })}
            </ScrollView>

            {/* Bottom Dispatch Bar */}
            <View style={styles.bottomBar}>
                <TouchableOpacity
                    style={[styles.dispatchBtn, !allReady && styles.dispatchBtnDisabled]}
                    onPress={handleDispatch}
                    disabled={dispatching}
                >
                    {dispatching
                        ? <ActivityIndicator color="#FFF" />
                        : <>
                            <Icon name="truck-delivery" size={22} color="#FFF" />
                            <Text style={styles.dispatchText}>
                                {allReady ? 'DISPATCH ORDER' : 'Waiting for picks…'}
                            </Text>
                        </>
                    }
                </TouchableOpacity>
            </View>

            {/* MANUAL PICK MODAL */}
            <Modal visible={!!modalItem} animationType="slide" onRequestClose={() => setModalItem(null)}>
                {modalItem && (() => {
                    const relevant = stock.filter(l => l.material_id === modalItem.material_id);
                    const totalSelected = tempPicked.reduce((s, p) => s + p.weight_picked, 0);
                    const isMet = totalSelected >= modalItem.ordered_weight;

                    return (
                        <View style={styles.modal}>
                            <View style={styles.modalHeader}>
                                <View>
                                    <Text style={styles.modalTitle}>Pick: {modalItem.material_id}</Text>
                                    <Text style={styles.modalSub}>Target: {modalItem.ordered_weight} kg</Text>
                                </View>
                                <View style={styles.fifoBadgeBlue}>
                                    <Text style={styles.fifoBadgeBlueTxt}>FIFO Order ↑</Text>
                                </View>
                            </View>

                            <FlatList
                                data={relevant}
                                keyExtractor={l => l.lot_id}
                                contentContainerStyle={{ padding: 14 }}
                                renderItem={({ item: lot, index }) => {
                                    const isPicked = tempPicked.some(p => p.lot_id === lot.lot_id);
                                    const age = lot.created_at
                                        ? Math.floor((Date.now() - new Date(lot.created_at).getTime()) / 86400000)
                                        : 0;
                                    const isOldest = index === 0;

                                    return (
                                        <TouchableOpacity
                                            style={[
                                                styles.lotCard,
                                                isPicked && styles.lotPicked,
                                                isOldest && styles.lotOldest
                                            ]}
                                            onPress={() => toggleLot(lot)}
                                        >
                                            <View style={{ flex: 1 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                                    {isOldest && (
                                                        <View style={styles.oldestTag}>
                                                            <Text style={styles.oldestTagText}>⭐ OLDEST</Text>
                                                        </View>
                                                    )}
                                                    <Text style={styles.lotId}>{lot.lot_id}</Text>
                                                </View>
                                                <Text style={styles.lotAge}>
                                                    {age} day{age !== 1 ? 's' : ''} in yard
                                                </Text>
                                                <Text style={styles.lotBatch}>{lot.batch_id}</Text>
                                            </View>
                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={styles.lotWeight}>{lot.available_weight.toLocaleString('en-IN')} kg</Text>
                                                {isPicked
                                                    ? <Icon name="check-circle" size={22} color="#10B981" style={{ marginTop: 4 }} />
                                                    : <Icon name="circle-outline" size={22} color="#D1D5DB" style={{ marginTop: 4 }} />
                                                }
                                            </View>
                                        </TouchableOpacity>
                                    );
                                }}
                                ListEmptyComponent={
                                    <View style={styles.center}>
                                        <Icon name="package-variant-closed" size={44} color="#D1D5DB" />
                                        <Text style={{ color: '#9CA3AF', marginTop: 10 }}>No stock for {modalItem.material_id}</Text>
                                    </View>
                                }
                            />

                            <View style={styles.modalFooter}>
                                <View>
                                    <Text style={styles.totalLabel}>Selected</Text>
                                    <Text style={[styles.totalValue, isMet ? { color: '#10B981' } : { color: '#F59E0B' }]}>
                                        {totalSelected.toLocaleString('en-IN')} / {modalItem.ordered_weight.toLocaleString('en-IN')} kg
                                    </Text>
                                    {!isMet && tempPicked.length > 0 && (
                                        <Text style={{ color: '#EF4444', fontSize: 11, marginTop: 2 }}>
                                            {(modalItem.ordered_weight - totalSelected).toFixed(1)} kg still needed
                                        </Text>
                                    )}
                                </View>
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <TouchableOpacity onPress={() => setModalItem(null)} style={styles.cancelBtn}>
                                        <Text style={styles.cancelText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={saveManualPick} style={styles.confirmBtn}>
                                        <Text style={styles.confirmText}>Confirm</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    );
                })()}
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F3F4F6' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingBottom: 14,
        paddingTop: (StatusBar.currentHeight ?? 24) + 10,
        backgroundColor: '#1B6B2F', elevation: 4,
    },
    headerTitle: { fontSize: 17, fontWeight: '700', color: '#FFF', textAlign: 'center' },
    headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', textAlign: 'center' },

    autoFillBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#7C3AED', padding: 14, margin: 14, borderRadius: 14 },
    autoFillText: { flex: 1, color: '#FFF', fontWeight: '700', fontSize: 15 },
    fifoBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    fifoBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },

    body: { paddingHorizontal: 14, paddingBottom: 100 },

    itemCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 14, elevation: 1 },
    itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
    materialIcon: { width: 40, height: 40, backgroundColor: '#ECFDF5', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    materialName: { fontSize: 16, fontWeight: '700', color: '#111' },
    materialRate: { fontSize: 12, color: '#6B7280', marginTop: 2 },

    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    statusFull: { backgroundColor: '#DCFCE7' },
    statusPartial: { backgroundColor: '#FEF3C7' },
    statusEmpty: { backgroundColor: '#F3F4F6' },
    statusText: { fontSize: 12, fontWeight: '700', color: '#374151' },

    progressBg: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, marginBottom: 8, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: '#F59E0B', borderRadius: 4 },
    progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    progressLabel: { fontSize: 12, color: '#6B7280' },

    autoTag: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
    autoTagText: { fontSize: 11, color: '#7C3AED', fontWeight: '600' },

    fifoWarn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF3C7', padding: 8, borderRadius: 8, marginBottom: 10 },
    fifoWarnText: { fontSize: 11, color: '#92400E', fontWeight: '600' },

    btnRow: { flexDirection: 'row', gap: 10 },
    autoBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#F3E8FF', paddingVertical: 10, borderRadius: 10 },
    autoBtnText: { color: '#7C3AED', fontWeight: '700', fontSize: 13 },
    manualBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#F9FAFB', paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB' },
    manualBtnText: { color: '#374151', fontWeight: '600', fontSize: 13 },

    bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#FFF', borderTopWidth: 1, borderColor: '#E5E7EB' },
    dispatchBtn: { backgroundColor: '#111', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 18, borderRadius: 16 },
    dispatchBtnDisabled: { backgroundColor: '#9CA3AF' },
    dispatchText: { color: '#FFF', fontWeight: '800', fontSize: 16, letterSpacing: 1 },

    // Modal
    modal: { flex: 1, backgroundColor: '#F9FAFB' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#FFF', elevation: 2 },
    modalTitle: { fontSize: 17, fontWeight: '700' },
    modalSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    fifoBadgeBlue: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    fifoBadgeBlueTxt: { fontSize: 11, color: '#1D4ED8', fontWeight: '700' },

    lotCard: { backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, marginBottom: 10, borderWidth: 1.5, borderColor: '#E5E7EB' },
    lotPicked: { borderColor: '#10B981', backgroundColor: '#F0FDF4' },
    lotOldest: { borderColor: '#3B82F6', borderWidth: 2 },
    lotId: { fontSize: 14, fontWeight: '700', color: '#111' },
    lotAge: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    lotBatch: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
    lotWeight: { fontSize: 15, fontWeight: '800', color: '#111' },
    oldestTag: { backgroundColor: '#EFF6FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    oldestTagText: { fontSize: 10, color: '#1D4ED8', fontWeight: '800' },

    modalFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#FFF', borderTopWidth: 1, borderColor: '#E5E7EB' },
    totalLabel: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
    totalValue: { fontSize: 22, fontWeight: '800' },

    cancelBtn: { paddingHorizontal: 16, paddingVertical: 12 },
    cancelText: { color: '#6B7280', fontWeight: '600' },
    confirmBtn: { backgroundColor: '#10B981', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
    confirmText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});
