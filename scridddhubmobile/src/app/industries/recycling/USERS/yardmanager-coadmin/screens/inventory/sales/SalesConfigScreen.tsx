import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    ScrollView, Alert, ActivityIndicator, Clipboard
} from 'react-native';
import { getSalesConfig, updateSalesConfig } from '../../../../../../../../shared/inventory/api';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const TENANT = 'TENANT-001';

export default function SalesConfigScreen({ navigation }: any) {
    const [config, setConfig] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => { load(); }, []);

    const load = async () => {
        try {
            setLoading(true);
            const res = await getSalesConfig(TENANT);
            if (res.success) setConfig(res.data);
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally { setLoading(false); }
    };

    const handleSwitch = (mode: 'integrated' | 'external_api') => {
        if (mode === config?.sales_mode) return;

        Alert.alert(
            'Change Sales Mode?',
            mode === 'external_api'
                ? 'This will enable the external API. Your sales UI in the app will be hidden. External systems can access stock via the API key.'
                : 'This will enable the built-in Sales UI and disable external API access.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Confirm', style: 'default', onPress: () => doSwitch(mode) }
            ]
        );
    };

    const doSwitch = async (mode: 'integrated' | 'external_api') => {
        try {
            setSaving(true);
            const res = await updateSalesConfig(TENANT, { sales_mode: mode });
            if (res.success) {
                setConfig(res.data);
                Alert.alert('✅ Updated', `Sales mode set to: ${mode}`);
            }
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally { setSaving(false); }
    };

    const copyApiKey = () => {
        if (config?.external_api_key) {
            Clipboard.setString(config.external_api_key);
            Alert.alert('Copied', 'API key copied to clipboard');
        }
    };

    if (loading) return (
        <View style={styles.center}>
            <ActivityIndicator size="large" color="#10B981" />
        </View>
    );

    const isIntegrated = config?.sales_mode === 'integrated';
    const isExternal = config?.sales_mode === 'external_api';

    return (
        <View style={styles.root}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Icon name="arrow-left" size={24} color="#111" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Sales Mode</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.body}>
                <Text style={styles.subtitle}>
                    Choose how your yard handles sales. You can switch at any time.
                </Text>

                {/* Option 1: Integrated */}
                <TouchableOpacity
                    style={[styles.option, isIntegrated && styles.optionActive]}
                    onPress={() => handleSwitch('integrated')}
                    disabled={saving}
                >
                    <View style={styles.optionHeader}>
                        <View style={[styles.optionIcon, { backgroundColor: '#ECFDF5' }]}>
                            <Icon name="store" size={24} color="#10B981" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.optionTitle}>Integrated Sales</Text>
                            <Text style={styles.optionTag}>Recommended</Text>
                        </View>
                        <View style={[styles.radio, isIntegrated && styles.radioActive]}>
                            {isIntegrated && <View style={styles.radioDot} />}
                        </View>
                    </View>
                    <View style={styles.optionFeatures}>
                        {['Built-in orders & invoicing', 'Customer CRM included', 'Auto FIFO stock deduction', 'Payment tracking'].map(f => (
                            <View style={styles.featureRow} key={f}>
                                <Icon name="check-circle" size={14} color="#10B981" />
                                <Text style={styles.featureText}>{f}</Text>
                            </View>
                        ))}
                    </View>
                </TouchableOpacity>

                {/* Option 2: External API */}
                <TouchableOpacity
                    style={[styles.option, isExternal && styles.optionActive]}
                    onPress={() => handleSwitch('external_api')}
                    disabled={saving}
                >
                    <View style={styles.optionHeader}>
                        <View style={[styles.optionIcon, { backgroundColor: '#EFF6FF' }]}>
                            <Icon name="api" size={24} color="#3B82F6" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.optionTitle}>External Integration</Text>
                            <Text style={[styles.optionTag, { color: '#3B82F6' }]}>Tally / SAP / Custom ERP</Text>
                        </View>
                        <View style={[styles.radio, isExternal && styles.radioActive]}>
                            {isExternal && <View style={styles.radioDot} />}
                        </View>
                    </View>
                    <View style={styles.optionFeatures}>
                        {['REST API access to your stock', 'API key authentication', 'Connect to any billing software', 'Real-time stock sync'].map(f => (
                            <View style={styles.featureRow} key={f}>
                                <Icon name="check-circle" size={14} color="#3B82F6" />
                                <Text style={styles.featureText}>{f}</Text>
                            </View>
                        ))}
                    </View>
                </TouchableOpacity>

                {/* API Key (only visible in external mode) */}
                {isExternal && config?.external_api_key && (
                    <View style={styles.apiKeyCard}>
                        <Text style={styles.apiKeyLabel}>Your API Key</Text>
                        <Text style={styles.apiKeyNote}>
                            Share this with your IT team. Do not share publicly.
                        </Text>
                        <View style={styles.apiKeyRow}>
                            <Text style={styles.apiKeyValue} numberOfLines={1} ellipsizeMode="middle">
                                {config.external_api_key}
                            </Text>
                            <TouchableOpacity onPress={copyApiKey} style={styles.copyBtn}>
                                <Icon name="content-copy" size={16} color="#3B82F6" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.apiDocsBox}>
                            <Icon name="code-tags" size={16} color="#6B7280" />
                            <Text style={styles.apiDocsText}>
                                {'GET /api/public/TENANT-001/stock\nHeader: X-API-Key: your-key'}
                            </Text>
                        </View>
                    </View>
                )}

                {saving && (
                    <View style={styles.savingRow}>
                        <ActivityIndicator size="small" color="#10B981" />
                        <Text style={{ color: '#10B981', marginLeft: 8 }}>Saving…</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F9FAFB' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#FFF', elevation: 2 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
    body: { padding: 16 },
    subtitle: { fontSize: 14, color: '#6B7280', marginBottom: 20, lineHeight: 21 },

    option: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 2, borderColor: '#E5E7EB', elevation: 1 },
    optionActive: { borderColor: '#10B981', backgroundColor: '#F0FDF4' },
    optionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
    optionIcon: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    optionTitle: { fontSize: 16, fontWeight: '700', color: '#111' },
    optionTag: { fontSize: 12, color: '#10B981', fontWeight: '600', marginTop: 2 },
    radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
    radioActive: { borderColor: '#10B981' },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981' },
    optionFeatures: { gap: 8 },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    featureText: { fontSize: 13, color: '#374151' },

    apiKeyCard: { backgroundColor: '#1E3A5F', borderRadius: 16, padding: 18, marginTop: 4 },
    apiKeyLabel: { color: '#93C5FD', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
    apiKeyNote: { color: '#93C5FD', fontSize: 12, marginBottom: 12, opacity: 0.8 },
    apiKeyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F2644', borderRadius: 8, padding: 12, gap: 10, marginBottom: 14 },
    apiKeyValue: { flex: 1, color: '#60A5FA', fontFamily: 'monospace', fontSize: 13 },
    copyBtn: { padding: 4 },
    apiDocsBox: { flexDirection: 'row', gap: 10, backgroundColor: '#0F2644', borderRadius: 8, padding: 12, alignItems: 'flex-start' },
    apiDocsText: { color: '#9CA3AF', fontSize: 12, fontFamily: 'monospace', flex: 1 },

    savingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
});
