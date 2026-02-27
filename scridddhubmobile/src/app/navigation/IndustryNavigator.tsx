import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingIndustry } from '../screens/OnboardingIndustry';
import { RecyclingNavigator } from '../industries/recycling/navigation/RecyclingNavigator';
import { TabNavigator } from './TabNavigator';

export type IndustryStackParamList = {
    OnboardingIndustry: undefined;
    GeneralDashboard: undefined;
    RecyclingDashboard: undefined;
};

const Stack = createNativeStackNavigator<IndustryStackParamList>();

export const IndustryNavigator = () => {
    return (
        <Stack.Navigator
            screenOptions={{
                headerShown: false,
            }}
            initialRouteName="OnboardingIndustry"
        >
            <Stack.Screen
                name="OnboardingIndustry"
                component={OnboardingIndustry}
            />
            <Stack.Screen
                name="GeneralDashboard"
                component={TabNavigator}
            />
            <Stack.Screen
                name="RecyclingDashboard"
                component={RecyclingNavigator}
            />
        </Stack.Navigator>
    );
};