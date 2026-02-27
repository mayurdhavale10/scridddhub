import React, { useState, useEffect } from 'react';
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity,
    TextInput, Alert, ActivityIndicator, FlatList, Modal, StatusBar
} from 'react-native';
import {
    getInventorySettings, createSalesOrder,
    getCustomers, createCustomer
} from '../../../../../../../../shared/inventory/api';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const TENANT = 'TENANT-001';

interface OrderItem {
    item_id: string;
    material_id: string;
    ordered_weight: string;
    rate_per_kg: string;
}

export default function CreateSalesOrderScreen({ navigation }: any) {
    const [materials, setMaterials] = useState<string[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Customer state
    const [customerQuery, setCustomerQuery] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
    const [showCustomerPicker, setShowCustomerPicker] = useState(false);
    const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
    const [newCustName, setNewCustName] = useState('');
    const [newCustPhone, setNewCustPhone] = useState('');
    const [newCustGST, setNewCustGST] = useState('');

    // Order items
    const [items, setItems] = useState<OrderItem[]>([{
        item_id: `ITEM-${Date.now()}`,
        material_id: '',
        ordered_weight: '',
        rate_per_kg: ''
    }]);

    const [notes, setNotes] = useState('');

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        try {
            const [settingsRes, custRes] = await Promise.all([
                getInventorySettings(TENANT),
                getCustomers(TENANT)
            ]);
            if (settingsRes.data?.materials) {
                setMaterials(settingsRes.data.materials);
                setItems(prev => prev.map((i, idx) =>
                    idx === 0 ? { ...i, material_id: settingsRes.data.materials[0] || '' } : i
                ));
            }
            if (custRes.success) setCustomers(custRes.data || []);
        } catch (e) { console.error(e); }
    };

    const totalAmount = items.reduce((sum, item) => {
        const w = parseFloat(item.ordered_weight) || 0;
        const r = parseFloat(item.rate_per_kg) || 0;
        return sum + w * r;
    }, 0);

    const addItem = () => {
        setItems(prev => [...prev, {
            item_id: `ITEM-${Date.now()}`,
            material_id: materials[0] || '',
            ordered_weight: '',
            rate_per_kg: ''
        }]);
    };

    const removeItem = (index: number) => {
        if (items.length === 1) return;
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const updateItem = (index: number, field: keyof OrderItem, value: string) => {
        setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
    };

    const handleCreateNewCustomer = async () => {
        if (!newCustName.trim() || !newCustPhone.trim()) {
            Alert.alert('Required', 'Name and phone are required');
            return;
        }
        try {
            setLoading(true);
            const res = await createCustomer(TENANT, {
                name: newCustName.trim(),
                contact_phone: newCustPhone.trim(),
                gst_number: newCustGST.trim() || undefined,
            });
            if (res.success) {
                setSelectedCustomer(res.data);
                setCustomers(prev => [...prev, res.data]);
                setShowNewCustomerForm(false);
                setShowCustomerPicker(false);
                setNewCustName(''); setNewCustPhone(''); setNewCustGST('');
            }
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally { setLoading(false); }
    };

    const handleSubmit = async () => {
        // Validate
        for (const item of items) {
            if (!item.material_id || !item.ordered_weight || !item.rate_per_kg) {
                Alert.alert('Incomplete', 'Please fill all item fields');
                return;
            }
            if (parseFloat(item.ordered_weight) <= 0 || parseFloat(item.rate_per_kg) <= 0) {
                Alert.alert('Invalid', 'Weight and rate must be greater than 0');
                return;
            }
        }

        setLoading(true);
        try {
            const payload = {
                customer_id: selectedCustomer?.customer_id,
                customer_name: selectedCustomer?.name || 'Walk-in Customer',
                customer_gst: selectedCustomer?.gst_number,
                customer_contact: selectedCustomer?.contact_phone,
                notes: notes.trim() || undefined,
                items: items.map(i => ({
                    item_id: i.item_id,
                    material_id: i.material_id,
                    ordered_weight: parseFloat(i.ordered_weight),
                    rate_per_kg: parseFloat(i.rate_per_kg)
                }))
            };
            const res = await createSalesOrder(TENANT, payload);
            if (res.success) {
                Alert.alert('✅ Order Created', `${res.data.so_id}\n₹${totalAmount.toLocaleString('en-IN')}`, [
                    { text: 'View Orders', onPress: () => navigation.navigate('SalesOrderList') }
                ]);
            }
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally { setLoading(false); }
    };

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(customerQuery.toLowerCase()) ||
        c.contact_phone.includes(customerQuery)
    );

    return (
        <View style={styles.root}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Icon name="arrow-left" size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>New Sales Order</Text>
                <TouchableOpacity
                    onPress={handleSubmit}
                    style={[styles.saveBtn, loading && { opacity: 0.5 }]}
                    disabled={loading}
                >
                    {loading
                        ? <ActivityIndicator size="small" color="#1B6B2F" />
                        : <Text style={styles.saveBtnText}>Create</Text>
                    }
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">

                {/* CUSTOMER SECTION */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Customer</Text>
                    <TouchableOpacity
                        style={styles.customerPicker}
                        onPress={() => setShowCustomerPicker(true)}
                    >
                        <Icon name="account" size={20} color={selectedCustomer ? '#10B981' : '#9CA3AF'} />
                        <Text style={[styles.customerPickerText, selectedCustomer && { color: '#111' }]}>
                            {selectedCustomer ? selectedCustomer.name : 'Select or add customer…'}
                        </Text>
                        <Icon name="chevron-right" size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                    {selectedCustomer && (
                        <View style={styles.customerDetail}>
                            <Text style={styles.customerPhone}>📞 {selectedCustomer.contact_phone}</Text>
                            {selectedCustomer.gst_number &&
                                <Text style={styles.customerGST}>GST: {selectedCustomer.gst_number}</Text>
                            }
                            {selectedCustomer.outstanding_balance > 0 &&
                                <Text style={styles.customerOutstanding}>
                                    ⚠️ Outstanding: ₹{selectedCustomer.outstanding_balance.toLocaleString('en-IN')}
                                </Text>
                            }
                        </View>
                    )}
                </View>

                {/* ITEMS SECTION */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Items</Text>
                    {items.map((item, index) => (
                        <View key={item.item_id} style={styles.itemCard}>
                            <View style={styles.itemHeader}>
                                <Text style={styles.itemLabel}>Item {index + 1}</Text>
                                {items.length > 1 &&
                                    <TouchableOpacity onPress={() => removeItem(index)}>
                                        <Icon name="trash-can-outline" size={18} color="#EF4444" />
                                    </TouchableOpacity>
                                }
                            </View>

                            {/* Material Chips */}
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                                {materials.map(m => (
                                    <TouchableOpacity
                                        key={m}
                                        style={[styles.chip, item.material_id === m && styles.chipActive]}
                                        onPress={() => updateItem(index, 'material_id', m)}
                                    >
                                        <Text style={[styles.chipText, item.material_id === m && { color: '#FFF' }]}>{m}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <View style={styles.row}>
                                <View style={{ flex: 1, marginRight: 8 }}>
                                    <Text style={styles.fieldLabel}>Weight (kg)</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={item.ordered_weight}
                                        onChangeText={v => updateItem(index, 'ordered_weight', v)}
                                        keyboardType="numeric"
                                        placeholder="0"
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.fieldLabel}>Rate (₹/kg)</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={item.rate_per_kg}
                                        onChangeText={v => updateItem(index, 'rate_per_kg', v)}
                                        keyboardType="numeric"
                                        placeholder="0.00"
                                    />
                                </View>
                            </View>

                            {(parseFloat(item.ordered_weight) > 0 && parseFloat(item.rate_per_kg) > 0) && (
                                <Text style={styles.itemTotal}>
                                    = ₹{(parseFloat(item.ordered_weight) * parseFloat(item.rate_per_kg)).toLocaleString('en-IN')}
                                </Text>
                            )}
                        </View>
                    ))}

                    <TouchableOpacity style={styles.addItemBtn} onPress={addItem}>
                        <Icon name="plus" size={18} color="#10B981" />
                        <Text style={styles.addItemText}>Add Another Material</Text>
                    </TouchableOpacity>
                </View>

                {/* NOTES */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Notes (optional)</Text>
                    <TextInput
                        style={[styles.input, { minHeight: 70 }]}
                        value={notes}
                        onChangeText={setNotes}
                        placeholder="Delivery instructions, remarks…"
                        multiline
                    />
                </View>

                {/* TOTAL */}
                <View style={styles.totalCard}>
                    <Text style={styles.totalLabel}>Total Order Value</Text>
                    <Text style={styles.totalValue}>₹{totalAmount.toLocaleString('en-IN')}</Text>
                </View>
            </ScrollView>

            {/* CUSTOMER PICKER MODAL */}
            <Modal visible={showCustomerPicker} animationType="slide">
                <View style={styles.modalRoot}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Select Customer</Text>
                        <TouchableOpacity onPress={() => { setShowCustomerPicker(false); setShowNewCustomerForm(false); }}>
                            <Icon name="close" size={24} color="#111" />
                        </TouchableOpacity>
                    </View>

                    {!showNewCustomerForm ? (
                        <>
                            <TextInput
                                style={[styles.input, { margin: 15, marginBottom: 5 }]}
                                placeholder="Search by name or phone..."
                                value={customerQuery}
                                onChangeText={setCustomerQuery}
                            />
                            <TouchableOpacity
                                style={styles.newCustomerBtn}
                                onPress={() => setShowNewCustomerForm(true)}
                            >
                                <Icon name="account-plus" size={18} color="#10B981" />
                                <Text style={styles.newCustomerBtnText}>Add New Customer</Text>
                            </TouchableOpacity>
                            <FlatList
                                data={filteredCustomers}
                                keyExtractor={c => c.customer_id}
                                renderItem={({ item: c }) => (
                                    <TouchableOpacity
                                        style={styles.customerRow}
                                        onPress={() => { setSelectedCustomer(c); setShowCustomerPicker(false); }}
                                    >
                                        <View style={styles.customerAvatar}>
                                            <Text style={styles.customerAvatarText}>{c.name[0]}</Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.customerRowName}>{c.name}</Text>
                                            <Text style={styles.customerRowPhone}>{c.contact_phone}</Text>
                                        </View>
                                        {c.outstanding_balance > 0 &&
                                            <Text style={styles.outstandingBadge}>
                                                ₹{c.outstanding_balance.toLocaleString('en-IN')}
                                            </Text>
                                        }
                                    </TouchableOpacity>
                                )}
                                ListEmptyComponent={
                                    <Text style={{ textAlign: 'center', color: '#999', padding: 30 }}>
                                        No customers found. Add one above.
                                    </Text>
                                }
                            />
                        </>
                    ) : (
                        <ScrollView contentContainerStyle={{ padding: 20 }}>
                            <Text style={styles.sectionTitle}>New Customer</Text>
                            <Text style={styles.fieldLabel}>Full Name *</Text>
                            <TextInput style={styles.input} value={newCustName} onChangeText={setNewCustName} placeholder="e.g. Sharma Metals" />
                            <Text style={styles.fieldLabel}>Phone *</Text>
                            <TextInput style={styles.input} value={newCustPhone} onChangeText={setNewCustPhone} keyboardType="phone-pad" placeholder="9876543210" />
                            <Text style={styles.fieldLabel}>GST Number (optional)</Text>
                            <TextInput style={styles.input} value={newCustGST} onChangeText={setNewCustGST} placeholder="27AABCU9603R1ZX" autoCapitalize="characters" />
                            <TouchableOpacity
                                style={[styles.saveBtn, { marginTop: 10, paddingVertical: 14, borderRadius: 12 }]}
                                onPress={handleCreateNewCustomer}
                                disabled={loading}
                            >
                                {loading
                                    ? <ActivityIndicator color="#FFF" />
                                    : <Text style={[styles.saveBtnText, { textAlign: 'center' }]}>Save Customer</Text>
                                }
                            </TouchableOpacity>
                            <TouchableOpacity style={{ marginTop: 15, alignItems: 'center' }} onPress={() => setShowNewCustomerForm(false)}>
                                <Text style={{ color: '#6B7280' }}>← Back to list</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    )}
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F5F5F5' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingBottom: 14,
        paddingTop: (StatusBar.currentHeight ?? 24) + 10,
        backgroundColor: '#1B6B2F', elevation: 4,
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
    saveBtn: { backgroundColor: '#FFF', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8 },
    saveBtnText: { color: '#1B6B2F', fontWeight: '700', fontSize: 15 },

    body: { padding: 16, paddingBottom: 60 },
    section: { backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginBottom: 14, elevation: 1 },
    sectionTitle: { fontSize: 13, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },

    customerPicker: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10, padding: 13, gap: 10 },
    customerPickerText: { flex: 1, color: '#9CA3AF', fontSize: 15 },
    customerDetail: { marginTop: 10, backgroundColor: '#F0FDF4', borderRadius: 8, padding: 10, gap: 4 },
    customerPhone: { fontSize: 13, color: '#374151' },
    customerGST: { fontSize: 12, color: '#6B7280' },
    customerOutstanding: { fontSize: 12, color: '#B45309', fontWeight: '600' },

    itemCard: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
    itemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    itemLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
    chip: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F3F4F6', borderRadius: 20, marginRight: 8 },
    chipActive: { backgroundColor: '#10B981' },
    chipText: { fontSize: 13, color: '#374151' },
    row: { flexDirection: 'row' },
    fieldLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', marginBottom: 5, textTransform: 'uppercase' },
    input: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 9, padding: 11, fontSize: 15, backgroundColor: '#FFF', color: '#111', marginBottom: 12 },
    itemTotal: { fontSize: 14, fontWeight: '700', color: '#10B981', textAlign: 'right' },

    addItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, justifyContent: 'center', borderWidth: 1.5, borderColor: '#10B981', borderRadius: 10, borderStyle: 'dashed' },
    addItemText: { color: '#10B981', fontWeight: '600', fontSize: 14 },

    totalCard: { backgroundColor: '#1B6B2F', borderRadius: 16, padding: 24, alignItems: 'center', marginTop: 4 },
    totalLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginBottom: 6 },
    totalValue: { color: '#FFF', fontSize: 36, fontWeight: '800' },

    // Modal
    modalRoot: { flex: 1, backgroundColor: '#F9FAFB' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#FFF', elevation: 2 },
    modalTitle: { fontSize: 18, fontWeight: '700' },
    newCustomerBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 15, marginVertical: 8, padding: 12, backgroundColor: '#F0FDF4', borderRadius: 10, borderWidth: 1, borderColor: '#10B981' },
    newCustomerBtnText: { color: '#10B981', fontWeight: '600', fontSize: 14 },
    customerRow: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderColor: '#F3F4F6', gap: 12 },
    customerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' },
    customerAvatarText: { fontSize: 16, fontWeight: '700', color: '#10B981' },
    customerRowName: { fontSize: 15, fontWeight: '600', color: '#111' },
    customerRowPhone: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    outstandingBadge: { fontSize: 11, color: '#B45309', fontWeight: '700', backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
});
