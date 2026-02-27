import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    StatusBar,
    ScrollView,
    Alert,
    ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useStaffStore } from '../../../../../../../../store/tempStaffStore';

export const AddStaffScreen = ({ route, navigation }: any) => {
    const { defaultRole } = route.params || {};
    const addStaff = useStaffStore(state => state.addStaff);

    // Form State
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState(defaultRole || 'yard_manager');
    const [isLoading, setIsLoading] = useState(false);

    const handleCreate = async () => {
        if (!name || !phone || !password) {
            Alert.alert("Error", "Please fill all fields.");
            return;
        }

        setIsLoading(true);

        // SAVE TO TEMP STORE (Actual Persistence)
        const newStaff = {
            id: Date.now().toString(),
            name,
            phone,
            role,
            status: 'Active',
            joinedAt: new Date().toLocaleDateString()
        };

        // Add to Store
        addStaff(newStaff as any);

        setTimeout(() => {
            setIsLoading(false);
            Alert.alert(
                "Success",
                `${name} has been added as a ${role === 'yard_manager' ? 'Yard Manager' : 'Operator'}.`,
                [{ text: "OK", onPress: () => navigation.goBack() }]
            );
        }, 1000);
    };

    const RoleOption = ({ value, label, icon }: any) => (
        <TouchableOpacity
            style={[styles.roleOption, role === value && styles.roleOptionSelected]}
            onPress={() => setRole(value)}
        >
            <Icon
                name={icon}
                size={24}
                color={role === value ? '#1D7A27' : '#666'}
            />
            <Text style={[styles.roleText, role === value && styles.roleTextSelected]}>
                {label}
            </Text>
            {role === value && (
                <View style={styles.checkCircle}>
                    <Icon name="check" size={12} color="#FFF" />
                </View>
            )}
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Icon name="close" size={24} color="#111" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Add New Staff</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.formContainer}>

                <Text style={styles.sectionLabel}>Select Role</Text>
                <View style={styles.roleRow}>
                    <RoleOption value="yard_manager" label="Yard Manager" icon="account-hard-hat" />
                    <RoleOption value="operator" label="Operator" icon="account-group" />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Full Name</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. John Doe"
                        value={name}
                        onChangeText={setName}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Phone Number (Login ID)</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. +91 98765 43210"
                        keyboardType="phone-pad"
                        value={phone}
                        onChangeText={setPhone}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Initial Password</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Create a strong password"
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                    />
                    <Text style={styles.helperText}>User will be asked to change this on first login.</Text>
                </View>

            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.createBtn}
                    onPress={handleCreate}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Text style={styles.createBtnText}>Create Account</Text>
                    )}
                </TouchableOpacity>
            </View>

        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    backBtn: { padding: 5, marginRight: 10 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#111', flex: 1, textAlign: 'center' },

    formContainer: { padding: 20 },

    sectionLabel: { fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 12 },
    roleRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
    roleOption: {
        width: '48%',
        backgroundColor: '#FFF',
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#E0E0E0',
        position: 'relative',
    },
    roleOptionSelected: {
        borderColor: '#1D7A27',
        backgroundColor: '#E8F5E9',
    },
    roleText: { marginTop: 8, fontSize: 14, fontWeight: '600', color: '#666' },
    roleTextSelected: { color: '#1D7A27' },
    checkCircle: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#1D7A27',
        justifyContent: 'center',
        alignItems: 'center',
    },

    inputGroup: { marginBottom: 20 },
    label: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 8 },
    input: {
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 10,
        paddingHorizontal: 15,
        paddingVertical: 12,
        fontSize: 16,
        color: '#111',
    },
    helperText: { fontSize: 12, color: '#888', marginTop: 5 },

    footer: {
        padding: 20,
        backgroundColor: '#FFF',
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    createBtn: {
        backgroundColor: '#1D7A27',
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        shadowColor: 'rgba(29, 122, 39, 0.4)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 8,
        elevation: 6,
    },
    createBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});
