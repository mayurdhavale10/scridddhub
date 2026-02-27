import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    StatusBar,
    Image,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    useWindowDimensions
} from 'react-native';
import { useDispatch } from 'react-redux';
import { setDemoRole } from '../../../../../../../store/slices/authSlice';

import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export const AuthRoleScreen = ({ navigation, route }: any) => {
    const dispatch = useDispatch();
    const { modules } = route.params || { modules: [] };

    // Force cache refresh
    const [loginMode, setLoginMode] = useState<'owner' | 'staff'>('owner');

    // Responsive Hook
    const { width } = useWindowDimensions();
    const isLargeScreen = width >= 768;

    // Form State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = () => {
        if (!email || !password) {
            Alert.alert("Missing Credentials", "Please enter your ID/Email and Password.");
            return;
        }

        setIsLoading(true);

        // MOCK AUTH LOGIC
        setTimeout(() => {
            setIsLoading(false);

            if (loginMode === 'owner') {
                if (password === 'admin') {
                    dispatch(setDemoRole('owner'));
                    navigation.replace('OwnerDashboard', { modules });
                } else {
                    Alert.alert("Login Failed", "Invalid Owner Credentials. Please contact Scriddd Support.");
                }
            } else {
                if (password === 'yard') {
                    dispatch(setDemoRole('yard_manager'));
                    navigation.replace('YardManagerDashboard', { modules });
                } else if (password === 'ops') {
                    dispatch(setDemoRole('operator'));
                    navigation.navigate('OperatorsDashboard', { modules });
                } else {
                    Alert.alert("Login Failed", "Invalid Staff ID or Password.");
                }
            }
        }, 1500);
    };

    // --- Render Logic ---
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={isLargeScreen ? "#E8F5E9" : "#F9FAFB"} />

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1, flexDirection: isLargeScreen ? 'row' : 'column' }}
            >
                {isLargeScreen && (
                    <View style={styles.heroContainer}>
                        {/* Decorative Background with Leaves */}
                        <View style={styles.heroBackground}>
                            {/* Images Removed for Debugging */}
                            <View style={styles.circle1} />
                        </View>

                        <View style={styles.heroContent}>
                            <View style={styles.brandSection}>
                                <Image
                                    source={require('../../../../../../../assets/brand/scridddhublogo.png')}
                                    style={styles.heroLogo}
                                    resizeMode="contain"
                                />
                                <View style={styles.taglineContainer}>
                                    <View style={styles.leafIcon} />
                                    <Text style={styles.tagline}>CIRCULAR ECONOMY PLATFORM</Text>
                                </View>
                            </View>

                            <View style={styles.heroTextSection}>
                                <Text style={styles.heroTitle}>Smart Recycling ERP</Text>
                                <View style={styles.heroDivider} />
                                <Text style={styles.heroSub}>
                                    Streamline operations, manage inventory, and optimize your entire recycling plant with AI-driven insights.
                                </Text>

                                {/* Features */}
                                <View style={styles.heroFeatures}>
                                    <View style={styles.featureItem}>
                                        <Icon name="robot-industrial" size={24} color="#1B5E20" style={{ marginRight: 12 }} />
                                        <Text style={styles.featureText}>AI-Powered Operations</Text>
                                    </View>
                                    <View style={styles.featureItem}>
                                        <Icon name="brain" size={24} color="#1B5E20" style={{ marginRight: 12 }} />
                                        <Text style={styles.featureText}>Predictive Analytics</Text>
                                    </View>
                                    <View style={styles.featureItem}>
                                        <Icon name="chart-timeline-variant" size={24} color="#1B5E20" style={{ marginRight: 12 }} />
                                        <Text style={styles.featureText}>Smart Workflow Automation</Text>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.heroFooter}>
                                <Text style={styles.heroFooterText}>© 2026 ScridddHub Inc.</Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* Form Section */}
                <View style={styles.formContainer}>
                    {/* Background Decoration for White Section - Images Removed for Debugging */}
                    <View />

                    <View style={[styles.formContentWrapper, isLargeScreen && styles.formContainerLarge]}>
                        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                            {/* Mobile Logo (Only show if NOT large screen) */}
                            {!isLargeScreen && (
                                <View style={styles.mobileHeader}>
                                    <Image
                                        source={require('../../../../../../../assets/brand/scridddhublogo.png')}
                                        style={styles.mobileLogo}
                                        resizeMode="contain"
                                    />
                                    <Text style={styles.subtitle}>Recycling Plant ERP</Text>
                                </View>
                            )}

                            {/* Role Switcher */}
                            <View style={styles.roleSwitchContainer}>
                                <TouchableOpacity
                                    style={[styles.roleTab, loginMode === 'owner' && styles.roleTabActive]}
                                    onPress={() => setLoginMode('owner')}
                                >
                                    <Icon name="briefcase-outline" size={20} color={loginMode === 'owner' ? '#1D7A27' : '#666'} />
                                    <Text style={[styles.roleTabText, loginMode === 'owner' && styles.roleTabTextActive]}>Owner / MD</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.roleTab, loginMode === 'staff' && styles.roleTabActive]}
                                    onPress={() => setLoginMode('staff')}
                                >
                                    <Icon name="account-group-outline" size={20} color={loginMode === 'staff' ? '#1D7A27' : '#666'} />
                                    <Text style={[styles.roleTabText, loginMode === 'staff' && styles.roleTabTextActive]}>Staff Login</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Login Form Card */}
                            <View style={[styles.card, isLargeScreen && styles.cardLarge]}>
                                <Text style={styles.cardTitle}>
                                    {loginMode === 'owner' ? 'Business Access' : 'Employee Access'}
                                </Text>
                                <Text style={styles.cardSub}>
                                    {loginMode === 'owner'
                                        ? 'Enter credentials provided by Scriddd Admin.'
                                        : 'Enter credentials provided by your Manager.'}
                                </Text>

                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>{loginMode === 'owner' ? 'Email / Tenant ID' : 'Phone / Staff ID'}</Text>
                                    <View style={styles.inputWrapper}>
                                        <Icon name="account-outline" size={20} color="#999" />
                                        <TextInput
                                            style={styles.input}
                                            placeholder={loginMode === 'owner' ? 'admin@company.com' : 'e.g. 9876543210'}
                                            value={email}
                                            onChangeText={setEmail}
                                            autoCapitalize="none"
                                        />
                                    </View>
                                </View>

                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Password</Text>
                                    <View style={styles.inputWrapper}>
                                        <Icon name="lock-outline" size={20} color="#999" />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="••••••••"
                                            secureTextEntry
                                            value={password}
                                            onChangeText={setPassword}
                                        />
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={styles.loginBtn}
                                    onPress={handleLogin}
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <ActivityIndicator color="#FFF" />
                                    ) : (
                                        <Text style={styles.loginBtnText}>
                                            Login as {loginMode === 'owner' ? 'Owner' : 'Staff'}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>

                            {/* Hints for Demo */}
                            <View style={styles.demoHint}>
                                <Text style={styles.demoTitle}>💡 Demo Credentials:</Text>
                                <Text style={styles.demoText}>Owner: <Text style={{ fontWeight: 'bold' }}>admin</Text></Text>
                                <Text style={styles.demoText}>Yard Mgr: <Text style={{ fontWeight: 'bold' }}>yard</Text></Text>
                                <Text style={styles.demoText}>Operator: <Text style={{ fontWeight: 'bold' }}>ops</Text></Text>
                            </View>

                        </ScrollView>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },

    // HERO SECTION (Tablet Only)
    heroContainer: {
        flex: 1,
        backgroundColor: '#E8F5E9',
        position: 'relative',
        overflow: 'hidden',
    },
    heroBackground: {
        ...StyleSheet.absoluteFillObject,
    },
    leafLarge: {
        position: 'absolute',
        width: 400,
        height: 400,
        top: -80,
        right: -100,
        opacity: 0.15,
        transform: [{ rotate: '45deg' }],
        tintColor: '#2E7D32',
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
    heroSub: {
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
    featureText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1B5E20',
    },
    heroFooter: {
        paddingTop: 24,
        borderTopWidth: 1,
        borderTopColor: 'rgba(67, 160, 71, 0.2)',
    },
    heroFooterText: {
        color: '#66BB6A',
        fontSize: 13,
        fontWeight: '500',
    },

    // FORM SECTION
    formContainer: {
        flex: 1,
        backgroundColor: '#FFFFFF', // Clean White
        position: 'relative',
        overflow: 'hidden',
    },
    formContentWrapper: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    formContainerLarge: {
        justifyContent: 'center',
        zIndex: 10,
    },
    formLeafTop: {
        position: 'absolute',
        width: 250,
        height: 250,
        top: -60,
        right: -60,
        opacity: 0.05,
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
    scrollContent: {
        flexGrow: 1,
        padding: 24,
        justifyContent: 'center',
    },

    // Mobile Header
    mobileHeader: {
        alignItems: 'center',
        marginBottom: 30,
    },
    mobileLogo: {
        width: 180,
        height: 60,
    },
    subtitle: {
        marginTop: 5,
        fontSize: 16,
        color: '#666',
        fontWeight: '600',
    },

    roleSwitchContainer: {
        flexDirection: 'row',
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        padding: 4,
        marginBottom: 24,
        maxWidth: 460,
        alignSelf: 'center',
        width: '100%',
    },
    roleTab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 10,
    },
    roleTabActive: {
        backgroundColor: '#FFFFFF',
        shadowColor: 'rgba(0,0,0,0.05)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 4,
        elevation: 2,
    },
    roleTabText: {
        marginLeft: 8,
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    roleTabTextActive: {
        color: '#1B5E20',
        fontWeight: '700',
    },

    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 24,
        shadowColor: 'rgba(0,0,0,0.08)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 12,
        elevation: 5,
        width: '100%',
        maxWidth: 460,
        alignSelf: 'center',
        borderWidth: 1,
        borderColor: '#F1F1F1',
    },
    cardLarge: {
        shadowOpacity: 0.05,
        elevation: 2,
    },
    cardTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 6,
        letterSpacing: -0.5,
    },
    cardSub: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 28,
        lineHeight: 20,
    },

    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 4,
        backgroundColor: '#F9FAFB',
    },
    input: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 10,
        fontSize: 15,
        color: '#111827',
    },

    loginBtn: {
        backgroundColor: '#1B5E20',
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 12,
        shadowColor: 'rgba(27, 94, 32, 0.3)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 8,
        elevation: 4,
    },
    loginBtnText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },

    demoHint: {
        marginTop: 30,
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#F0FDF4',
        borderRadius: 12,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: '#86EFAC',
        maxWidth: 460,
        alignSelf: 'center',
        width: '100%',
    },
    demoTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#15803D',
        marginBottom: 6,
    },
    demoText: {
        fontSize: 13,
        color: '#166534',
        marginVertical: 1,
    }
});
