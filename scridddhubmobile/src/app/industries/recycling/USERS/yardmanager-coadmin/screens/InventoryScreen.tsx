import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const InventoryScreen = ({ navigation }: any) => {
    const inventoryItems = [
        { id: 1, name: 'Plastic Bottles', quantity: 450, unit: 'kg', status: 'In Stock' },
        { id: 2, name: 'Cardboard', quantity: 230, unit: 'kg', status: 'Low Stock' },
        { id: 3, name: 'Metal Cans', quantity: 180, unit: 'kg', status: 'In Stock' },
        { id: 4, name: 'Glass', quantity: 120, unit: 'kg', status: 'In Stock' },
        { id: 5, name: 'Paper', quantity: 340, unit: 'kg', status: 'In Stock' },
    ];

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <Text style={styles.backIcon}>←</Text>
                </TouchableOpacity>
                <Text style={styles.title}>📦 Inventory</Text>
            </View>

            {/* Content */}
            <ScrollView style={styles.scrollView}>
                <View style={styles.content}>
                    <Text style={styles.subtitle}>Material Stock Levels</Text>

                    {inventoryItems.map((item) => (
                        <View key={item.id} style={styles.inventoryCard}>
                            <View style={styles.inventoryHeader}>
                                <Text style={styles.itemName}>{item.name}</Text>
                                <View style={[
                                    styles.statusBadge,
                                    item.status === 'Low Stock' && styles.statusLow
                                ]}>
                                    <Text style={[
                                        styles.statusText,
                                        item.status === 'Low Stock' && styles.statusTextLow
                                    ]}>
                                        {item.status}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.inventoryFooter}>
                                <Text style={styles.quantity}>
                                    {item.quantity} <Text style={styles.unit}>{item.unit}</Text>
                                </Text>
                                <TouchableOpacity style={styles.updateButton}>
                                    <Text style={styles.updateButtonText}>Update</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}

                    <TouchableOpacity style={styles.addButton}>
                        <Text style={styles.addButtonText}>+ Add New Material</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 24,
        paddingBottom: 16,
    },
    backButton: {
        marginRight: 16,
        padding: 4,
    },
    backIcon: {
        fontSize: 24,
        color: '#378839',
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#378839',
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: 24,
        paddingTop: 0,
    },
    subtitle: {
        fontSize: 16,
        color: '#6B7280',
        marginBottom: 16,
    },
    inventoryCard: {
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    inventoryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    itemName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: '#DCFCE7',
    },
    statusLow: {
        backgroundColor: '#FEF3C7',
    },
    statusText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#378839',
    },
    statusTextLow: {
        color: '#92400E',
    },
    inventoryFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    quantity: {
        fontSize: 24,
        fontWeight: '700',
        color: '#378839',
    },
    unit: {
        fontSize: 16,
        fontWeight: '400',
        color: '#6B7280',
    },
    updateButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#378839',
    },
    updateButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#378839',
    },
    addButton: {
        backgroundColor: '#378839',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    addButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});