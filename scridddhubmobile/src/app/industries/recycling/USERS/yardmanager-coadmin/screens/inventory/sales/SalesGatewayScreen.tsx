import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    ActivityIndicator, Animated
} from 'react-native';
import { getSalesConfig } from '../../../../../../../../shared/inventory/api';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const TENANT = 'TENANT-001';

/**
 * SalesGatewayScreen
 *
 * This is the landing screen when the user taps "Sales" from the sidebar.
 * It checks the tenant's sales_mode:
 *   • Not configured yet  → Shows onboarding picker (choose path)
 *   • integrated          → Goes straight to SalesOrderList
 *   • external_api        → Goes straight to ExternalAPIScreen
 *
 * A gear icon is always available to re-open SalesConfig.
 */
export default function SalesGatewayScreen({ navigation }: any) {
    const [status, setStatus] = useState<'loading' | 'onboarding' | 'routing'>('loading');
    const [mode, setMode] = useState<'integrated' | 'external_api' | null>(null);
    const fadeAnim = React.useRef(new Animated.Value(0)).current;

    const checkConfig = useCallback(async () => {
        let isMounted = true;
        try {
            setStatus('loading');
            const res = await getSalesConfig(TENANT);
            const cfg = res?.data;

            if (!isMounted) return;

            if (!cfg || !cfg.sales_mode) {
                setStatus('onboarding');
                Animated.timing(fadeAnim, {
                    toValue: 1, duration: 400, useNativeDriver: true
                }).start();
            } else {
                setMode(cfg.sales_mode);
                setStatus('routing');
                if (cfg.sales_mode === 'integrated') {
                    navigation.navigate('SalesOrderList');
                } else {
                    navigation.navigate('ExternalAPI');
                }
            }
        } catch (e) {
            if (!isMounted) return;
            setStatus('onboarding');
            Animated.timing(fadeAnim, {
                toValue: 1, duration: 400, useNativeDriver: true
            }).start();
        }
        return () => { isMounted = false; };
    }, [navigation]);

    useEffect(() => {
        checkConfig();
        const unsub = navigation.addListener('focus', checkConfig);
        return unsub;
    }, [navigation, checkConfig]);

    // ─── LOADING STATE ────────────────────────────────────────────────
    if (status === 'loading' || status === 'routing') {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#10B981" />
                <Text style={styles.loadingText}>
                    {status === 'routing' ? `Opening ${mode === 'integrated' ? 'Sales' : 'External API'}…` : 'Loading…'}
                </Text>
            </View>
        );
    }

    // ─── ONBOARDING PICKER ────────────────────────────────────────────
    return (
        <View style={styles.root}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
                    <Icon name="arrow-left" size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Sales Setup</Text>
                <View style={{ width: 32 }} />
            </View>

            <Animated.ScrollView
                contentContainerStyle={styles.body}
                style={{ opacity: fadeAnim }}
            >
                {/* Hero */}
                <View style={styles.hero}>
                    <View style={styles.heroIcon}>
                        <Icon name="store-outline" size={48} color="#10B981" />
                    </View>
                    <Text style={styles.heroTitle}>How do you manage sales?</Text>
                    <Text style={styles.heroSub}>
                        Choose once, change anytime from Settings.
                    </Text>
                </View>

                {/* ── Option 1: Integrated ─────────────────────────── */}
                <TouchableOpacity
                    style={styles.card}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('SalesConfig', { autoSelect: 'integrated' })}
                >
                    <View style={styles.cardBadge}>
                        <Text style={styles.cardBadgeText}>RECOMMENDED</Text>
                    </View>
                    <View style={[styles.cardIconWrap, { backgroundColor: '#ECFDF5' }]}>
                        <Icon name="store" size={32} color="#10B981" />
                    </View>
                    <Text style={styles.cardTitle}>In-house Sales</Text>
                    <Text style={styles.cardDesc}>
                        Create orders, manage customers, record payments and dispatch — all inside ScridddHub.
                    </Text>
                    <View style={styles.featureList}>
                        {[
                            { icon: 'account-group', text: 'Customer CRM & credit limits' },
                            { icon: 'receipt', text: 'Sales orders in INR' },
                            { icon: 'lightning-bolt', text: 'Auto FIFO stock deduction' },
                            { icon: 'cash-multiple', text: 'Payment tracking (UPI/Cash/Cheque)' },
                        ].map(f => (
                            <View key={f.text} style={styles.featureRow}>
                                <Icon name={f.icon} size={16} color="#10B981" />
                                <Text style={styles.featureText}>{f.text}</Text>
                            </View>
                        ))}
                    </View>
                    <View style={styles.cardCta}>
                        <Text style={styles.cardCtaText}>Set up In-house Sales</Text>
                        <Icon name="arrow-right" size={18} color="#10B981" />
                    </View>
                </TouchableOpacity>

                {/* ── Option 2: External API ───────────────────────── */}
                <TouchableOpacity
                    style={[styles.card, styles.cardDark]}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('SalesConfig', { autoSelect: 'external_api' })}
                >
                    <View style={[styles.cardBadge, { backgroundColor: '#1D4ED8' }]}>
                        <Text style={styles.cardBadgeText}>FOR POWER USERS</Text>
                    </View>
                    <View style={[styles.cardIconWrap, { backgroundColor: '#EFF6FF' }]}>
                        <Icon name="api" size={32} color="#3B82F6" />
                    </View>
                    <Text style={[styles.cardTitle, { color: '#FFF' }]}>External Integration</Text>
                    <Text style={[styles.cardDesc, { color: '#94A3B8' }]}>
                        Already using Tally, SAP or your own billing system? Connect it to ScridddHub via API.
                    </Text>
                    <View style={styles.featureList}>
                        {[
                            { icon: 'key-variant', text: 'Secure API key for your ERP' },
                            { icon: 'database-sync', text: 'Real-time stock endpoint' },
                            { icon: 'code-json', text: 'REST API — works with anything' },
                            { icon: 'shield-check', text: 'Stock deducted via API call' },
                        ].map(f => (
                            <View key={f.text} style={styles.featureRow}>
                                <Icon name={f.icon} size={16} color="#60A5FA" />
                                <Text style={[styles.featureText, { color: '#CBD5E1' }]}>{f.text}</Text>
                            </View>
                        ))}
                    </View>
                    <View style={[styles.cardCta, { borderColor: '#3B82F6' }]}>
                        <Text style={[styles.cardCtaText, { color: '#60A5FA' }]}>Connect External System</Text>
                        <Icon name="arrow-right" size={18} color="#60A5FA" />
                    </View>
                </TouchableOpacity>

                <Text style={styles.footnote}>
                    🔒 You can switch between modes anytime via Sales Settings without losing your data.
                </Text>
            </Animated.ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#0F172A' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },
    loadingText: { marginTop: 12, color: '#6B7280', fontSize: 14 },

    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16,
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },

    body: { padding: 16, paddingBottom: 50 },

    hero: { alignItems: 'center', marginBottom: 28, marginTop: 8 },
    heroIcon: {
        width: 80, height: 80, borderRadius: 24,
        backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center',
        marginBottom: 16,
    },
    heroTitle: { fontSize: 24, fontWeight: '800', color: '#F1F5F9', textAlign: 'center' },
    heroSub: { fontSize: 14, color: '#94A3B8', marginTop: 8, textAlign: 'center', lineHeight: 21 },

    card: {
        backgroundColor: '#FFF', borderRadius: 20, padding: 20,
        marginBottom: 16, overflow: 'hidden',
    },
    cardDark: { backgroundColor: '#1E293B' },
    cardBadge: {
        alignSelf: 'flex-start', backgroundColor: '#10B981',
        paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginBottom: 14,
    },
    cardBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
    cardIconWrap: {
        width: 56, height: 56, borderRadius: 16,
        alignItems: 'center', justifyContent: 'center', marginBottom: 14,
    },
    cardTitle: { fontSize: 20, fontWeight: '800', color: '#111', marginBottom: 8 },
    cardDesc: { fontSize: 14, color: '#6B7280', lineHeight: 21, marginBottom: 16 },

    featureList: { gap: 10, marginBottom: 18 },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    featureText: { fontSize: 13, color: '#374151' },

    cardCta: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, borderWidth: 1.5, borderColor: '#10B981',
        borderRadius: 12, paddingVertical: 12,
    },
    cardCtaText: { fontSize: 15, fontWeight: '700', color: '#10B981' },

    footnote: { fontSize: 12, color: '#64748B', textAlign: 'center', marginTop: 8, lineHeight: 18 },
});
