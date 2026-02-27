import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    StatusBar, Modal, TextInput, ActivityIndicator, Alert,
    ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { getFleet, addDriver } from '../../../../../../../shared/logistics/api';

const APP_GREEN = '#1B6B2F';
const TENANT = 'TENANT-001';

export const DriversScreen = ({ navigation }: any) => {
    const [drivers, setDrivers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);

    // Form State
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [license, setLicense] = useState('');

    // Custom Dynamic Parameters (Extra Information)
    const [customParams, setCustomParams] = useState<{ key: string, value: string }[]>([]);

    useEffect(() => {
        loadFleet();
    }, []);

    const loadFleet = async () => {
        try {
            setLoading(true);
            const res = await getFleet(TENANT);
            setDrivers(res.data.drivers || []);
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

    const handleAddDriver = async () => {
        if (!name || !phone || !license) return Alert.alert("Required", "All fields are required");

        // Convert params array to an object
        const extraDetails: Record<string, string> = {};
        customParams.forEach(p => {
            if (p.key.trim()) extraDetails[p.key.trim()] = p.value;
        });

        try {
            await addDriver(TENANT, {
                name,
                phone,
                license_number: license,
                active: true,
                extra_details: extraDetails
            });
            setModalVisible(false);
            setName('');
            setPhone('');
            setLicense('');
            setCustomParams([]);
            loadFleet();
        } catch (e) {
            Alert.alert("Error", "Failed to add driver");
        }
    };

    return (
        <SafeAreaView style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Icon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Driver Roster</Text>
                <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
                    <Icon name="account-plus" size={22} color="#FFF" />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.loader}>
                    <ActivityIndicator color={APP_GREEN} size="large" />
                </View>
            ) : (
                <FlatList
                    data={drivers}
                    keyExtractor={item => item.driver_id}
                    renderItem={({ item }) => <DriverCard item={item} />}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Icon name="account-search-outline" size={48} color="#D1D5DB" />
                            <Text style={styles.emptyText}>No drivers registered.</Text>
                        </View>
                    }
                />
            )}

            {/* Add Driver Modal */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <ScrollView contentContainerStyle={{ justifyContent: 'flex-end', flexGrow: 1 }}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Register Driver</Text>
                                <TouchableOpacity onPress={() => setModalVisible(false)}>
                                    <Icon name="close" size={24} color="#6B7280" />
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.label}>Full Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. Rahul Sharma"
                                value={name}
                                onChangeText={setName}
                            />

                            <Text style={styles.label}>Phone Number</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. 9876543210"
                                keyboardType="phone-pad"
                                value={phone}
                                onChangeText={setPhone}
                            />

                            <Text style={styles.label}>License Number</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. DL-12345678"
                                value={license}
                                onChangeText={setLicense}
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
                                        placeholder="Label (e.g. Blood Group)"
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

                            <TouchableOpacity style={styles.saveBtn} onPress={handleAddDriver}>
                                <Text style={styles.saveBtnText}>Register Staff</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const DriverCard = ({ item }: any) => {
    const extras = item.extra_details ? Object.entries(item.extra_details) : [];

    return (
        <TouchableOpacity style={styles.card}>
            <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.phone}>{item.phone}</Text>

                {extras.length > 0 && (
                    <View style={styles.extrasContainer}>
                        {extras.map(([key, val]: any) => (
                            <View key={key} style={styles.extraTag}>
                                <Text style={styles.extraTagText}>{key}: {val}</Text>
                            </View>
                        ))}
                    </View>
                )}

                <View style={styles.statsRow}>
                    <Icon name="card-account-details-outline" size={14} color="#6B7280" />
                    <Text style={styles.stats}>DL: {item.license_number}</Text>
                </View>
            </View>
            <View style={[styles.statusDot, { backgroundColor: item.active ? '#15803D' : '#9CA3AF' }]} />
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
    card: { backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 16, borderLeftWidth: 4, borderLeftColor: APP_GREEN, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 18, fontWeight: '800', color: APP_GREEN },
    name: { fontSize: 16, fontWeight: '800', color: '#111827' },
    phone: { fontSize: 13, color: '#6B7280', marginTop: 1 },
    statsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    stats: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
    statusDot: { width: 10, height: 10, borderRadius: 5 },

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

    extrasContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    extraTag: { backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    extraTagText: { fontSize: 11, fontWeight: '600', color: '#4B5563' },
    divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 20 },
    addParamBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    addParamText: { fontSize: 12, fontWeight: '700', color: APP_GREEN },
    paramRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }
});

