import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

export default function DashboardHome({ navigation }: any) {
    return (
        <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
            {/* KPI STRIP */}
            <View style={styles.kpiRow}>
                <KPI label="Today Batches" value="12" />
                <KPI label="QC Pending" value="3" />
                <KPI label="Offline Queue" value="0" />
            </View>

            {/* PRIMARY ACTIONS */}
            <Text style={styles.sectionTitle}>Quick Actions</Text>

            <View style={styles.tileRow}>
                <ActionTile
                    icon="scale"
                    label="New Weigh"
                    onPress={() => navigation.navigate("WeighSetupScreen")}
                />
                <ActionTile
                    icon="refresh"
                    label="Pending QC"
                    onPress={() => navigation.navigate("QCListScreen")}
                />
            </View>

            <View style={styles.tileRow}>
                <ActionTile
                    icon="clipboard-list"
                    label="Today Entries"
                    onPress={() => navigation.navigate("InventoryLedger")}
                />
                <ActionTile
                    icon="camera"
                    label="Upload Ticket"
                    onPress={() => Alert.alert("Coming Soon", "OCR Feature is under development")}
                />
            </View>

            <View style={styles.tileRow}>
                <ActionTile
                    icon="pulse"
                    label="Presence Pulse"
                    onPress={() => navigation.navigate("CheckIn")}
                />
                <ActionTile
                    icon="sync"
                    label="Sync Status"
                    onPress={() => Alert.alert("Sync Status", "All data is synchronized")}
                />
            </View>

            {/* MODULE SHORTCUT CARDS */}
            <Text style={styles.sectionTitle}>Operations</Text>

            <View style={styles.cardGrid}>
                <NavCard title="QC" icon="shield-check" onPress={() => navigation.navigate("QCListScreen")} />
                <NavCard title="Split" icon="shuffle-variant" onPress={() => navigation.navigate("Split")} />
                <NavCard title="FIFO" icon="timer-sand" onPress={() => navigation.navigate("FIFO")} />
                <NavCard title="My Trips" icon="truck-delivery" onPress={() => navigation.navigate("MyTrips")} />
                <NavCard title="Maintenance" icon="tools" onPress={() => navigation.navigate("Maintenance")} />
                <NavCard title="Reports" icon="file-chart" onPress={() => navigation.navigate("Reports")} />
            </View>
        </ScrollView>
    );
}

// ------------------------------------------------------------------
// COMPONENTS
// ------------------------------------------------------------------

const KPI = ({ label, value }: any) => (
    <View style={styles.kpiBox}>
        <Text style={styles.kpiValue}>{value}</Text>
        <Text style={styles.kpiLabel}>{label}</Text>
    </View>
);

const ActionTile = ({ icon, label, onPress }: any) => (
    <TouchableOpacity style={styles.tile} onPress={onPress}>
        <Icon name={icon} size={28} color="#1D7A27" />
        <Text style={styles.tileText}>{label}</Text>
    </TouchableOpacity>
);

const NavCard = ({ title, icon, onPress }: any) => (
    <TouchableOpacity style={styles.card} onPress={onPress}>
        <Icon name={icon} size={26} color="#2563EB" />
        <Text style={styles.cardText}>{title}</Text>
    </TouchableOpacity>
);

// ------------------------------------------------------------------
// STYLES
// ------------------------------------------------------------------

const styles = StyleSheet.create({
    container: {
        backgroundColor: "#F3F4F6",
        flex: 1,
    },

    sectionTitle: {
        fontSize: 16,
        fontWeight: "700",
        marginVertical: 15,
        color: "#111",
    },

    kpiRow: {
        flexDirection: "row",
        justifyContent: "space-between",
    },

    kpiBox: {
        backgroundColor: "#FFF",
        padding: 15,
        borderRadius: 10,
        width: "32%",
        alignItems: "center",
    },

    kpiValue: {
        fontSize: 20,
        fontWeight: "800",
        color: "#111",
    },

    kpiLabel: {
        fontSize: 11,
        color: "#6B7280",
        marginTop: 5,
    },

    tileRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 12,
    },

    tile: {
        backgroundColor: "#FFF",
        width: "48%",
        padding: 20,
        borderRadius: 12,
        alignItems: "center",
    },

    tileText: {
        marginTop: 8,
        fontWeight: "600",
    },

    cardGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
    },

    card: {
        width: "48%",
        backgroundColor: "#FFF",
        padding: 20,
        borderRadius: 12,
        alignItems: "center",
        marginBottom: 12,
    },

    cardText: {
        marginTop: 8,
        fontWeight: "600",
    },
});
