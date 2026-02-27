import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    StatusBar,
    Image,
    Animated,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import { setIndustry } from '../../store/slices/tenantSlice';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { IndustryStackParamList } from '../navigation/IndustryNavigator';

type NavigationProp = NativeStackNavigationProp<IndustryStackParamList, 'OnboardingIndustry'>;

interface Props {
    navigation: NavigationProp;
}

type IndustryOption = {
    id: string;
    name: string;
    icon: any;
    description: string;
    navigateTo?: keyof IndustryStackParamList;
    comingSoon?: boolean;
};

const industries: IndustryOption[] = [
    {
        id: 'home',
        name: 'Home / General Business',
        icon: require('../../assets/workspaces/homescriddd.png'),
        description: 'Manage finance, operations, tasks, and everything in one place.',
        comingSoon: true,
    },
    {
        id: 'factory',
        name: 'Manufacturing & Factory',
        icon: require('../../assets/workspaces/factory.png'),
        description: 'Production tracking, shifts, and machine maintenance.',
        comingSoon: true,
    },
    {
        id: 'recycling',
        name: 'Recycling Plant',
        icon: require('../../assets/workspaces/recycling.png'),
        description: 'Inbound/outbound waste, compliance, and sorting.',
        navigateTo: 'RecyclingDashboard',
    },
    {
        id: 'hospital',
        name: 'Hospital / Clinic',
        icon: require('../../assets/workspaces/hospital.png'),
        description: 'Patient flow, staff rostering, and inventory.',
        comingSoon: true,
    },
    {
        id: 'others',
        name: 'Explore Other Industries',
        icon: require('../../assets/workspaces/explore.png'),
        description: 'Click to know more industries and use cases.',
        comingSoon: true,
    },
];

export const OnboardingIndustry: React.FC<Props> = ({ navigation }) => {
    const [pressedCard, setPressedCard] = useState<string | null>(null);

    // Animation values
    const logoScale = useRef(new Animated.Value(0)).current;
    const logoOpacity = useRef(new Animated.Value(0)).current;
    const headerFade = useRef(new Animated.Value(0)).current;
    const headerSlide = useRef(new Animated.Value(-20)).current;
    const skipFade = useRef(new Animated.Value(0)).current;

    // Card animations
    const cardAnimations = useRef(
        Array.from({ length: 5 }, () => ({
            opacity: new Animated.Value(0),
            translateY: new Animated.Value(30),
            scale: new Animated.Value(0.9),
        }))
    ).current;

    useEffect(() => {
        // Sequence of animations
        Animated.sequence([
            // 1. Logo animation
            Animated.parallel([
                Animated.spring(logoScale, {
                    toValue: 1,
                    tension: 50,
                    friction: 7,
                    useNativeDriver: true,
                }),
                Animated.timing(logoOpacity, {
                    toValue: 1,
                    duration: 400,
                    useNativeDriver: true,
                }),
            ]),

            // 2. Header text animation
            Animated.parallel([
                Animated.timing(headerFade, {
                    toValue: 1,
                    duration: 400,
                    useNativeDriver: true,
                }),
                Animated.timing(headerSlide, {
                    toValue: 0,
                    duration: 400,
                    useNativeDriver: true,
                }),
                Animated.timing(skipFade, {
                    toValue: 1,
                    duration: 400,
                    useNativeDriver: true,
                }),
            ]),
        ]).start();

        // 3. Stagger card animations
        const cardStaggerDelay = 80;
        const cardAnimationSequence = cardAnimations.map((anim, index) => {
            return Animated.parallel([
                Animated.timing(anim.opacity, {
                    toValue: 1,
                    duration: 500,
                    delay: index * cardStaggerDelay,
                    useNativeDriver: true,
                }),
                Animated.spring(anim.translateY, {
                    toValue: 0,
                    tension: 50,
                    friction: 8,
                    delay: index * cardStaggerDelay,
                    useNativeDriver: true,
                }),
                Animated.spring(anim.scale, {
                    toValue: 1,
                    tension: 50,
                    friction: 8,
                    delay: index * cardStaggerDelay,
                    useNativeDriver: true,
                }),
            ]);
        });

        Animated.stagger(0, cardAnimationSequence).start();
    }, []);

    const dispatch = useDispatch();

    const handleSelect = (item: IndustryOption) => {
        dispatch(setIndustry({ id: item.id, name: item.name }));

        if (item.comingSoon) {
            Alert.alert(
                'Coming Soon! 🚀',
                `The ${item.name} module is currently under development. Stay tuned!`,
                [{ text: 'OK', style: 'default' }]
            );
        } else if (item.navigateTo) {
            navigation.navigate(item.navigateTo);
        }
    };

    const handleSkip = () => {
        dispatch(setIndustry({ id: 'recycling', name: 'Recycling Plant' }));
        navigation.navigate('RecyclingDashboard');
    };

    const mainIndustries = industries.slice(0, 4);
    const exploreOption = industries[4];

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />

            <View style={styles.header}>
                <Animated.View style={{ opacity: skipFade }}>
                    <TouchableOpacity
                        style={styles.skipButton}
                        onPress={handleSkip}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.skipText}>Skip for now</Text>
                    </TouchableOpacity>
                </Animated.View>

                <Animated.View
                    style={[
                        styles.logoWrapper,
                        {
                            opacity: logoOpacity,
                            transform: [{ scale: logoScale }],
                        }
                    ]}
                >
                    <Image
                        source={require('../../assets/brand/scridddhublogo.png')}
                        style={styles.logo}
                        resizeMode="contain"
                    />
                </Animated.View>

                <Animated.View
                    style={{
                        opacity: headerFade,
                        transform: [{ translateY: headerSlide }],
                    }}
                >
                    <Text style={styles.title}>Welcome to your Intelligent Workspace</Text>
                    <Text style={styles.subtitle}>
                        Your AI-powered hub for operations, accounting, and growth.
                    </Text>
                </Animated.View>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.gridContainer}>
                    {mainIndustries.map((item, index) => (
                        <Animated.View
                            key={item.id}
                            style={[
                                styles.gridItemWrapper,
                                {
                                    opacity: cardAnimations[index].opacity,
                                    transform: [
                                        { translateY: cardAnimations[index].translateY },
                                        { scale: cardAnimations[index].scale },
                                    ],
                                }
                            ]}
                        >
                            <TouchableOpacity
                                style={[
                                    styles.gridCard,
                                    pressedCard === item.id && styles.gridCardPressed,
                                    item.comingSoon && styles.gridCardComingSoon,
                                ]}
                                activeOpacity={0.65}
                                onPressIn={() => setPressedCard(item.id)}
                                onPressOut={() => setPressedCard(null)}
                                onPress={() => handleSelect(item)}
                            >
                                <Image
                                    source={item.icon}
                                    style={[
                                        styles.gridIconImage,
                                        item.comingSoon && styles.iconComingSoon
                                    ]}
                                    resizeMode="contain"
                                />
                                <Text style={styles.gridTitle}>{item.name}</Text>
                                <Text style={styles.gridDesc} numberOfLines={2}>
                                    {item.description}
                                </Text>
                                {item.comingSoon && (
                                    <View style={styles.comingSoonBadge}>
                                        <Text style={styles.comingSoonText}>Coming Soon</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </Animated.View>
                    ))}
                </View>

                <Animated.View
                    style={{
                        opacity: cardAnimations[4].opacity,
                        transform: [
                            { translateY: cardAnimations[4].translateY },
                            { scale: cardAnimations[4].scale },
                        ],
                    }}
                >
                    <TouchableOpacity
                        style={[
                            styles.exploreCard,
                            pressedCard === exploreOption.id && styles.exploreCardPressed,
                        ]}
                        activeOpacity={0.65}
                        onPressIn={() => setPressedCard(exploreOption.id)}
                        onPressOut={() => setPressedCard(null)}
                        onPress={() => handleSelect(exploreOption)}
                    >
                        <Image
                            source={exploreOption.icon}
                            style={styles.exploreIconImage}
                            resizeMode="contain"
                        />

                        <View style={styles.exploreContent}>
                            <Text style={styles.exploreTitle}>{exploreOption.name}</Text>
                            <Text style={styles.exploreDesc}>{exploreOption.description}</Text>
                        </View>

                        <Text style={styles.arrow}>→</Text>
                    </TouchableOpacity>
                </Animated.View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: 24,
    },
    skipButton: {
        alignSelf: 'flex-end',
        paddingVertical: 8,
        paddingHorizontal: 12,
        marginBottom: 8,
    },
    skipText: {
        color: '#378839',
        fontSize: 14,
        fontWeight: '600',
    },
    logoWrapper: {
        alignItems: 'center',
        marginBottom: 20,
    },
    logo: {
        width: 240,
        height: 72,
    },
    title: {
        fontSize: 26,
        fontWeight: '700',
        color: '#378839',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#4B5563',
        lineHeight: 24,
        textAlign: 'center',
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingBottom: 16,
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    gridItemWrapper: {
        width: '48%',
        marginBottom: 16,
    },
    gridCard: {
        backgroundColor: '#FFFFFF',
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        alignItems: 'center',
        minHeight: 180,
        position: 'relative',
    },
    gridCardPressed: {
        borderColor: '#378839',
        borderWidth: 2,
        elevation: 1,
        shadowOpacity: 0.03,
    },
    gridCardComingSoon: {
        opacity: 0.7,
    },
    gridIconImage: {
        width: 64,
        height: 64,
        marginBottom: 12,
    },
    iconComingSoon: {
        opacity: 0.5,
    },
    gridTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
        textAlign: 'center',
    },
    gridDesc: {
        fontSize: 13,
        color: '#6B7280',
        lineHeight: 18,
        textAlign: 'center',
    },
    comingSoonBadge: {
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    comingSoonText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#92400E',
    },
    exploreCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0FDF4',
        padding: 20,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#378839',
        borderStyle: 'dashed',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 3,
    },
    exploreCardPressed: {
        backgroundColor: '#DCFCE7',
        elevation: 0,
    },
    exploreIconImage: {
        width: 56,
        height: 56,
        marginRight: 16,
    },
    exploreContent: {
        flex: 1,
    },
    exploreTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    exploreDesc: {
        fontSize: 13,
        color: '#4B5563',
        lineHeight: 18,
    },
    arrow: {
        fontSize: 24,
        color: '#378839',
        fontWeight: '300',
        marginLeft: 12,
    },
});