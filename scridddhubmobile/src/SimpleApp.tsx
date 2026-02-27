
import React from 'react';
import { View, Text, SafeAreaView, StyleSheet } from 'react-native';

const SimpleApp = () => {
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.box}>
                <Text style={styles.text}>DEBUG MODE</Text>
                <Text style={styles.text}>If you see this, React Native is WORKING.</Text>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FF0000', // RED BACKGROUND
        justifyContent: 'center',
        alignItems: 'center',
    },
    box: {
        padding: 20,
        backgroundColor: 'white',
        borderRadius: 10,
    },
    text: {
        fontSize: 20,
        fontWeight: 'bold',
        color: 'black',
        textAlign: 'center',
    }
});

export default SimpleApp;
