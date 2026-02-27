import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Alert, ActivityIndicator, Clipboard
} from 'react-native';
import { getSalesConfig, updateSalesConfig } from '../../../../../../../../shared/inventory/api';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const TENANT = 'TENANT-001';

const ENDPOINTS = [
    {
        method: 'GET',
        path: '/api/public/TENANT-001/stock',
        desc: 'List all available stock lots (sorted oldest first)',
        color: '#10B981',
    },
    {
        method: 'POST',
        path: '/api/public/TENANT-001/stock/deduct',
        desc: 'Deduct sold weight from a specific lot',
        color: '#F59E0B',
        body: '{\n  "lot_id": "LOT-001",\n  "weight_kg": 500\n}',
    },
];

export default function ExternalAPIScreen({ navigation }: any) {
    const [config, setConfig] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [regenerating, setRegenerating] = useState(false);
    const [keyVisible, setKeyVisible] = useState(false);

    const load = async () => {
        try {
            setLoading(true);
            const res = await getSalesConfig(TENANT);
            if (res.success) setConfig(res.data);
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally { setLoading(false); }
    };

    useEffect(() => {
        load();
        const unsub = navigation.addListener('focus', load);
        return unsub;
    }, [navigation]);

    const copyKey = () => {
        if (config?.external_api_key) {
            Clipboard.setString(config.external_api_key);
            Alert.alert('✅ Copied', 'API key copied to clipboard');
        }
    };

    const regenerateKey = () => {
        Alert.alert(
            'Regenerate API Key?',
            'This will invalidate your current key. Any connected systems will stop working until you update them.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Regenerate', style: 'destructive',
                    onPress: async () => {
                        setRegenerating(true);
                        try {
                            // Force regeneration by temporarily clearing the key
                            await updateSalesConfig(TENANT, { sales_mode: 'integrated' });
                            await updateSalesConfig(TENANT, { sales_mode: 'external_api' });
                            await load();
                        } catch (e: any) {
                            Alert.alert('Error', e.message);
                        } finally { setRegenerating(false); }
                    }
                }
            ]
        );
    };

    const switchToIntegrated = () => {
        Alert.alert(
            'Switch to In-house Sales?',
            'External API access will be disabled. You can switch back anytime.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Switch', onPress: async () => {
                        await updateSalesConfig(TENANT, { sales_mode: 'integrated' });
                        navigation.replace('SalesOrderList');
                    }
                }
            ]
        );
    };

    if (loading) return (
        <View style={styles.center}>
            <ActivityIndicator size="large" color="#3B82F6" />
        </View>
    );

    const apiKey = config?.external_api_key || '';
    const maskedKey = apiKey
        ? `sk_live_${'•'.repeat(20)}${apiKey.slice(-4)}`
        : 'Not generated yet';

    return (
        <View style={styles.root}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Icon name="arrow-left" size={24} color="#FFF" />
                </TouchableOpacity>
                <View style={{ alignItems: 'center' }}>
                    <Text style={styles.headerTitle}>External API</Text>
                    <View style={styles.activeBadge}>
                        <View style={styles.activeDot} />
                        <Text style={styles.activeBadgeText}>Active</Text>
                    </View>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('SalesConfig')}>
                    <Icon name="cog" size={24} color="#94A3B8" />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.body}>

                {/* API KEY CARD */}
                <View style={styles.keyCard}>
                    <Text style={styles.keyLabel}>YOUR API KEY</Text>
                    <Text style={styles.keyNote}>
                        Share with your IT team. Keep it secret — it grants write access to your inventory.
                    </Text>

                    <View style={styles.keyRow}>
                        <Text style={styles.keyValue} numberOfLines={1}>
                            {keyVisible ? apiKey : maskedKey}
                        </Text>
                        <TouchableOpacity onPress={() => setKeyVisible(v => !v)} style={styles.eyeBtn}>
                            <Icon name={keyVisible ? 'eye-off' : 'eye'} size={18} color="#94A3B8" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={copyKey} style={styles.copyBtn}>
                            <Icon name="content-copy" size={18} color="#60A5FA" />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={[styles.regenBtn, regenerating && { opacity: 0.5 }]}
                        onPress={regenerateKey}
                        disabled={regenerating}
                    >
                        {regenerating
                            ? <ActivityIndicator size="small" color="#EF4444" />
                            : <Icon name="refresh" size={14} color="#EF4444" />
                        }
                        <Text style={styles.regenText}>Regenerate Key</Text>
                    </TouchableOpacity>
                </View>

                {/* AUTHENTICATION */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Authentication</Text>
                    <View style={styles.codeBlock}>
                        <Text style={styles.code}>
                            {'# Add this header to every request\nX-API-Key: ' + (keyVisible ? apiKey : maskedKey)}
                        </Text>
                    </View>
                </View>

                {/* ENDPOINTS */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Available Endpoints</Text>
                    {ENDPOINTS.map((ep, i) => (
                        <View key={i} style={styles.endpointCard}>
                            <View style={styles.endpointHeader}>
                                <View style={[styles.methodBadge, { backgroundColor: ep.color }]}>
                                    <Text style={styles.methodText}>{ep.method}</Text>
                                </View>
                                <Text style={styles.endpointPath}>{ep.path}</Text>
                            </View>
                            <Text style={styles.endpointDesc}>{ep.desc}</Text>
                            {ep.body && (
                                <View style={styles.codeBlock}>
                                    <Text style={styles.code}>{ep.body}</Text>
                                </View>
                            )}
                        </View>
                    ))}
                </View>

                {/* QUICK TEST */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Quick Test (cURL)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.codeBlock}>
                            <Text style={styles.code}>
                                {'curl -H "X-API-Key: YOUR_KEY" \\\n  http://YOUR_SERVER/api/public/TENANT-001/stock'}
                            </Text>
                        </View>
                    </ScrollView>
                </View>

                {/* STOCK STATS */}
                <TouchableOpacity
                    style={styles.switchCard}
                    onPress={switchToIntegrated}
                >
                    <Icon name="store" size={20} color="#10B981" />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.switchTitle}>Switch to In-house Sales</Text>
                        <Text style={styles.switchDesc}>Use ScridddHub's built-in orders & CRM instead</Text>
                    </View>
                    <Icon name="chevron-right" size={20} color="#64748B" />
                </TouchableOpacity>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#0F172A' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A' },

    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingTop: 56, paddingBottom: 20,
    },
    headerTitle: { fontSize: 16, fontWeight: '700', color: '#F1F5F9' },
    activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
    activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#10B981' },
    activeBadgeText: { fontSize: 11, color: '#10B981', fontWeight: '700' },

    body: { padding: 16, paddingBottom: 50 },

    keyCard: { backgroundColor: '#1E293B', borderRadius: 18, padding: 18, marginBottom: 16 },
    keyLabel: { color: '#60A5FA', fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginBottom: 6 },
    keyNote: { color: '#94A3B8', fontSize: 12, lineHeight: 18, marginBottom: 14 },
    keyRow: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A',
        borderRadius: 10, padding: 12, gap: 8, marginBottom: 14,
    },
    keyValue: { flex: 1, color: '#60A5FA', fontFamily: 'monospace', fontSize: 12 },
    eyeBtn: { padding: 4 },
    copyBtn: { padding: 4 },
    regenBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end' },
    regenText: { color: '#EF4444', fontSize: 12, fontWeight: '600' },

    section: { marginBottom: 16 },
    sectionTitle: { color: '#94A3B8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },

    codeBlock: { backgroundColor: '#1E293B', borderRadius: 10, padding: 14 },
    code: { color: '#7DD3FC', fontFamily: 'monospace', fontSize: 12, lineHeight: 20 },

    endpointCard: { backgroundColor: '#1E293B', borderRadius: 14, padding: 14, marginBottom: 10 },
    endpointHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    methodBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    methodText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
    endpointPath: { color: '#E2E8F0', fontFamily: 'monospace', fontSize: 12, flex: 1 },
    endpointDesc: { color: '#94A3B8', fontSize: 13, marginBottom: 10 },

    switchCard: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: '#1E293B', borderRadius: 14, padding: 16,
        borderWidth: 1, borderColor: '#10B981',
    },
    switchTitle: { fontSize: 14, fontWeight: '700', color: '#F1F5F9' },
    switchDesc: { fontSize: 12, color: '#64748B', marginTop: 2 },
});
