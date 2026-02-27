import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { IndustryNavigator } from './IndustryNavigator';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

import { LoginScreen } from '../screens/authentication/LoginScreen';
import { ForgotPasswordScreen } from '../screens/authentication/ForgotPasswordScreen';

export type RootStackParamList = {
    Login: undefined;
    ForgotPassword: undefined;
    Onboarding: undefined;
    Main: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator = () => {
    const { isAuthenticated } = useSelector((state: RootState) => state.auth);
    const hasCompletedOnboarding = useSelector(
        (state: RootState) => state.tenant.industry !== null
    );

    const getInitialRoute = () => {
        if (!isAuthenticated) return 'Login';
        return hasCompletedOnboarding ? 'Main' : 'Onboarding';
    };

    return (
        <NavigationContainer>
            <Stack.Navigator
                screenOptions={{
                    headerShown: false,
                }}
                initialRouteName={getInitialRoute()}
            >
                {!isAuthenticated ? (
                    <>
                        <Stack.Screen name="Login" component={LoginScreen} />
                        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
                    </>
                ) : (
                    <>
                        <Stack.Screen
                            name="Onboarding"
                            component={IndustryNavigator}
                        />
                        <Stack.Screen
                            name="Main"
                            component={IndustryNavigator}
                        />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
};
