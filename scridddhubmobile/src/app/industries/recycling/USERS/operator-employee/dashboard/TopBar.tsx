import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

export default function TopBar({ onMenu, title = "Operator Dashboard", showBack, onBack }: any) {
    return (
        <View style={styles.container}>
            {showBack ? (
                <TouchableOpacity onPress={onBack}>
                    <Icon name="arrow-left" size={26} color="#111" />
                </TouchableOpacity>
            ) : (
                <TouchableOpacity onPress={onMenu}>
                    <Icon name="menu" size={26} color="#111" />
                </TouchableOpacity>
            )}

            <Text style={styles.title}>{title}</Text>

            <View style={styles.profile} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingTop: 55, // Push down further below status bar/notch
        paddingBottom: 15, // Add bottom padding for balance
        backgroundColor: "#FFF",
        borderBottomWidth: 1,
        borderBottomColor: "#E5E7EB",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 15,
        elevation: 2, // shadow for android
    },

    title: {
        fontWeight: "700",
        color: "#111",
    },

    profile: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "#E5E7EB",
    },
});
