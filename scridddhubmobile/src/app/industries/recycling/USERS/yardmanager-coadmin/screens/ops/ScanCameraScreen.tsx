import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const ScanCameraScreen = ({ navigation }: any) => {

    // States: 'scanning' | 'processing' | 'success'
    const [status, setStatus] = useState('scanning');
    const [scannedData, setScannedData] = useState<any>(null);

    // Simulate "Camera" Scan
    const simulateScan = () => {
        setStatus('processing');
        setTimeout(() => {
            setScannedData({
                code: "PET-BALE-X92",
                item: "PET Clear Bales (Grade A)",
                supplier: "Green City Collections",
                weight: 450
            });
            setStatus('success');
        }, 1500); // 1.5s delay to feel real
    };

    const handleConfirm = () => {
        // Here we would dispatch the 'receive' action to the backend
        navigation.goBack();
        Alert.alert(`Successfully Received: ${scannedData?.code}`);
    };

    const handleCancel = () => {
        setStatus('scanning');
        setScannedData(null);
    };

    return (
        <View style={styles.container}>

            {/* Camera Viewfinder Simulation */}
            {status === 'scanning' || status === 'processing' ? (
                <View style={styles.cameraView}>
                    <View style={styles.overlayTop} />
                    <View style={styles.overlayMiddle}>
                        <View style={styles.overlaySide} />
                        <View style={styles.scanWindow}>
                            <View style={styles.cornerTL} />
                            <View style={styles.cornerTR} />
                            <View style={styles.cornerBL} />
                            <View style={styles.cornerBR} />

                            {status === 'processing' && (
                                <View style={styles.scanLine} />
                            )}
                        </View>
                        <View style={styles.overlaySide} />
                    </View>
                    <View style={styles.overlayBottom}>
                        <Text style={styles.hintText}>Align QR Code / Barcode within frame</Text>

                        {/* Simulation Trigger */}
                        <TouchableOpacity style={styles.simBtn} onPress={simulateScan}>
                            <Text style={styles.simBtnText}>[ TAP TO SIMULATE SCAN ]</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
                            <Text style={styles.closeText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            ) : (

                /* Success Result Card */
                <SafeAreaView style={styles.resultContainer}>
                    <View style={styles.resultCard}>
                        <View style={styles.successIconCircle}>
                            <Text style={{ fontSize: 40 }}>✅</Text>
                        </View>

                        <Text style={styles.resultTitle}>Item Detected</Text>
                        <Text style={styles.resultCode}>{scannedData?.code}</Text>

                        <View style={styles.detailRow}>
                            <Text style={styles.label}>Item:</Text>
                            <Text style={styles.value}>{scannedData?.item}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.label}>Est. Weight:</Text>
                            <Text style={styles.value}>{scannedData?.weight} kg</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.label}>Supplier:</Text>
                            <Text style={styles.value}>{scannedData?.supplier}</Text>
                        </View>

                        <View style={styles.actionRow}>
                            <TouchableOpacity style={styles.secondaryBtn} onPress={handleCancel}>
                                <Text style={styles.secondaryText}>Rescan</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.primaryBtn} onPress={handleConfirm}>
                                <Text style={styles.primaryText}>Confirm & Add</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </SafeAreaView>
            )}
        </View>
    );
};

const { width } = Dimensions.get('window');
const WINDOW_SIZE = width * 0.7;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },

    // Camera Viewfinder
    cameraView: { flex: 1 },
    overlayTop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
    overlayBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', paddingTop: 30 },
    overlayMiddle: { flexDirection: 'row', height: WINDOW_SIZE },
    overlaySide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
    scanWindow: { width: WINDOW_SIZE, height: WINDOW_SIZE, borderColor: 'transparent', position: 'relative' },

    // Corners
    cornerTL: { position: 'absolute', top: 0, left: 0, width: 30, height: 30, borderTopWidth: 4, borderLeftWidth: 4, borderColor: '#00E676' },
    cornerTR: { position: 'absolute', top: 0, right: 0, width: 30, height: 30, borderTopWidth: 4, borderRightWidth: 4, borderColor: '#00E676' },
    cornerBL: { position: 'absolute', bottom: 0, left: 0, width: 30, height: 30, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: '#00E676' },
    cornerBR: { position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderBottomWidth: 4, borderRightWidth: 4, borderColor: '#00E676' },

    scanLine: { width: '100%', height: 2, backgroundColor: '#FF5252', position: 'absolute', top: '50%' },

    hintText: { color: '#FFF', fontSize: 16, marginBottom: 40 },
    simBtn: { padding: 15, borderWidth: 1, borderColor: '#aaa', borderRadius: 8, marginBottom: 20 },
    simBtnText: { color: '#aaa', letterSpacing: 1 },
    closeBtn: { padding: 10 },
    closeText: { color: '#FFF', fontWeight: 'bold' },

    // Result
    resultContainer: { flex: 1, backgroundColor: '#121212', justifyContent: 'center', padding: 20 },
    resultCard: { backgroundColor: '#1E1E1E', padding: 30, borderRadius: 20, alignItems: 'center' },
    successIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(0, 230, 118, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    resultTitle: { color: '#00E676', fontSize: 24, fontWeight: 'bold', marginBottom: 5 },
    resultCode: { color: '#888', fontSize: 16, marginBottom: 30, letterSpacing: 1 },

    detailRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#333', paddingBottom: 15 },
    label: { color: '#888', fontSize: 16 },
    value: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },

    actionRow: { flexDirection: 'row', marginTop: 20, width: '100%', justifyContent: 'space-between' },
    secondaryBtn: { padding: 15, flex: 0.45, alignItems: 'center', borderWidth: 1, borderColor: '#555', borderRadius: 12 },
    secondaryText: { color: '#ccc', fontWeight: 'bold' },
    primaryBtn: { padding: 15, flex: 0.45, alignItems: 'center', backgroundColor: '#00E676', borderRadius: 12 },
    primaryText: { color: '#000', fontWeight: 'bold' },
});
