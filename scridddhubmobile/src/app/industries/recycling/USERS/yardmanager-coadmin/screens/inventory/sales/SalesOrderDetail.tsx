import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Alert, Modal, TextInput, StatusBar
} from 'react-native';
import {
    getSalesOrderById, confirmSalesOrder,
    recordPayment, getPaymentsForOrder
} from '../../../../../../../../shared/inventory/api';
import { SalesOrder, SOStatus } from '../../../../../../../../shared/inventory/types';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const TENANT = 'TENANT-001';
const APP_GREEN = '#1B6B2F';

const STATUS_COLOR: Record<string, { bg: string; text: string; icon: string }> = {
    [SOStatus.Draft]: { bg: '#FEF3C7', text: '#92400E', icon: 'pencil-outline' },
    [SOStatus.Confirmed]: { bg: '#DBEAFE', text: '#1E40AF', icon: 'check-circle-outline' },
    [SOStatus.Dispatched]: { bg: '#DCFCE7', text: '#166534', icon: 'truck-delivery' },
};

const PAYMENT_METHODS = ['Cash', 'UPI', 'Cheque', 'NEFT/RTGS', 'Bank Transfer'];

const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

export default function SalesOrderDetail({ route, navigation }: any) {
    const { orderId } = route.params;
    const [order, setOrder] = useState<SalesOrder | null>(null);
    const [payments, setPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // Payment modal
    const [payModal, setPayModal] = useState(false);
    const [payAmount, setPayAmount] = useState('');
    const [payMethod, setPayMethod] = useState('Cash');
    const [payRef, setPayRef] = useState('');

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const [orderRes, payRes] = await Promise.all([
                getSalesOrderById(TENANT, orderId),
                getPaymentsForOrder(TENANT, orderId).catch(() => ({ data: [] }))
            ]);
            if (orderRes.success) setOrder(orderRes.data);
            setPayments(payRes.data || []);
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setLoading(false);
        }
    }, [orderId]);

    useEffect(() => {
        load();
        const unsub = navigation.addListener('focus', load);
        return unsub;
    }, [navigation, load]);

    const handleConfirm = async () => {
        Alert.alert('Confirm Order', 'Lock this order for fulfillment?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Confirm', onPress: async () => {
                    setActionLoading(true);
                    try {
                        await confirmSalesOrder(TENANT, orderId);
                        await load();
                    } catch (e: any) {
                        Alert.alert('Error', e.message);
                    } finally { setActionLoading(false); }
                }
            }
        ]);
    };

    const handleRecordPayment = async () => {
        const amount = parseFloat(payAmount);
        if (!amount || amount <= 0) {
            Alert.alert('Invalid', 'Enter a valid amount');
            return;
        }
        if (!order) return;
        const balance = order.total_amount - order.amount_paid;
        if (amount > balance) {
            Alert.alert('Overpayment', `Max receivable is ${fmt(balance)}`);
            return;
        }
        setActionLoading(true);
        try {
            await recordPayment(TENANT, {
                so_id: orderId,
                amount,
                method: payMethod,
                reference: payRef.trim() || undefined,
                recorded_by: 'yard_manager',
            });
            setPayModal(false);
            setPayAmount(''); setPayRef('');
            await load();
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally { setActionLoading(false); }
    };

    if (loading) return (
        <View style={styles.loader}>
            <ActivityIndicator size="large" color={APP_GREEN} />
        </View>
    );

    if (!order) return (
        <View style={styles.loader}>
            <Icon name="alert-circle-outline" size={48} color="#D1D5DB" />
            <Text style={{ color: '#9CA3AF', marginTop: 12 }}>Order not found</Text>
        </View>
    );

    const sc = STATUS_COLOR[order.status] || STATUS_COLOR[SOStatus.Draft];
    const balance = order.total_amount - order.amount_paid;
    const payPct = order.total_amount > 0 ? (order.amount_paid / order.total_amount) * 100 : 0;

    return (
        <View style={styles.root}>
            {/* ── Header ─────────────────────────────────── */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Icon name="arrow-left" size={24} color="#FFF" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>{order.so_id}</Text>
                    <Text style={styles.headerSub}>
                        {new Date(order.so_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
                    <Icon name={sc.icon} size={13} color={sc.text} />
                    <Text style={[styles.statusPillText, { color: sc.text }]}>
                        {order.status.toUpperCase()}
                    </Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.body}>

                {/* ── Customer Card ───────────────────────── */}
                <View style={styles.card}>
                    <Text style={styles.cardLabel}>CUSTOMER</Text>
                    <View style={styles.customerRow}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>{order.customer_name[0]}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.customerName}>{order.customer_name}</Text>
                            {order.customer_contact && (
                                <Text style={styles.customerMeta}>📞 {order.customer_contact}</Text>
                            )}
                            {order.customer_gst && (
                                <Text style={styles.customerMeta}>GST: {order.customer_gst}</Text>
                            )}
                        </View>
                    </View>
                    {order.notes ? (
                        <View style={styles.notesBox}>
                            <Icon name="note-text-outline" size={14} color="#6B7280" />
                            <Text style={styles.notesText}>{order.notes}</Text>
                        </View>
                    ) : null}
                </View>

                {/* ── Line Items ──────────────────────────── */}
                <Text style={styles.sectionTitle}>ORDER ITEMS</Text>
                <View style={styles.card}>
                    {order.items.map((item, idx) => {
                        const lineTotal = item.ordered_weight * item.rate_per_kg;
                        return (
                            <View key={item.item_id} style={[
                                styles.itemRow,
                                idx < order.items.length - 1 && styles.itemRowBorder
                            ]}>
                                <View style={styles.itemIcon}>
                                    <Icon name="recycle" size={16} color={APP_GREEN} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.itemMaterial}>{item.material_id}</Text>
                                    <Text style={styles.itemMeta}>
                                        {item.ordered_weight.toLocaleString('en-IN')} kg × {fmt(item.rate_per_kg)}/kg
                                    </Text>
                                </View>
                                <Text style={styles.itemAmount}>{fmt(lineTotal)}</Text>
                            </View>
                        );
                    })}

                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalValue}>{fmt(order.total_amount)}</Text>
                    </View>
                </View>

                {/* ── Payment Summary ──────────────────────── */}
                <Text style={styles.sectionTitle}>PAYMENT</Text>
                <View style={styles.card}>
                    <View style={styles.payRow}>
                        <Text style={styles.payLabel}>Total Amount</Text>
                        <Text style={styles.payValue}>{fmt(order.total_amount)}</Text>
                    </View>
                    <View style={styles.payRow}>
                        <Text style={styles.payLabel}>Paid</Text>
                        <Text style={[styles.payValue, { color: '#059669' }]}>{fmt(order.amount_paid)}</Text>
                    </View>

                    {/* Progress bar */}
                    <View style={styles.progressBg}>
                        <View style={[styles.progressFill, { width: `${Math.min(100, payPct)}%` as any }]} />
                    </View>

                    <View style={styles.payRow}>
                        <Text style={styles.payLabel}>Balance Due</Text>
                        <Text style={[styles.payValue, { color: balance > 0 ? '#DC2626' : '#059669', fontWeight: '800' }]}>
                            {balance > 0 ? fmt(balance) : '✅ Cleared'}
                        </Text>
                    </View>

                    {payments.length > 0 && (
                        <>
                            <View style={styles.divider} />
                            <Text style={[styles.cardLabel, { marginBottom: 10 }]}>PAYMENT HISTORY</Text>
                            {payments.map((p: any, i: number) => (
                                <View key={i} style={styles.payHistRow}>
                                    <View style={styles.payHistDot} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.payHistAmt}>{fmt(p.amount)}</Text>
                                        <Text style={styles.payHistMeta}>
                                            {p.method} {p.reference ? `· ${p.reference}` : ''} · {new Date(p.recorded_at).toLocaleDateString('en-IN')}
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </>
                    )}
                </View>

                {/* ── Action Buttons ───────────────────────── */}
                <View style={styles.actionsBox}>
                    {/* Confirm (draft only) */}
                    {order.status === SOStatus.Draft && (
                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: '#2563EB' }]}
                            onPress={handleConfirm}
                            disabled={actionLoading}
                        >
                            <Icon name="check-circle-outline" size={20} color="#FFF" />
                            <Text style={styles.actionBtnText}>Confirm Order</Text>
                        </TouchableOpacity>
                    )}

                    {/* Fulfill / Dispatch (confirmed only) */}
                    {order.status === SOStatus.Confirmed && (
                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: APP_GREEN }]}
                            onPress={() => navigation.navigate('FulfillOrder', {
                                orderId: order.so_id,
                                orderItems: order.items
                            })}
                            disabled={actionLoading}
                        >
                            <Icon name="truck-delivery" size={20} color="#FFF" />
                            <Text style={styles.actionBtnText}>Pick & Dispatch</Text>
                        </TouchableOpacity>
                    )}

                    {/* Record Payment (if balance remaining) */}
                    {balance > 0 && order.status !== SOStatus.Draft && (
                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: '#059669' }]}
                            onPress={() => setPayModal(true)}
                            disabled={actionLoading}
                        >
                            <Icon name="cash-plus" size={20} color="#FFF" />
                            <Text style={styles.actionBtnText}>Record Payment</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </ScrollView>

            {/* ── Payment Modal ────────────────────────────── */}
            <Modal visible={payModal} animationType="slide" transparent onRequestClose={() => setPayModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalSheet}>
                        <View style={styles.modalHandle} />
                        <Text style={styles.modalTitle}>Record Payment</Text>

                        <Text style={styles.fieldLabel}>Amount (₹)</Text>
                        <TextInput
                            style={styles.input}
                            value={payAmount}
                            onChangeText={setPayAmount}
                            keyboardType="numeric"
                            placeholder={`Max: ${fmt(balance)}`}
                            placeholderTextColor="#9CA3AF"
                        />

                        <Text style={styles.fieldLabel}>Payment Method</Text>
                        <View style={styles.methodRow}>
                            {PAYMENT_METHODS.map(m => (
                                <TouchableOpacity
                                    key={m}
                                    style={[styles.methodChip, payMethod === m && styles.methodChipActive]}
                                    onPress={() => setPayMethod(m)}
                                >
                                    <Text style={[styles.methodChipText, payMethod === m && styles.methodChipTextActive]}>
                                        {m}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.fieldLabel}>Reference / UTR (optional)</Text>
                        <TextInput
                            style={styles.input}
                            value={payRef}
                            onChangeText={setPayRef}
                            placeholder="e.g. UPI ref, cheque no."
                            placeholderTextColor="#9CA3AF"
                        />

                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: APP_GREEN, marginTop: 8 }]}
                            onPress={handleRecordPayment}
                            disabled={actionLoading}
                        >
                            {actionLoading
                                ? <ActivityIndicator color="#FFF" />
                                : <>
                                    <Icon name="check" size={20} color="#FFF" />
                                    <Text style={styles.actionBtnText}>Save Payment</Text>
                                </>
                            }
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: '#F3F4F6', marginTop: 10 }]}
                            onPress={() => setPayModal(false)}
                        >
                            <Text style={[styles.actionBtnText, { color: '#374151' }]}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F5F5F5' },
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F5F5' },

    header: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 16, paddingBottom: 14,
        paddingTop: (StatusBar.currentHeight ?? 24) + 10,
        backgroundColor: APP_GREEN, elevation: 4,
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 17, fontWeight: '800', color: '#FFF' },
    headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
    statusPill: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    },
    statusPillText: { fontSize: 11, fontWeight: '800' },

    body: { padding: 16, paddingBottom: 40 },

    sectionTitle: {
        fontSize: 11, fontWeight: '800', color: '#9CA3AF',
        letterSpacing: 0.8, marginBottom: 8, marginTop: 4,
    },

    card: {
        backgroundColor: '#FFF', borderRadius: 16, padding: 16,
        marginBottom: 14, elevation: 1,
        shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6,
    },
    cardLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 12 },

    customerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: {
        width: 44, height: 44, borderRadius: 12,
        backgroundColor: APP_GREEN, alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { fontSize: 20, fontWeight: '800', color: '#FFF' },
    customerName: { fontSize: 16, fontWeight: '700', color: '#111' },
    customerMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    notesBox: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 8,
        marginTop: 12, backgroundColor: '#F9FAFB', borderRadius: 8, padding: 10,
    },
    notesText: { fontSize: 13, color: '#6B7280', flex: 1, lineHeight: 18 },

    itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    itemRowBorder: { borderBottomWidth: 1, borderColor: '#F3F4F6' },
    itemIcon: {
        width: 34, height: 34, borderRadius: 10,
        backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center',
    },
    itemMaterial: { fontSize: 14, fontWeight: '700', color: '#111' },
    itemMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    itemAmount: { fontSize: 15, fontWeight: '800', color: '#111' },

    totalRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginTop: 12, paddingTop: 12, borderTopWidth: 1.5, borderColor: '#F3F4F6',
    },
    totalLabel: { fontSize: 14, fontWeight: '700', color: '#374151' },
    totalValue: { fontSize: 20, fontWeight: '800', color: APP_GREEN },

    payRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    payLabel: { fontSize: 13, color: '#6B7280' },
    payValue: { fontSize: 14, fontWeight: '700', color: '#111' },
    progressBg: { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, marginBottom: 10, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: '#059669', borderRadius: 3 },
    divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 12 },

    payHistRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
    payHistDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#059669', marginTop: 4 },
    payHistAmt: { fontSize: 14, fontWeight: '700', color: '#111' },
    payHistMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },

    actionsBox: { gap: 10 },
    actionBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 10, paddingVertical: 16, borderRadius: 14,
    },
    actionBtnText: { color: '#FFF', fontWeight: '800', fontSize: 16 },

    // Modal
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
    modalSheet: {
        backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: 20, paddingBottom: 36,
    },
    modalHandle: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 20, fontWeight: '800', color: '#111', marginBottom: 20 },
    fieldLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', marginBottom: 6, letterSpacing: 0.5 },
    input: {
        borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10,
        padding: 12, fontSize: 16, color: '#111', marginBottom: 16, backgroundColor: '#F9FAFB',
    },
    methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    methodChip: {
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
        backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: '#E5E7EB',
    },
    methodChipActive: { backgroundColor: APP_GREEN, borderColor: APP_GREEN },
    methodChipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
    methodChipTextActive: { color: '#FFF' },
});
