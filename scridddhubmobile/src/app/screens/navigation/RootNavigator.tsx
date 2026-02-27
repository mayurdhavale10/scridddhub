import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SplashScreen } from '../common/SplashScreen';
import { OnboardingIndustry } from '../OnboardingIndustry';
import { LoginScreen } from '../authentication/LoginScreen';
import { TabNavigator } from './TabNavigator';
import { ForgotPasswordScreen } from '../authentication/ForgotPasswordScreen';

const Stack = createNativeStackNavigator();

export const RootNavigator = () => {
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 2000);

        return () => clearTimeout(timer);
    }, []);

    if (isLoading) {
        return <SplashScreen />;
    }

    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
                <Stack.Screen name="Onboarding" component={OnboardingIndustry} />
                <Stack.Screen name="Dashboard" component={TabNavigator} />
            </Stack.Navigator>
        </NavigationContainer>
    );
};
