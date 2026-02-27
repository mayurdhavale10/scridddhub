import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    StatusBar, Modal, TextInput, ActivityIndicator, Alert,
    ScrollView
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { getFleet, addVehicle } from '../../../../../../../shared/logistics/api';

const APP_GREEN = '#1B6B2F';
const TENANT = 'TENANT-001';

export const VehiclesScreen = ({ navigation }: any) => {
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);

    // Form State
    const [vNumber, setVNumber] = useState('');
    const [vType, setVType] = useState('truck_6w');
    const [vLoad, setVLoad] = useState('');
    const [vUnit, setVUnit] = useState('kg');
    const [vPhone, setVPhone] = useState('');
    const [customUnit, setCustomUnit] = useState('');
    const [useCustomUnit, setUseCustomUnit] = useState(false);

    // Custom Dynamic Parameters
    const [customParams, setCustomParams] = useState<{ key: string, value: string }[]>([]);

    useEffect(() => {
        loadFleet();
    }, []);

    const loadFleet = async () => {
        try {
            setLoading(true);
            const res = await getFleet(TENANT);
            setVehicles(res.data.vehicles || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const addParamField = () => {
        setCustomParams([...customParams, { key: '', value: '' }]);
    };

    const updateParam = (index: number, field: 'key' | 'value', text: string) => {
        const newParams = [...customParams];
        newParams[index][field] = text;
        setCustomParams(newParams);
    };

    const removeParam = (index: number) => {
        setCustomParams(customParams.filter((_, i) => i !== index));
    };

    const handleAddVehicle = async () => {
        if (!vNumber || !vLoad) return Alert.alert("Required", "Vehicle number and capacity are required");

        const finalUnit = useCustomUnit ? customUnit : vUnit;
        if (useCustomUnit && !customUnit) return Alert.alert("Required", "Please enter a custom unit");

        // Convert params array to an object
        const extraDetails: Record<string, string> = {};
        customParams.forEach(p => {
            if (p.key.trim()) extraDetails[p.key.trim()] = p.value;
        });

        try {
            await addVehicle(TENANT, {
                vehicle_number: vNumber,
                vehicle_type: vType,
                capacity: parseInt(vLoad),
                unit: finalUnit,
                phone: vPhone,
                owned_by_tenant: true,
                active: true,
                extra_details: extraDetails
            });
            setModalVisible(false);
            setVNumber('');
            setVLoad('');
            setVPhone('');
            setVUnit('kg');
            setCustomUnit('');
            setUseCustomUnit(false);
            setCustomParams([]);
            loadFleet();
        } catch (e) {
            Alert.alert("Error", "Failed to add vehicle");
        }
    };

    return (

        <SafeAreaView style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Icon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Fleet Inventory</Text>
                <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
                    <Icon name="plus" size={22} color="#FFF" />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.loader}>
                    <ActivityIndicator color={APP_GREEN} size="large" />
                </View>
            ) : (
                <FlatList
                    data={vehicles}
                    keyExtractor={item => item.vehicle_id}
                    renderItem={({ item }) => <VehicleCard item={item} />}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Icon name="truck-outline" size={48} color="#D1D5DB" />
                            <Text style={styles.emptyText}>No vehicles found in fleet.</Text>
                        </View>
                    }
                />
            )}

            {/* Add Vehicle Modal */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <ScrollView contentContainerStyle={{ justifyContent: 'flex-end', flexGrow: 1 }}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Add New Vehicle</Text>
                                <TouchableOpacity onPress={() => setModalVisible(false)}>
                                    <Icon name="close" size={24} color="#6B7280" />
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.label}>Vehicle Number</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. MH01-AV-1234"
                                value={vNumber}
                                onChangeText={setVNumber}
                            />

                            <Text style={styles.label}>Max Capacity</Text>
                            <View style={styles.capacityRow}>
                                <TextInput
                                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                                    placeholder="e.g. 12000"
                                    keyboardType="numeric"
                                    value={vLoad}
                                    onChangeText={setVLoad}
                                />
                                {!useCustomUnit ? (
                                    <View style={styles.unitContainer}>
                                        {['kg', 'Tons'].map((u) => (
                                            <TouchableOpacity
                                                key={u}
                                                style={[styles.unitBtn, vUnit === u && styles.unitBtnActive]}
                                                onPress={() => setVUnit(u)}
                                            >
                                                <Text style={[styles.unitBtnText, vUnit === u && styles.unitBtnTextActive]}>{u}</Text>
                                            </TouchableOpacity>
                                        ))}
                                        <TouchableOpacity
                                            style={styles.unitBtn}
                                            onPress={() => setUseCustomUnit(true)}
                                        >
                                            <Text style={styles.unitBtnText}>Other</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <TextInput
                                            style={[styles.input, { flex: 1, marginBottom: 0 }]}
                                            placeholder="Unit (e.g. mg)"
                                            value={customUnit}
                                            onChangeText={setCustomUnit}
                                            autoFocus
                                        />
                                        <TouchableOpacity onPress={() => { setUseCustomUnit(false); setCustomUnit(''); }}>
                                            <Icon name="close-circle" size={24} color="#DC2626" />
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>

                            <Text style={[styles.label, { marginTop: 20 }]}>Contact / Phone Number</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. +91 98765 43210"
                                keyboardType="phone-pad"
                                value={vPhone}
                                onChangeText={setVPhone}
                            />

                            <View style={styles.divider} />

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <Text style={styles.label}>EXTRA INFORMATION</Text>
                                <TouchableOpacity onPress={addParamField} style={styles.addParamBtn}>
                                    <Icon name="plus-circle-outline" size={18} color={APP_GREEN} />
                                    <Text style={styles.addParamText}>Add New Detail</Text>
                                </TouchableOpacity>
                            </View>

                            {customParams.map((param, index) => (
                                <View key={index} style={styles.paramRow}>
                                    <TextInput
                                        style={[styles.input, { flex: 1, marginBottom: 0 }]}
                                        placeholder="Label (e.g. Yard)"
                                        value={param.key}
                                        onChangeText={(t) => updateParam(index, 'key', t)}
                                    />
                                    <TextInput
                                        style={[styles.input, { flex: 1, marginBottom: 0 }]}
                                        placeholder="Detail"
                                        value={param.value}
                                        onChangeText={(t) => updateParam(index, 'value', t)}
                                    />
                                    <TouchableOpacity onPress={() => removeParam(index)}>
                                        <Icon name="trash-can-outline" size={24} color="#DC2626" />
                                    </TouchableOpacity>
                                </View>
                            ))}


                            <TouchableOpacity style={styles.saveBtn} onPress={handleAddVehicle}>
                                <Text style={styles.saveBtnText}>Save Vehicle</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const VehicleCard = ({ item }: any) => {
    const extras = item.extra_details ? Object.entries(item.extra_details) : [];

    return (
        <TouchableOpacity style={styles.card}>
            <View style={styles.iconBox}>
                <Icon name={item.vehicle_type === 'pickup' ? 'truck-delivery' : 'truck-cargo-container'} size={32} color={APP_GREEN} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.vNumber}>{item.vehicle_number}</Text>
                <Text style={styles.vType}>
                    {item.vehicle_type.replace('_', ' ').toUpperCase()} • {item.capacity} {item.unit}
                </Text>

                {extras.length > 0 && (
                    <View style={styles.extrasContainer}>
                        {extras.map(([key, val]: any) => (
                            <View key={key} style={styles.extraTag}>
                                <Text style={styles.extraTagText}>{key}: {val}</Text>
                            </View>
                        ))}
                    </View>
                )}

                <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                    <View style={[styles.statusBadge, { backgroundColor: item.active ? '#DCFCE7' : '#FEF2F2' }]}>
                        <Text style={[styles.statusText, { color: item.active ? '#15803D' : '#DC2626' }]}>{item.active ? 'Active' : 'Offline'}</Text>
                    </View>
                    {item.is_busy && (
                        <View style={[styles.statusBadge, { backgroundColor: '#DBEAFE' }]}>
                            <Text style={[styles.statusText, { color: '#2563EB' }]}>En Route</Text>
                        </View>
                    )}
                </View>
            </View>
            <TouchableOpacity style={styles.editBtn}>
                <Icon name="pencil-outline" size={20} color="#6B7280" />
            </TouchableOpacity>
        </TouchableOpacity>
    );
};



const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
    headerTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
    addBtn: { backgroundColor: APP_GREEN, width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    list: { padding: 20 },
    card: { backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
    iconBox: { width: 64, height: 64, borderRadius: 16, backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center' },
    vNumber: { fontSize: 17, fontWeight: '800', color: '#111827' },
    vType: { fontSize: 13, color: '#6B7280', marginTop: 2, fontWeight: '500', letterSpacing: 0.5 },
    statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 8 },
    statusText: { fontSize: 11, fontWeight: '700' },
    editBtn: { padding: 8 },

    empty: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: '#9CA3AF', marginTop: 12, fontSize: 14, fontWeight: '600' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    modalTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
    label: { fontSize: 12, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1 },
    input: { backgroundColor: '#F3F4F6', borderRadius: 12, padding: 14, fontSize: 16, color: '#111827', marginBottom: 20 },
    saveBtn: { backgroundColor: APP_GREEN, padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 10 },
    saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
    capacityRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    unitContainer: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 12, padding: 4 },
    unitBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
    unitBtnActive: { backgroundColor: '#FFF', elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 },
    unitBtnText: { fontSize: 12, fontWeight: '700', color: '#9CA3AF' },
    unitBtnTextActive: { color: APP_GREEN },
    extrasContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    extraTag: { backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    extraTagText: { fontSize: 11, fontWeight: '600', color: '#4B5563' },
    divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 20 },
    addParamBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    addParamText: { fontSize: 12, fontWeight: '700', color: APP_GREEN },
    paramRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }
});

