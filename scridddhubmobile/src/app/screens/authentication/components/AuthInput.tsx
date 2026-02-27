import React, { useState } from "react";
import { View, Text, TextInput, TextInputProps, StyleSheet, TouchableOpacity } from "react-native";
import Icon from "react-native-vector-icons/Ionicons"; // Using Ionicons for eye icon

interface AuthInputProps extends TextInputProps {
    label: string;
}

export const AuthInput = ({ label, style, secureTextEntry, ...props }: AuthInputProps) => {
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    const isPasswordType = !!secureTextEntry;

    return (
        <View style={styles.wrap}>
            <Text style={styles.label}>{label}</Text>
            <View style={styles.inputContainer}>
                <TextInput
                    style={[styles.input, style]}
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={isPasswordType && !isPasswordVisible}
                    {...props}
                />
                {isPasswordType && (
                    <TouchableOpacity
                        onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                        style={styles.eyeIcon}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Icon
                            name={isPasswordVisible ? "eye-off-outline" : "eye-outline"}
                            size={20}
                            color="#6B7280"
                        />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrap: { marginBottom: 14 },
    label: {
        fontSize: 13.5,
        fontWeight: "700",
        color: "#111827",
        marginBottom: 8,
    },
    inputContainer: {
        position: "relative",
        justifyContent: "center",
    },
    input: {
        backgroundColor: "#F9FAFB",
        borderWidth: 1,
        borderColor: "#E5E7EB",
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
        color: "#111827",
        paddingRight: 40, // Space for eye icon
    },
    eyeIcon: {
        position: "absolute",
        right: 12,
        top: 0,
        bottom: 0,
        justifyContent: "center",
        paddingHorizontal: 6,
    },
});
