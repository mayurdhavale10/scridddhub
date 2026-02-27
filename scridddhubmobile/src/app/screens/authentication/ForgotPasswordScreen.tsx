
import React, { useState, useMemo, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    StatusBar,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { RootState, AppDispatch } from "../../../store";
import { forgotPassword, resetPassword, resetError, sendOtp } from "../../../store/slices/authSlice";
import { AuthInput } from "./components/AuthInput";
import { AuthButton } from "./components/AuthButton";

type Step = "email" | "reset";

export const ForgotPasswordScreen = ({ navigation }: any) => {
    const dispatch = useDispatch<AppDispatch>();
    const { isLoading, error } = useSelector((state: RootState) => state.auth);

    const [step, setStep] = useState<Step>("email");
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [newPass, setNewPass] = useState("");

    // Clear errors on mount
    useEffect(() => {
        dispatch(resetError());
    }, []);

    // Error handling
    useEffect(() => {
        if (error) {
            Alert.alert("Error", error, [{ text: "OK", onPress: () => dispatch(resetError()) }]);
        }
    }, [error, dispatch]);

    const handleSendEmail = async () => {
        if (!email.includes("@")) return Alert.alert("Invalid Email", "Please enter a valid email.");

        const result = await dispatch(forgotPassword(email));
        if (forgotPassword.fulfilled.match(result)) {
            setStep("reset");
            Alert.alert("Email Sent", `Check ${email} for your OTP.`);
        }
    };

    const handleReset = async () => {
        if (otp.length < 6 || newPass.length < 6) {
            return Alert.alert("Invalid Input", "OTP must be 6 digits and password min 6 chars.");
        }

        const result = await dispatch(resetPassword({ email, otp, newPassword: newPass }));
        if (resetPassword.fulfilled.match(result)) {
            Alert.alert("Success", "Password updated! Please login.", [
                { text: "OK", onPress: () => navigation.goBack() }
            ]);
        }
    };

    return (
        <SafeAreaView style={styles.safe}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            <KeyboardAvoidingView
                style={styles.safe}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <ScrollView contentContainerStyle={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                            <Text style={styles.backText}>← Back</Text>
                        </TouchableOpacity>

                        <View style={styles.logoWrap}>
                            <Image
                                source={require("../../../assets/brand/scridddhublogo.png")}
                                style={styles.logo}
                                resizeMode="contain"
                            />
                        </View>

                        <Text style={styles.title}>Reset Password</Text>
                        <Text style={styles.subtitle}>
                            {step === "email"
                                ? "Enter your email to receive a reset code."
                                : "Enter the code sent to your email and your new password."}
                        </Text>
                    </View>

                    {/* Form */}
                    <View style={styles.form}>
                        {step === "email" ? (
                            <>
                                <AuthInput
                                    label="Email Address"
                                    placeholder="name@company.com"
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                />
                                <AuthButton
                                    title="Send Reset Code"
                                    onPress={handleSendEmail}
                                    isLoading={isLoading}
                                    disabled={!email}
                                    style={{ marginTop: 20 }}
                                />
                            </>
                        ) : (
                            <>
                                <View style={styles.emailBanner}>
                                    <Text style={styles.emailBannerText}>Sent to: {email}</Text>
                                    <TouchableOpacity onPress={() => setStep("email")}>
                                        <Text style={styles.linkText}>Edit</Text>
                                    </TouchableOpacity>
                                </View>

                                <AuthInput
                                    label="Enter OTP"
                                    placeholder="123456"
                                    value={otp}
                                    onChangeText={setOtp}
                                    keyboardType="number-pad"
                                    maxLength={6}
                                />

                                <AuthInput
                                    label="New Password"
                                    placeholder="New strong password"
                                    value={newPass}
                                    onChangeText={setNewPass}
                                    secureTextEntry
                                />

                                <AuthButton
                                    title="Reset Password"
                                    onPress={handleReset}
                                    isLoading={isLoading}
                                    disabled={!otp || !newPass}
                                    style={{ marginTop: 20 }}
                                />
                            </>
                        )}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#FFFFFF" },
    container: { padding: 24 },
    backBtn: { marginBottom: 10 },
    backText: { color: "#6B7280", fontSize: 16 },
    logoWrap: { alignItems: "center", marginBottom: 20 },
    logo: { width: 80, height: 35 },
    header: { alignItems: "center", marginBottom: 30 },
    title: { fontSize: 24, fontWeight: "900", color: "#111827", marginBottom: 8 },
    subtitle: { fontSize: 14, color: "#6B7280", textAlign: "center", lineHeight: 20 },
    form: { width: "100%" },
    emailBanner: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20, backgroundColor: "#F3F4F6", padding: 12, borderRadius: 8 },
    emailBannerText: { color: "#374151" },
    linkText: { color: "#2563EB", fontWeight: "700" },
});
