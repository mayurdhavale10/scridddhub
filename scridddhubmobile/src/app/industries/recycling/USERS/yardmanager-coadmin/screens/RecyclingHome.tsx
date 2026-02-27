// src/app/industries/recycling/screens/RecyclingHome.tsx
import React, { useMemo, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Image,
    StatusBar,
    Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ModuleKey =
    | "inventory"
    | "waste"
    | "machines"
    | "logistics"
    | "finance"
    | "access"
    | "integrations"
    | "ai_ca"
    | "ai_secretary"
    | "ai_analyst"
    | "reports"
    | "compliance"
    | "suppliers"
    | "customers"
    | "quality"
    | "fifo"
    | "maintenance"
    | "procurement";

type ModuleItem = {
    key: ModuleKey;
    title: string;
    subtitle: string;
    icon: any;
};

const MODULES: ModuleItem[] = [
    { key: "inventory", title: "Inventory", subtitle: "Collection & Sorting", icon: require("../../../../../../assets/feature/inventory.png") },
    { key: "fifo", title: "FIFO Stock", subtitle: "First-In First-Out", icon: require("../../../../../../assets/feature/inventory.png") },
    { key: "waste", title: "Waste Mgmt", subtitle: "Logs & Disposals", icon: require("../../../../../../assets/feature/wastemanagement.png") },
    { key: "machines", title: "Machine Health", subtitle: "Machines & Sensors", icon: require("../../../../../../assets/feature/machine.png") },
    { key: "logistics", title: "Logistics", subtitle: "Trips & Vehicles", icon: require("../../../../../../assets/feature/logistic.png") },
    { key: "finance", title: "Finance", subtitle: "Expenses & Payroll", icon: require("../../../../../../assets/feature/finance.png") },
    { key: "access", title: "Access", subtitle: "Roles & Staff", icon: require("../../../../../../assets/feature/access.png") },
    { key: "integrations", title: "Integrations", subtitle: "API & Webhooks", icon: require("../../../../../../assets/feature/integrations.png") },
    { key: "reports", title: "Reports", subtitle: "KPIs & Exports", icon: require("../../../../../../assets/feature/reports.png") },
    { key: "compliance", title: "Compliance", subtitle: "Documents & Audits", icon: require("../../../../../../assets/feature/compliance.png") },
    { key: "suppliers", title: "Suppliers", subtitle: "Vendors & Rates", icon: require("../../../../../../assets/feature/suppliers.png") },
    { key: "customers", title: "Customers", subtitle: "Buyers & Orders", icon: require("../../../../../../assets/feature/customers.png") },
    { key: "quality", title: "Quality", subtitle: "Grades & QC", icon: require("../../../../../../assets/feature/quality.png") },
    { key: "maintenance", title: "Maintenance", subtitle: "Work Orders", icon: require("../../../../../../assets/feature/maintenance.png") },
    { key: "procurement", title: "Procurement", subtitle: "Purchase & Spend", icon: require("../../../../../../assets/feature/procurement.png") },
    { key: "ai_ca", title: "AI CA", subtitle: "Books & GST help", icon: require("../../../../../../assets/feature/ai_ca.png") },
    { key: "ai_secretary", title: "AI Secretary", subtitle: "Daily summary", icon: require("../../../../../../assets/feature/ai_secretary.png") },
    { key: "ai_analyst", title: "AI Analyst", subtitle: "Insights & actions", icon: require("../../../../../../assets/feature/ai_analyst.png") },
];

export const RecyclingHome = ({ navigation }: any) => {
    const [selected, setSelected] = useState<Set<ModuleKey>>(
        () => new Set([])
    );

    const selectedCount = selected.size;

    const toggle = (key: ModuleKey) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const selectAll = () => {
        setSelected(new Set(MODULES.map((m) => m.key)));
    };

    const clearAll = () => setSelected(new Set());

    const footerHint = useMemo(() => {
        if (selectedCount === 0) return "Select at least 1 module to continue.";
        if (selectedCount < 4) return "Good start — add more modules anytime.";
        return "Great — your workspace will be auto-built using these modules.";
    }, [selectedCount]);

    const onContinue = () => {
        // Navigate to Role Selection (New Name for Cache Busting)
        navigation.navigate('AuthRoleScreen' as any, { modules: Array.from(selected) });
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Top bar */}
                <View style={styles.topBar}>
                    <TouchableOpacity
                        onPress={() => navigation?.goBack?.()}
                        style={styles.backBtn}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.backIcon}>←</Text>
                    </TouchableOpacity>

                    <View style={styles.logoRow}>
                        <Image
                            source={require("../../../../../../assets/brand/scridddhublogo.png")}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                    </View>

                    <View style={{ width: 44 }} />
                </View>

                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>♻️ Recycling Plant</Text>
                    <Text style={styles.subtitle}>Build your workspace in minutes.</Text>
                </View>

                {/* Full Suite CTA - HIGHLY CLICKABLE */}
                <TouchableOpacity
                    style={styles.fullSuiteCard}
                    activeOpacity={0.7}
                    onPress={selectAll}
                >
                    <View style={styles.fullSuiteInner}>
                        <View style={styles.fullSuiteIconCircle}>
                            <Image
                                source={require("../../../../../../assets/onoff/healthyleaf-on.png")}
                                style={styles.fullSuiteLeafIcon}
                                resizeMode="contain"
                            />
                        </View>
                        <View style={styles.fullSuiteLeft}>
                            <Text style={styles.fullSuiteTitle}>Get the Full Suite</Text>
                            <Text style={styles.fullSuiteDesc}>Enable all modules for a complete ERP setup.</Text>
                        </View>
                        <View style={styles.fullSuiteArrowContainer}>
                            <Text style={styles.fullSuiteArrow}>→</Text>
                        </View>
                    </View>
                    {/* Shimmer effect overlay */}
                    <View style={styles.fullSuiteShimmer} />
                </TouchableOpacity>

                {/* Section header */}
                <View style={styles.sectionHeaderRow}>
                    <View>
                        <Text style={styles.sectionTitle}>Customize Your Workspace</Text>
                        <Text style={styles.sectionSub}>
                            Selected: <Text style={styles.sectionSubStrong}>{selectedCount}</Text> of {MODULES.length}
                        </Text>
                    </View>

                    <View style={styles.sectionActions}>
                        <TouchableOpacity onPress={clearAll} activeOpacity={0.7} style={styles.smallGhostBtn}>
                            <Text style={styles.smallGhostText}>Clear</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Grid */}
                <View style={styles.grid}>
                    {MODULES.map((m) => {
                        const isOn = selected.has(m.key);
                        return (
                            <TouchableOpacity
                                key={m.key}
                                style={[
                                    styles.card,
                                    isOn && styles.cardSelected,
                                ]}
                                activeOpacity={0.75}
                                onPress={() => toggle(m.key)}
                            >
                                {/* Selection indicator overlay */}
                                {isOn && <View style={styles.cardSelectedOverlay} />}

                                <View style={styles.cardContent}>
                                    <View style={styles.cardTopRow}>
                                        <View style={[styles.iconContainer, isOn && styles.iconContainerSelected]}>
                                            <Image
                                                source={m.icon}
                                                style={styles.iconImage}
                                                resizeMode="contain"
                                            />
                                        </View>

                                        <View style={styles.leafBadge}>
                                            <Image
                                                source={
                                                    isOn
                                                        ? require("../../../../../../assets/onoff/healthyleaf-on.png")
                                                        : require("../../../../../../assets/onoff/driedleaf-off.png")
                                                }
                                                style={styles.leafIcon}
                                                resizeMode="contain"
                                            />
                                        </View>
                                    </View>

                                    <View style={styles.cardTextContainer}>
                                        <Text style={[styles.cardTitle, isOn && styles.cardTitleSelected]} numberOfLines={1}>
                                            {m.title}
                                        </Text>
                                        <Text style={[styles.cardSub, isOn && styles.cardSubSelected]} numberOfLines={1}>
                                            {m.subtitle}
                                        </Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Hint */}
                <Text style={styles.hint}>{footerHint}</Text>

                {/* Continue */}
                <TouchableOpacity
                    style={[styles.primaryBtn, selectedCount === 0 && styles.primaryBtnDisabled]}
                    activeOpacity={0.88}
                    disabled={selectedCount === 0}
                    onPress={onContinue}
                >
                    <Text style={styles.primaryBtnText}>Continue to Dashboard</Text>
                </TouchableOpacity>

                <View style={{ height: 20 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const COLORS = {
    primary: "#1D7A27",
    primary2: "#2A8F34",
    primaryDark: "#165A1E",
    primaryLight: "#34A643",
    bg: "#F8F9FA",
    bgGradient: "#FFFFFF",
    card: "#FFFFFF",
    border: "#E2E5E9",
    borderLight: "#F0F1F3",
    text: "#0F1419",
    text2: "#3D4551",
    muted: "#5F6A78",
    muted2: "#8B95A3",
    greenTint: "#F0FDF4",
    greenTint2: "#E6F9EA",
    greenBorder: "#A8E6B0",
    greenGlow: "rgba(42, 143, 52, 0.2)",
    shadowGreen: "rgba(29, 122, 39, 0.15)",
    shadowCard: "rgba(15, 20, 25, 0.08)",
    gold: "#F59E0B",
    goldLight: "#FCD34D",
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 20
    },

    topBar: {
        paddingTop: Platform.OS === "android" ? 10 : 6,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 4,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: COLORS.card,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: COLORS.shadowCard,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 4,
        elevation: 2,
    },
    backIcon: {
        fontSize: 20,
        color: COLORS.text,
        fontWeight: "700"
    },

    logoRow: {
        flex: 1,
        alignItems: "center"
    },
    logo: {
        width: 150,
        height: 46
    },

    header: {
        marginTop: 18,
        marginBottom: 20,
        alignItems: "center"
    },
    title: {
        fontSize: 28,
        fontWeight: "800",
        color: COLORS.primary,
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 15,
        color: COLORS.muted,
        textAlign: "center",
        lineHeight: 22,
        fontWeight: "500",
    },

    fullSuiteCard: {
        borderRadius: 18,
        marginBottom: 24,
        overflow: "hidden",
        backgroundColor: COLORS.card,
        borderWidth: 2.5,
        borderColor: COLORS.primary2,
        shadowColor: COLORS.primary2,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
        transform: [{ scale: 1 }],
    },
    fullSuiteInner: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.greenTint2,
        padding: 18,
        position: "relative",
    },
    fullSuiteShimmer: {
        position: "absolute",
        top: 0,
        left: -100,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(255, 255, 255, 0.3)",
        width: "30%",
    },
    fullSuiteIconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.card,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 14,
        shadowColor: COLORS.primary2,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
        borderWidth: 2,
        borderColor: COLORS.primary2,
    },
    fullSuiteLeafIcon: {
        width: 32,
        height: 32,
    },
    fullSuiteLeft: {
        flex: 1
    },
    fullSuiteTitle: {
        fontSize: 17.5,
        fontWeight: "800",
        color: COLORS.text,
        marginBottom: 5,
        letterSpacing: -0.3,
    },
    fullSuiteDesc: {
        fontSize: 13.5,
        color: COLORS.text2,
        lineHeight: 19,
        fontWeight: "500",
    },
    fullSuiteArrowContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: COLORS.primary2,
        alignItems: "center",
        justifyContent: "center",
        marginLeft: 12,
        shadowColor: COLORS.primary2,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
        elevation: 4,
    },
    fullSuiteArrow: {
        fontSize: 22,
        color: COLORS.card,
        fontWeight: "700"
    },

    sectionHeaderRow: {
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 19,
        fontWeight: "800",
        color: COLORS.text,
        letterSpacing: -0.3,
    },
    sectionSub: {
        marginTop: 5,
        fontSize: 13.5,
        color: COLORS.muted,
        fontWeight: "500",
    },
    sectionSubStrong: {
        color: COLORS.primary2,
        fontWeight: "800"
    },

    sectionActions: {
        flexDirection: "row"
    },
    smallGhostBtn: {
        paddingVertical: 9,
        paddingHorizontal: 14,
        borderRadius: 10,
        backgroundColor: COLORS.borderLight,
    },
    smallGhostText: {
        color: COLORS.primary2,
        fontWeight: "700",
        fontSize: 13,
    },

    grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
    },
    card: {
        width: "48%",
        backgroundColor: COLORS.card,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        marginBottom: 16,
        minHeight: 132,
        overflow: "hidden",
        shadowColor: COLORS.shadowCard,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 1,
        shadowRadius: 8,
        elevation: 3,
    },
    cardSelected: {
        borderColor: COLORS.primary2,
        borderWidth: 2,
        backgroundColor: COLORS.greenTint2,
        shadowColor: COLORS.shadowGreen,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 12,
        elevation: 5,
    },
    cardSelectedOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(42, 143, 52, 0.04)",
    },
    cardContent: {
        padding: 14,
    },
    cardTopRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        marginBottom: 10,
    },
    iconContainer: {
        width: 52,
        height: 52,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        borderRadius: 12,
        backgroundColor: COLORS.bgGradient,
    },
    iconContainerSelected: {
        backgroundColor: "rgba(255, 255, 255, 0.7)",
    },
    iconImage: {
        width: 80,
        height: 80,
    },

    leafBadge: {
        width: 26,
        height: 26,
        alignItems: "center",
        justifyContent: "center",
    },
    leafIcon: {
        width: 22,
        height: 22,
    },

    cardTextContainer: {
        marginTop: 6,
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: "800",
        color: COLORS.text,
        letterSpacing: -0.2,
        marginBottom: 3,
    },
    cardTitleSelected: {
        color: COLORS.primaryDark,
    },
    cardSub: {
        fontSize: 12.5,
        color: COLORS.muted,
        lineHeight: 17,
        fontWeight: "500",
    },
    cardSubSelected: {
        color: COLORS.text2,
    },

    hint: {
        marginTop: 8,
        marginBottom: 16,
        fontSize: 13,
        color: COLORS.muted2,
        textAlign: "center",
        fontWeight: "500",
        lineHeight: 19,
    },

    primaryBtn: {
        backgroundColor: COLORS.primary,
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: COLORS.shadowGreen,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 1,
        shadowRadius: 16,
        elevation: 6,
    },
    primaryBtnDisabled: {
        opacity: 0.5,
        shadowOpacity: 0.3,
    },
    primaryBtnText: {
        color: "#FFFFFF",
        fontSize: 16.5,
        fontWeight: "800",
        letterSpacing: -0.2,
    },
});