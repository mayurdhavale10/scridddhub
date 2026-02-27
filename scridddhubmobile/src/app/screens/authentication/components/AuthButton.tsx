import React from "react";
import {
    TouchableOpacity,
    Text,
    ActivityIndicator,
    TouchableOpacityProps,
    StyleSheet,
} from "react-native";

type Variant = "primary" | "google" | "ghost";

interface AuthButtonProps extends TouchableOpacityProps {
    title: string;
    isLoading?: boolean;
    variant?: Variant;
}

export const AuthButton = ({
    title,
    isLoading,
    variant = "primary",
    style,
    disabled,
    ...props
}: AuthButtonProps) => {
    const isDisabled = disabled || isLoading;

    return (
        <TouchableOpacity
            style={[
                styles.base,
                variant === "primary" && styles.primary,
                variant === "google" && styles.google,
                variant === "ghost" && styles.ghost,
                isDisabled && styles.disabled,
                style,
            ]}
            activeOpacity={0.88}
            disabled={isDisabled}
            {...props}
        >
            {isLoading ? (
                <ActivityIndicator color={variant === "google" ? "#111827" : "#FFFFFF"} />
            ) : (
                <Text
                    style={[
                        styles.textBase,
                        variant === "primary" && styles.primaryText,
                        variant === "google" && styles.googleText,
                        variant === "ghost" && styles.ghostText,
                    ]}
                >
                    {title}
                </Text>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    base: {
        borderRadius: 14,
        paddingVertical: 15,
        alignItems: "center",
        justifyContent: "center",
    },
    textBase: {
        fontSize: 16,
        fontWeight: "800",
    },
    primary: {
        backgroundColor: "#20872A",
        shadowColor: "#20872A",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.22,
        shadowRadius: 12,
        elevation: 5,
    },
    primaryText: {
        color: "#FFFFFF",
    },
    google: {
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#E5E7EB",
    },
    googleText: {
        color: "#111827",
    },
    ghost: {
        backgroundColor: "transparent",
    },
    ghostText: {
        color: "#20872A",
        fontWeight: "800",
        fontSize: 14,
    },
    disabled: {
        opacity: 0.55,
    },
});
