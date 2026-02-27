import React, { useEffect, useMemo, useState } from "react";
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
    useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { RootState, AppDispatch } from "../../../store";
import { sendOtp, verifyOtp, loginWithGoogle, loginWithPassword, resetError } from "../../../store/slices/authSlice";
import { AuthInput } from "./components/AuthInput";
import { AuthButton } from "./components/AuthButton";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

type Mode = "login" | "signup";

export const LoginScreen = ({ navigation }: any) => {
    const dispatch = useDispatch<AppDispatch>();
    const { isLoading, error, isAuthenticated } = useSelector(
        (state: RootState) => state.auth
    );

    // Responsive Hook
    const { width } = useWindowDimensions();
    const isLargeScreen = width >= 768;

    const [mode, setMode] = useState<Mode>("login");

    // Login
    const [loginEmail, setLoginEmail] = useState("");
    const [loginPassword, setLoginPassword] = useState("");

    // Signup
    const [signupEmail, setSignupEmail] = useState("");
    const [signupPassword, setSignupPassword] = useState("");
    const [signupOtpSent, setSignupOtpSent] = useState(false);
    const [signupOtp, setSignupOtp] = useState("");

    useEffect(() => {
        if (error) {
            Alert.alert("Error", error, [
                { text: "OK", onPress: () => dispatch(resetError()) },
            ]);
        }
    }, [error, dispatch]);

    useEffect(() => {
        if (isAuthenticated) navigation.replace("Main");
    }, [isAuthenticated, navigation]);

    const loginValid = useMemo(
        () => !!loginEmail && !!loginPassword,
        [loginEmail, loginPassword]
    );

    const signupValid = useMemo(() => {
        if (!signupOtpSent) return !!signupEmail && !!signupPassword;
        return signupOtp.length === 6;
    }, [signupEmail, signupPassword, signupOtpSent, signupOtp]);

    const switchMode = (next: Mode) => {
        setMode(next);
        dispatch(resetError());
        setSignupOtpSent(false);
        setSignupOtp("");
    };

    const onForgotPassword = () => {
        navigation.navigate("ForgotPassword");
    };

    const onGoogleLogin = () => {
        dispatch(loginWithGoogle());
    };

    const onLogin = () => {
        if (!loginValid) return Alert.alert("Invalid", "Enter email and password.");
        dispatch(loginWithPassword({ email: loginEmail, password: loginPassword }));
    };

    const onSendSignupOtp = () => {
        if (!signupEmail || !signupPassword) {
            return Alert.alert("Invalid", "Enter email + create password first.");
        }
        dispatch(sendOtp(signupEmail));
        setSignupOtpSent(true);
    };

    const onVerifySignupOtp = () => {
        if (signupOtp.length !== 6) return Alert.alert("Invalid OTP", "Enter 6 digits.");
        dispatch(verifyOtp({ identifier: signupEmail, otp: signupOtp, password: signupPassword }));
    };

    // --- Enhanced Tablet Hero Section ---
    const HeroSection = () => (
        <View style={styles.heroContainer}>
            {/* Decorative Background with Multiple Leaf Images */}
            <View style={styles.heroBackground}>
                {/* Large Leaf - Top Right */}
                <Image
                    source={require("../../../assets/onoff/healthyleaf-on.png")}
                    style={styles.leafLarge}
                    resizeMode="contain"
                />

                {/* Medium Leaf - Bottom Left */}
                <Image
                    source={require("../../../assets/onoff/healthyleaf-on.png")}
                    style={styles.leafMedium}
                    resizeMode="contain"
                />

                {/* Small Leaf - Center Right */}
                <Image
                    source={require("../../../assets/onoff/healthyleaf-on.png")}
                    style={styles.leafSmall}
                    resizeMode="contain"
                />

                {/* Additional decorative circles for depth */}
                <View style={styles.circle1} />
                <View style={styles.circle2} />
            </View>

            {/* Content Overlay */}
            <View style={styles.heroContent}>
                {/* Logo and Brand */}
                <View style={styles.brandSection}>
                    <Image
                        source={require("../../../assets/brand/scridddhublogo.png")}
                        style={styles.heroLogo}
                        resizeMode="contain"
                    />
                    <View style={styles.taglineContainer}>
                        <View style={styles.leafIcon} />
                        <Text style={styles.tagline}>CIRCULAR ECONOMY PLATFORM</Text>
                    </View>
                </View>

                {/* Main Content */}
                <View style={styles.heroTextSection}>
                    <Text style={styles.heroTitle}>
                        Join the{'\n'}Circular Economy
                    </Text>
                    <View style={styles.heroDivider} />
                    <Text style={styles.heroDescription}>
                        Manage recycling operations, track logistics, and optimize waste
                        management with ScridddHub's comprehensive platform.
                    </Text>

                    {/* Feature Highlights */}
                    <View style={styles.heroFeatures}>
                        {[
                            { icon: "robot-industrial", text: "AI-Powered Autonomous Agents" },
                            { icon: "brain", text: "Predictive Analytics & ERP" },
                            { icon: "chart-timeline-variant", text: "Smart Workflow Automation" },
                        ].map((feature, idx) => (
                            <View key={idx} style={styles.featureItem}>
                                <Icon name={feature.icon} size={24} color="#1B5E20" style={{ marginRight: 12 }} />
                                <Text style={styles.featureText}>{feature.text}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Footer */}
                <View style={styles.heroFooter}>
                    <Text style={styles.heroFooterText}>© 2026 ScridddHub Inc.</Text>
                    <View style={styles.footerDot} />
                    <Text style={styles.heroFooterText}>Sustainable Solutions</Text>
                </View>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.safe}>
            <StatusBar barStyle="dark-content" backgroundColor={isLargeScreen ? "#E8F5E9" : "#FFFFFF"} />

            <KeyboardAvoidingView
                style={[styles.safe, isLargeScreen && styles.tabletLayout]}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                {/* Hero Side (Tablet Only) */}
                {isLargeScreen && <HeroSection />}

                {/* Form Side */}
                <View style={[styles.formSide, isLargeScreen && styles.formSideTablet]}>
                    {/* Background Decoration for White Section */}
                    <Image
                        source={require("../../../assets/onoff/healthyleaf-on.png")}
                        style={styles.formLeafTop}
                        resizeMode="contain"
                    />
                    <Image
                        source={require("../../../assets/onoff/healthyleaf-on.png")}
                        style={styles.formLeafBottom}
                        resizeMode="contain"
                    />

                    <ScrollView
                        contentContainerStyle={[
                            styles.scrollContent,
                            isLargeScreen && styles.scrollContentTablet
                        ]}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Logo (Mobile Only) */}
                        {!isLargeScreen && (
                            <View style={styles.mobileLogoWrap}>
                                <Image
                                    source={require("../../../assets/brand/scridddhublogo.png")}
                                    style={styles.mobileLogo}
                                    resizeMode="contain"
                                />
                            </View>
                        )}

                        {/* Form Container */}
                        <View style={styles.formContainer}>
                            {/* Mode Toggle */}
                            <View style={styles.toggleContainer}>
                                <TouchableOpacity
                                    activeOpacity={0.9}
                                    onPress={() => switchMode("login")}
                                    style={[
                                        styles.toggleButton,
                                        mode === "login" && styles.toggleButtonActive,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.toggleText,
                                            mode === "login" && styles.toggleTextActive,
                                        ]}
                                    >
                                        Login
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    activeOpacity={0.9}
                                    onPress={() => switchMode("signup")}
                                    style={[
                                        styles.toggleButton,
                                        mode === "signup" && styles.toggleButtonActive,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.toggleText,
                                            mode === "signup" && styles.toggleTextActive,
                                        ]}
                                    >
                                        Signup
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Header */}
                            <View style={styles.formHeader}>
                                <Text style={styles.formTitle}>
                                    {mode === "login" ? "Welcome Back" : "Create Account"}
                                </Text>
                                <Text style={styles.formSubtitle}>
                                    {mode === "login"
                                        ? "Login to continue to your workspace"
                                        : signupOtpSent
                                            ? `We sent an OTP to ${signupEmail}`
                                            : "Get started with your account"}
                                </Text>
                            </View>

                            {/* Form Fields */}
                            <View style={styles.formFields}>
                                {mode === "login" ? (
                                    <>
                                        <AuthInput
                                            label="Email Address"
                                            placeholder="name@company.com"
                                            value={loginEmail}
                                            onChangeText={setLoginEmail}
                                            autoCapitalize="none"
                                            keyboardType="email-address"
                                        />

                                        <AuthInput
                                            label="Password"
                                            placeholder="Enter password"
                                            value={loginPassword}
                                            onChangeText={setLoginPassword}
                                            secureTextEntry
                                        />

                                        <TouchableOpacity onPress={onForgotPassword} style={styles.forgotLink}>
                                            <Text style={styles.linkText}>Forgot password?</Text>
                                        </TouchableOpacity>

                                        <AuthButton
                                            title="Login"
                                            onPress={onLogin}
                                            isLoading={isLoading}
                                            disabled={!loginValid}
                                            style={{ marginTop: 10 }}
                                        />

                                        <View style={styles.divider}>
                                            <View style={styles.dividerLine} />
                                            <Text style={styles.dividerText}>OR</Text>
                                            <View style={styles.dividerLine} />
                                        </View>

                                        <AuthButton
                                            title="Continue with Google"
                                            variant="google"
                                            onPress={onGoogleLogin}
                                        />

                                        <View style={styles.bottomLink}>
                                            <Text style={styles.bottomText}>Don't have an account?</Text>
                                            <TouchableOpacity onPress={() => switchMode("signup")}>
                                                <Text style={[styles.linkText, { marginLeft: 6 }]}>Create one</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </>
                                ) : (
                                    <>
                                        {!signupOtpSent ? (
                                            <>
                                                <AuthInput
                                                    label="Email Address"
                                                    placeholder="name@company.com"
                                                    value={signupEmail}
                                                    onChangeText={setSignupEmail}
                                                    autoCapitalize="none"
                                                    keyboardType="email-address"
                                                />

                                                <AuthInput
                                                    label="Create Password"
                                                    placeholder="Create a strong password"
                                                    value={signupPassword}
                                                    onChangeText={setSignupPassword}
                                                    secureTextEntry
                                                />

                                                <AuthButton
                                                    title="Send OTP"
                                                    onPress={onSendSignupOtp}
                                                    isLoading={isLoading}
                                                    disabled={!signupEmail || !signupPassword}
                                                    style={{ marginTop: 10 }}
                                                />

                                                <View style={styles.divider}>
                                                    <View style={styles.dividerLine} />
                                                    <Text style={styles.dividerText}>OR</Text>
                                                    <View style={styles.dividerLine} />
                                                </View>

                                                <AuthButton
                                                    title="Continue with Google"
                                                    variant="google"
                                                    onPress={onGoogleLogin}
                                                />
                                            </>
                                        ) : (
                                            <>
                                                <AuthInput
                                                    label="OTP"
                                                    placeholder="6-digit OTP"
                                                    value={signupOtp}
                                                    onChangeText={setSignupOtp}
                                                    keyboardType="number-pad"
                                                    maxLength={6}
                                                />

                                                <View style={styles.otpActions}>
                                                    <TouchableOpacity
                                                        onPress={() => {
                                                            setSignupOtpSent(false);
                                                            setSignupOtp("");
                                                        }}
                                                    >
                                                        <Text style={styles.linkText}>Change details</Text>
                                                    </TouchableOpacity>

                                                    <TouchableOpacity onPress={onSendSignupOtp}>
                                                        <Text style={styles.linkText}>Resend OTP</Text>
                                                    </TouchableOpacity>
                                                </View>

                                                <AuthButton
                                                    title="Verify & Create Account"
                                                    onPress={onVerifySignupOtp}
                                                    isLoading={isLoading}
                                                    disabled={!signupValid}
                                                    style={{ marginTop: 12 }}
                                                />
                                            </>
                                        )}

                                        <View style={styles.bottomLink}>
                                            <Text style={styles.bottomText}>Already have an account?</Text>
                                            <TouchableOpacity onPress={() => switchMode("login")}>
                                                <Text style={[styles.linkText, { marginLeft: 6 }]}>Login</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </>
                                )}
                            </View>
                        </View>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: "#FFFFFF",
    },
    tabletLayout: {
        flexDirection: 'row',
    },

    // ============================================
    // HERO SECTION (TABLET ONLY)
    // ============================================
    heroContainer: {
        flex: 1,
        backgroundColor: '#E8F5E9',
        position: 'relative',
        overflow: 'hidden',
    },
    heroBackground: {
        ...StyleSheet.absoluteFillObject,
    },

    // LEAF IMAGES - Multiple leaves at different positions
    leafLarge: {
        position: 'absolute',
        width: 400,
        height: 400,
        top: -80,
        right: -100,
        opacity: 0.15,
        transform: [{ rotate: '45deg' }],
        tintColor: '#2E7D32', // Optional: Tint to match theme if it's a colored png
    },
    leafMedium: {
        position: 'absolute',
        width: 300,
        height: 300,
        bottom: -40,
        left: -80,
        opacity: 0.10,
        transform: [{ rotate: '-30deg' }],
        tintColor: '#2E7D32',
    },
    leafSmall: {
        position: 'absolute',
        width: 150,
        height: 150,
        top: '40%',
        right: 60,
        opacity: 0.08,
        transform: [{ rotate: '15deg' }],
        tintColor: '#2E7D32',
    },

    // Decorative circles for depth
    circle1: {
        position: 'absolute',
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: '#66BB6A',
        opacity: 0.08,
        top: 100,
        left: 80,
    },
    circle2: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: '#43A047',
        opacity: 0.06,
        bottom: 100,
        right: 100,
    },

    heroContent: {
        flex: 1,
        padding: 48,
        paddingTop: 60,
        justifyContent: 'space-between',
        zIndex: 1,
    },
    brandSection: {
        marginBottom: 40,
    },
    heroLogo: {
        width: 220,
        height: 90,
        marginBottom: 16,
    },
    taglineContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
    },
    leafIcon: {
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#43A047',
        marginRight: 8,
    },
    tagline: {
        fontSize: 14,
        fontWeight: '600',
        color: '#2E7D32',
        letterSpacing: 1.5,
    },
    heroTextSection: {
        flex: 1,
        justifyContent: 'center',
    },
    heroTitle: {
        fontSize: 48,
        fontWeight: '800',
        color: '#1B5E20',
        lineHeight: 56,
        marginBottom: 24,
        letterSpacing: -1.5,
    },
    heroDivider: {
        width: 80,
        height: 4,
        backgroundColor: '#43A047',
        marginBottom: 24,
        borderRadius: 2,
    },
    heroDescription: {
        fontSize: 18,
        color: '#2E7D32',
        lineHeight: 30,
        marginBottom: 40,
        maxWidth: 480,
        opacity: 0.9,
    },
    heroFeatures: {
        gap: 20,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    featureIcon: {
        fontSize: 24,
        marginRight: 12,
    },
    featureText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1B5E20',
    },
    heroFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 24,
        borderTopWidth: 1,
        borderTopColor: 'rgba(67, 160, 71, 0.2)',
    },
    heroFooterText: {
        color: '#66BB6A',
        fontSize: 13,
        fontWeight: '500',
    },
    footerDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#66BB6A',
        marginHorizontal: 12,
    },

    // ============================================
    // FORM SIDE (MOBILE & TABLET)
    // ============================================
    formSide: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        position: 'relative', // Ensure absolute children are relative to this
        overflow: 'hidden',
    },
    // Form Background Decoration
    formLeafTop: {
        position: 'absolute',
        width: 250,
        height: 250,
        top: -60,
        right: -60,
        opacity: 0.05, // Very subtle on white
        transform: [{ rotate: '90deg' }],
        tintColor: '#2E7D32',
    },
    formLeafBottom: {
        position: 'absolute',
        width: 300,
        height: 300,
        bottom: -80,
        left: -80,
        opacity: 0.05,
        transform: [{ rotate: '-45deg' }],
        tintColor: '#2E7D32',
    },

    formSideTablet: {
        flex: 1,
        maxWidth: 600,
    },
    scrollContent: {
        flexGrow: 1,
        padding: 24,
        paddingTop: 60,
        zIndex: 10, // Ensure form sits above background
    },
    scrollContentTablet: {
        justifyContent: 'center',
        paddingHorizontal: 60,
        paddingVertical: 80,
    },
    mobileLogoWrap: {
        alignItems: 'center',
        marginBottom: 32,
    },
    mobileLogo: {
        width: 100,
        height: 45,
    },
    formContainer: {
        width: '100%',
        maxWidth: 460,
        alignSelf: 'center',
    },

    // ============================================
    // TOGGLE
    // ============================================
    toggleContainer: {
        flexDirection: 'row',
        backgroundColor: '#F9FAFB',
        borderRadius: 16,
        padding: 4,
        marginBottom: 32,
    },
    toggleButton: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 12,
        backgroundColor: 'transparent',
    },
    toggleButtonActive: {
        backgroundColor: '#20872A',
        shadowColor: '#20872A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 3,
    },
    toggleText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#6B7280',
    },
    toggleTextActive: {
        color: '#FFFFFF',
        fontWeight: '800',
    },

    // ============================================
    // FORM HEADER
    // ============================================
    formHeader: {
        marginBottom: 28,
    },
    formTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    formSubtitle: {
        fontSize: 15,
        color: '#6B7280',
        lineHeight: 22,
    },

    // ============================================
    // FORM FIELDS
    // ============================================
    formFields: {
        gap: 16,
    },
    forgotLink: {
        alignItems: 'flex-end',
        marginTop: -8,
        marginBottom: 4,
    },
    linkText: {
        color: '#20872A',
        fontSize: 14,
        fontWeight: '700',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 20,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#E5E7EB',
    },
    dividerText: {
        marginHorizontal: 16,
        color: '#9CA3AF',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    bottomLink: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 24,
    },
    bottomText: {
        color: '#6B7280',
        fontSize: 14,
        fontWeight: '500',
    },
    otpActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
        marginBottom: 4,
    },
});