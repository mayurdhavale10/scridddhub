import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { InventoryAPI } from '../../../../../services/inventory.service';

const TENANT_ID = 'demo-tenant';

export const MovementForm = ({ route, navigation }: any) => {
    // Expected route params: { type: 'receive' | 'issue' | 'transfer' }
    const { type = 'receive' } = route.params || {};

    const [itemId, setItemId] = useState('');
    const [quantity, setQuantity] = useState('');
    const [location, setLocation] = useState('Main Warehouse'); // Target or Source depending on type
    const [submitting, setSubmitting] = useState(false);

    const isIssue = type === 'issue' || type === 'scrap';

    const handleSubmit = async () => {
        if (!itemId || !quantity) return;

        setSubmitting(true);
        try {
            const movement = {
                itemId,
                quantity: Number(quantity),
                type,
                // Construct location object based on type
                ...(isIssue
                    ? { from: { warehouseId: location } }
                    : { to: { warehouseId: location } }
                ),
                notes: 'Mobile App Entry',
                userId: 'user-mobile-01'
            };

            await InventoryAPI.recordMovement(TENANT_ID, movement);
            Alert.alert('Success', `Stock ${isIssue ? 'Issued' : 'Received'} Successfully`, [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } catch (error: any) {
            Alert.alert('Error', error.request?.response || 'Failed to record movement');
            console.error(error);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>{type.toUpperCase()} STOCK</Text>
            </View>

            <View style={styles.form}>
                <Text style={styles.label}>Item SKU</Text>
                <TextInput
                    style={styles.input}
                    placeholder="e.g. PLASTIC-PET-001"
                    placeholderTextColor="#666"
                    value={itemId}
                    onChangeText={setItemId}
                    autoCapitalize="characters"
                />

                <Text style={styles.label}>Quantity</Text>
                <TextInput
                    style={styles.input}
                    placeholder="0.00"
                    placeholderTextColor="#666"
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="numeric"
                />

                <Text style={styles.label}>{isIssue ? 'From Warehouse' : 'To Warehouse'}</Text>
                <TextInput
                    style={styles.input}
                    value={location}
                    onChangeText={setLocation}
                />

                <TouchableOpacity
                    style={[styles.submitButton, isIssue ? styles.issueBtn : styles.receiveBtn]}
                    onPress={handleSubmit}
                    disabled={submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color="#000" />
                    ) : (
                        <Text style={styles.submitText}>CONFIRM {type.toUpperCase()}</Text>
                    )}
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#121212' },
    header: { padding: 20, paddingTop: 60, backgroundColor: '#1E1E1E' },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },

    form: { padding: 20 },
    label: { color: '#888', marginBottom: 8, marginTop: 15 },
    input: { backgroundColor: '#2C2C2C', color: '#fff', padding: 15, borderRadius: 10, fontSize: 16 },

    submitButton: { marginTop: 40, padding: 18, borderRadius: 12, alignItems: 'center' },
    receiveBtn: { backgroundColor: '#00E676' },
    issueBtn: { backgroundColor: '#2979FF' },
    submitText: { color: '#000', fontWeight: 'bold', fontSize: 16 }
});
