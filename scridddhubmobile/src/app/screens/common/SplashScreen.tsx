import React, { useEffect, useRef } from "react";
import { StyleSheet, Animated, StatusBar, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export const SplashScreen = () => {
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
        }).start();
    }, [fadeAnim]);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar backgroundColor="#FFFFFF" barStyle="dark-content" />
            <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
                <Image
                    source={require('../../../assets/brand/scridddhublogo.png')}
                    style={styles.logoImage}
                    resizeMode="contain"
                />
            </Animated.View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFFFFF",
        justifyContent: "center",
        alignItems: "center",
    },
    content: {
        width: "100%",
        alignItems: "center",
    },
    logoImage: {
        width: "72%",
        maxWidth: 280,
        height: 140,
    },
});
