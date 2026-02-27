import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    StatusBar,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useIsFocused } from '@react-navigation/native';
import { useStaffStore } from '../../../../../../../../store/tempStaffStore';

export const StaffList = ({ route, navigation }: any) => {
    const { filterRole } = route.params || {}; // 'yard_manager' or 'operator'
    const [search, setSearch] = useState('');
    const isFocused = useIsFocused(); // Refresh when screen comes into focus

    // Get real data from our store
    const { staffMembers } = useStaffStore();
    const allStaff = staffMembers;

    const filteredStaff = allStaff.filter(user => {
        const matchesRole = filterRole ? user.role === filterRole : true;
        const matchesSearch = user.name.toLowerCase().includes(search.toLowerCase());
        return matchesRole && matchesSearch;
    });

    const getRoleLabel = (role: string) => {
        if (role === 'yard_manager') return 'Yard Manager';
        if (role === 'operator') return 'Operator';
        return role;
    };

    const renderItem = ({ item }: any) => (
        <TouchableOpacity style={styles.card}>
            <View style={styles.avatarContainer}>
                <Icon
                    name={item.role === 'yard_manager' ? "account-hard-hat" : "account-group"}
                    size={24}
                    color="#1D7A27"
                />
            </View>
            <View style={styles.info}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.role}>{getRoleLabel(item.role)}</Text>
            </View>
            <View style={styles.statusContainer}>
                <View style={[styles.statusDot, { backgroundColor: item.status === 'Active' ? '#2E7D32' : '#9E9E9E' }]} />
                <Text style={styles.status}>{item.status}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Icon name="arrow-left" size={24} color="#111" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    {filterRole ? `${getRoleLabel(filterRole)}s` : 'All Staff'}
                </Text>
                {/* Placeholder for right action if needed */}
                <View style={{ width: 40 }} />
            </View>

            {/* Search */}
            <View style={styles.searchContainer}>
                <Icon name="magnify" size={20} color="#666" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search staff..."
                    value={search}
                    onChangeText={setSearch}
                />
            </View>

            {/* List */}
            <FlatList
                data={filteredStaff}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>No staff found.</Text>
                    </View>
                }
            />

            {/* FAB to Add Staff */}
            <TouchableOpacity
                style={styles.fab}
                onPress={() => navigation.navigate('AddStaffScreen', { defaultRole: filterRole })}
            >
                <Icon name="plus" size={28} color="#FFF" />
            </TouchableOpacity>

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
    headerTitle: { fontSize: 20, fontWeight: '700', color: '#111', flex: 1, textAlign: 'center' },

    searchContainer: {
        margin: 20,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderRadius: 12,
        paddingHorizontal: 15,
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    searchIcon: { marginRight: 10 },
    searchInput: { flex: 1, paddingVertical: 12, fontSize: 16, color: '#111' },

    listContent: { paddingHorizontal: 20, paddingBottom: 80 },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        padding: 15,
        borderRadius: 12,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    avatarContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#E8F5E9',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    info: { flex: 1 },
    name: { fontSize: 16, fontWeight: '600', color: '#111' },
    role: { fontSize: 14, color: '#666' },

    statusContainer: { alignItems: 'flex-end' },
    statusDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 4 },
    status: { fontSize: 12, color: '#666' },

    emptyState: { alignItems: 'center', marginTop: 50 },
    emptyText: { color: '#999', fontSize: 16 },

    fab: {
        position: 'absolute',
        bottom: 30,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#1D7A27',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#1D7A27',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    }
});
