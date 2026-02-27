import React, { useState, useEffect } from "react";
import { View, StyleSheet, useWindowDimensions, TouchableWithoutFeedback, TouchableOpacity, Text, SafeAreaView } from "react-native";
import { useSelector } from 'react-redux';
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

interface OperatorLayoutProps {
    children: React.ReactNode;
    navigation: any;
    route?: any;
    title?: string;
    showBack?: boolean;
}

export default function OperatorLayout({ children, navigation, route, title = "Operator Dashboard", showBack = false }: OperatorLayoutProps) {
    const { width } = useWindowDimensions();
    const isMobile = width < 768; // Tablet/Mobile breakpoint
    const user = useSelector((state: any) => state.auth.user);

    // Auto-close sidebar on mobile initial load, open on desktop
    const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

    useEffect(() => {
        if (isMobile) {
            setSidebarOpen(false);
        } else {
            setSidebarOpen(true);
        }
    }, [isMobile]);

    const isManager = user?.role === 'yard_manager' || user?.role === 'admin' || user?.role === 'owner';

    return (
        <SafeAreaView style={styles.safeRoot}>
            <View style={styles.root}>
                {/* Main Content */}
                <View style={styles.main}>
                    <TopBar
                        onMenu={() => setSidebarOpen(!sidebarOpen)}
                        title={title}
                        showBack={showBack}
                        onBack={() => navigation.goBack()}
                    />

                    {/* Manager Simulation Banner */}
                    {isManager && (
                        <TouchableOpacity
                            style={styles.simulationBanner}
                            onPress={() => navigation.navigate('YardManagerDashboard')}
                        >
                            <Text style={styles.simulationText}>👀 Viewing as Operator — Tap to Return to Manager Dashboard</Text>
                        </TouchableOpacity>
                    )}

                    {children}
                </View>

                {/* Sidebar Overlay for Mobile / Flex for Desktop */}
                {sidebarOpen && (
                    <>
                        {/* Backdrop for Mobile */}
                        {isMobile && (
                            <TouchableWithoutFeedback onPress={() => setSidebarOpen(false)}>
                                <View style={styles.backdrop} />
                            </TouchableWithoutFeedback>
                        )}

                        <View style={[
                            styles.sidebar,
                            isMobile && styles.sidebarMobile
                        ]}>
                            <Sidebar navigation={navigation} route={route} />
                        </View>
                    </>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeRoot: {
        flex: 1,
        backgroundColor: "#FFF",
    },
    root: {
        flex: 1,
        flexDirection: "row", // Desktop: Side-by-Side
        backgroundColor: "#F3F4F6",
    },
    simulationBanner: {
        backgroundColor: '#15803D',
        padding: 10,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 5,
        zIndex: 10
    },
    simulationText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 12
    },
    main: {
        flex: 1,
        zIndex: 1,
    },
    sidebar: {
        width: 250,
        backgroundColor: "#FFF",
        borderRightWidth: 1,
        borderRightColor: "#E5E7EB",
    },
    sidebarMobile: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        zIndex: 100, // Above everything
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    backdrop: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.3)',
        zIndex: 50,
    }
});
