import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeScreen } from '../HomeScreen';
import { ProfileScreen } from '../common/ProfileScreen';
import { Text } from 'react-native';

const Tab = createBottomTabNavigator();

export const TabNavigator = () => {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarIcon: ({ focused }) => {
                    let icon = '';
                    if (route.name === 'Home') icon = '🏠';
                    if (route.name === 'Profile') icon = '👤';

                    return <Text style={{ fontSize: 24, opacity: focused ? 1 : 0.5 }}>{icon}</Text>;
                },
                tabBarActiveTintColor: '#2563EB',
                tabBarInactiveTintColor: 'gray',
            })}
        >
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen name="Profile" component={ProfileScreen} />
        </Tab.Navigator>
    );
};
