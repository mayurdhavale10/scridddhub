import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

export default function Sidebar({ navigation, route }: any) {
    const { modules = [] } = route?.params || {};
    const hasModule = (key: string) => modules.includes(key) || modules.length === 0; // Length check still here for dev convenience but navigation is fixed
    const [inventoryOpen, setInventoryOpen] = useState(true);

    return (
        <SafeAreaView style={styles.container}>
            <Text style={styles.logo}>SCRIDDDHUB</Text>

            <NavItem icon="view-dashboard" label="Dashboard" onPress={() => navigation.navigate("DashboardHome")} />

            {/* Inventory */}
            {hasModule('inventory') && (
                <>
                    <TouchableOpacity style={styles.section} onPress={() => setInventoryOpen(!inventoryOpen)}>
                        <Icon name="warehouse" size={20} color="#1B5E20" />
                        <Text style={styles.sectionText}>Inventory</Text>
                        <Icon name={inventoryOpen ? "chevron-up" : "chevron-down"} size={20} color="#9CA3AF" />
                    </TouchableOpacity>

                    {inventoryOpen && (
                        <View style={styles.subMenu}>
                            <SubItem label="Weigh" onPress={() => navigation.navigate("OperatorInventoryScreen")} />
                            <SubItem label="QC Queue" onPress={() => navigation.navigate("QCListScreen")} />
                            <SubItem label="Split" onPress={() => navigation.navigate("Split")} />
                            <SubItem label="Entries" onPress={() => navigation.navigate("DailyReportScreen")} />
                            <SubItem label="Inventory Ledger" onPress={() => navigation.navigate("InventoryLedger")} />
                            <SubItem label="FIFO" onPress={() => navigation.navigate("InventoryList")} />
                            <SubItem label="Sales" onPress={() => navigation.navigate("SalesGateway")} />
                        </View>
                    )}
                </>
            )}

            {hasModule('logistics') && (
                <NavItem icon="truck" label="Logistics" onPress={() => navigation.navigate("Logistics")} />
            )}

            {hasModule('maintenance') && (
                <NavItem icon="tools" label="Maintenance" onPress={() => navigation.navigate("Maintenance")} />
            )}

            {hasModule('quality') && (
                <NavItem icon="shield-check" label="Quality Control" onPress={() => navigation.navigate("QCListScreen")} />
            )}

            {hasModule('reports') && (
                <NavItem icon="file-chart" label="Reports" onPress={() => navigation.navigate("DailyReportScreen")} />
            )}

            <View style={styles.footer}>
                <Text style={styles.sync}>🟢 Online</Text>
                <TouchableOpacity onPress={() => navigation.navigate("AuthRoleScreen")}>
                    <Text style={styles.logout}>Logout</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const NavItem = ({ icon, label, onPress }: any) => (
    <TouchableOpacity style={styles.item} onPress={onPress}>
        <Icon name={icon} size={20} />
        <Text style={styles.itemText}>{label}</Text>
    </TouchableOpacity>
);

const SubItem = ({ label, onPress }: any) => (
    <TouchableOpacity style={styles.subItem} onPress={onPress}>
        <Text style={styles.subItemText}>{label}</Text>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    container: {
        padding: 20,
        paddingTop: 50, // Added extra top padding
        backgroundColor: "#FFF",
        height: "100%",
    },
    logo: {
        fontWeight: "800",
        fontSize: 18,
        marginBottom: 20,
    },
    section: {
        flexDirection: "row",
        alignItems: "center",
        marginVertical: 10,
    },
    sectionText: {
        marginLeft: 10,
        flex: 1,
        fontWeight: "600",
    },
    item: {
        flexDirection: "row",
        alignItems: "center",
        marginVertical: 10,
    },
    itemText: {
        marginLeft: 10,
    },
    subMenu: {
        marginLeft: 20,
    },
    subItem: {
        paddingVertical: 6,
    },
    subItemText: {
        color: "#374151",
    },
    footer: {
        marginTop: 30,
    },
    sync: {
        color: "green",
    },
    logout: {
        marginTop: 10,
        color: "red",
    },
});
