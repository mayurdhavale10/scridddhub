import React, { useState, useEffect } from "react";
import {
    View, Text, StyleSheet, TouchableOpacity, TextInput,
    Alert, ScrollView, ActivityIndicator, Switch, StatusBar
} from "react-native";
import OperatorLayout from "../../dashboard/OperatorLayout";
import { submitQualityControl, getWeighFieldTemplates } from "../../../../../../../shared/inventory/api";
import { WeighFieldTemplate } from "../../../../../../../shared/inventory/types";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

const APP_GREEN = '#1B6B2F';
const APP_GREEN_LIGHT = '#E8F5E9';

export default function QCInspectionScreen({ route, navigation }: any) {
    const { batchId, logData } = route.params;

    // Core State
    const [loading, setLoading] = useState(false);
    const [notes, setNotes] = useState("");

    // V2 QC State
    const [rejectedWeight, setRejectedWeight] = useState("");

    // V3 Dynamic QC State
    const [fields, setFields] = useState<WeighFieldTemplate[]>([]);
    const [loadingFields, setLoadingFields] = useState(true);
    const [responses, setResponses] = useState<Record<string, any>>({});

    // Calculations
    const netWeight = logData.net_weight || 0;
    const currentRejected = Number(rejectedWeight) || 0;
    const acceptedWeight = Math.max(0, netWeight - currentRejected);

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        setLoadingFields(true);
        try {
            const res = await getWeighFieldTemplates("TENANT-001", logData.material_id);
            const templates = res.data || res || [];
            if (Array.isArray(templates)) {
                setFields(templates);
                const initial: any = {};
                templates.forEach((t: any) => {
                    if (t.field_type === 'boolean') initial[t.label] = false;
                    else initial[t.label] = "";
                });
                setResponses(initial);
            }
        } catch (e) {
            console.error("Failed to load QC templates", e);
        } finally {
            setLoadingFields(false);
        }
    };

    const handleAction = async (status: string) => {
        if (status === 'reject' && !notes.trim()) {
            Alert.alert("Note Required", "Please explain why this batch is being rejected.");
            return;
        }

        if (status === 'pass' && acceptedWeight <= 0) {
            Alert.alert("Weight Error", "Accepted weight must be greater than zero.");
            return;
        }

        if (currentRejected > netWeight) {
            Alert.alert("Weight Error", "Rejected weight cannot exceed total net weight.");
            return;
        }

        const missing = fields.filter(f => f.required && !responses[f.label]);
        if (status === 'pass' && missing.length > 0) {
            Alert.alert("Incomplete Form", `Please fill required fields: ${missing.map(f => f.label).join(', ')}`);
            return;
        }

        setLoading(true);
        try {
            await submitQualityControl("TENANT-001", batchId, {
                status,
                notes: notes,
                checkedBy: "QC-LEAD-01",
                acceptedWeight: status === 'pass' ? acceptedWeight : 0,
                rejectedWeight: status === 'pass' ? currentRejected : netWeight,
                qcData: responses
            });
            Alert.alert("QC Completed", `The batch has been marked as ${status.toUpperCase()} and inventory has been updated.`, [
                { text: "Done", onPress: () => navigation.goBack() }
            ]);
        } catch (e: any) {
            Alert.alert("Save Failed", e.message || "Could not save QC report.");
        } finally {
            setLoading(false);
        }
    };

    const updateResponse = (label: string, value: any) => {
        setResponses(prev => ({ ...prev, [label]: value }));
    };

    return (
        <OperatorLayout title="Quality Inspection" navigation={navigation} showBack={true}>
            <StatusBar barStyle="dark-content" />
            <ScrollView style={styles.root} contentContainerStyle={styles.scrollContent}>

                {/* --- Material Summary Header --- */}
                <View style={styles.heroCard}>
                    <View style={styles.heroRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.batchLabel}>BATCH {batchId}</Text>
                            <Text style={styles.materialName}>{logData.material_id}</Text>
                            <View style={styles.metadataRow}>
                                <Icon name="account-tie-outline" size={14} color="#6B7280" />
                                <Text style={styles.metadataText}>{logData.supplier_id || 'Retail Purchase'}</Text>
                            </View>
                        </View>
                        <View style={styles.totalWeightBox}>
                            <Text style={styles.totalWeightLabel}>INTAKE WEIGHT</Text>
                            <Text style={styles.totalWeightValue}>{netWeight.toLocaleString()} <Text style={{ fontSize: 14 }}>kg</Text></Text>
                        </View>
                    </View>
                </View>

                {/* --- Weight Adjudication Section --- */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Icon name="scale-balance" size={20} color={APP_GREEN} />
                        <Text style={styles.sectionTitle}>Manual Adjustments (Loss/Reject)</Text>
                    </View>
                    <View style={styles.splitRow}>
                        <View style={styles.inputStack}>
                            <Text style={styles.inputLabel}>REJECTED WEIGHT (KG)</Text>
                            <TextInput
                                style={styles.mainInput}
                                placeholder="0"
                                keyboardType="numeric"
                                value={rejectedWeight}
                                onChangeText={setRejectedWeight}
                                placeholderTextColor="#9CA3AF"
                            />
                            <Text style={styles.inputTip}>Moisture, dust, or wrong grade</Text>
                        </View>
                        <View style={styles.resultStack}>
                            <Text style={styles.inputLabel}>FINAL ACCEPTED</Text>
                            <View style={styles.acceptedDisplay}>
                                <Text style={styles.acceptedValue}>{acceptedWeight.toLocaleString()}</Text>
                                <Text style={styles.acceptedUnit}>KG</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* --- Dynamic Checklist --- */}
                <View style={[styles.section, { borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 20 }]}>
                    <View style={styles.sectionHeader}>
                        <Icon name="checkbox-multiple-marked-outline" size={20} color={APP_GREEN} />
                        <Text style={styles.sectionTitle}>Grade Specific Checklist</Text>
                    </View>

                    {loadingFields ? (
                        <ActivityIndicator color={APP_GREEN} style={{ marginVertical: 20 }} />
                    ) : (
                        fields.length === 0 ? (
                            <View style={styles.emptyChecklist}>
                                <Text style={styles.emptyText}>Standard Quality Pass Applies</Text>
                                <Text style={styles.emptySub}>No specific dynamic parameters for this grade.</Text>
                            </View>
                        ) : (
                            fields.map((field, idx) => (
                                <View key={idx} style={styles.fieldRow}>
                                    <View style={{ flex: 1, marginRight: 12 }}>
                                        <Text style={styles.fieldLabel}>
                                            {field.label} {field.required && <Text style={{ color: '#EF4444' }}>*</Text>}
                                        </Text>
                                        <Text style={styles.fieldSub}>{field.field_type === 'boolean' ? 'Visual verification' : 'Measurement required'}</Text>
                                    </View>

                                    {field.field_type === 'boolean' ? (
                                        <Switch
                                            value={!!responses[field.label]}
                                            onValueChange={(val) => updateResponse(field.label, val)}
                                            trackColor={{ false: '#D1D5DB', true: APP_GREEN_LIGHT }}
                                            thumbColor={responses[field.label] ? APP_GREEN : '#F3F4F6'}
                                        />
                                    ) : (
                                        <TextInput
                                            style={styles.fieldInput}
                                            placeholder={field.field_type === 'number' ? "0.0" : "Notes"}
                                            keyboardType={field.field_type === 'number' ? "numeric" : "default"}
                                            value={responses[field.label]}
                                            onChangeText={(val) => updateResponse(field.label, val)}
                                        />
                                    )}
                                </View>
                            ))
                        )
                    )}
                </View>

                {/* --- Remarks Section --- */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Icon name="comment-text-outline" size={20} color={APP_GREEN} />
                        <Text style={styles.sectionTitle}>Inspector Remarks</Text>
                    </View>
                    <TextInput
                        style={styles.remarksInput}
                        placeholder="Detail any visual defects, contamination levels, or reasons for rejection..."
                        multiline
                        numberOfLines={4}
                        value={notes}
                        onChangeText={setNotes}
                        placeholderTextColor="#9CA3AF"
                    />
                </View>

                <View style={{ height: 120 }} />
            </ScrollView>

            {/* --- Action Bar --- */}
            <View style={styles.actionBar}>
                <TouchableOpacity
                    style={[styles.actionBtn, styles.rejectBtn, loading && { opacity: 0.5 }]}
                    onPress={() => handleAction('reject')}
                    disabled={loading}
                >
                    <Icon name="close-circle-outline" size={20} color="#FFF" />
                    <Text style={styles.actionBtnText}>REJECT ALL</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionBtn, styles.approveBtn, loading && { opacity: 0.5 }]}
                    onPress={() => handleAction('pass')}
                    disabled={loading}
                >
                    {loading ? <ActivityIndicator color="#FFF" /> : (
                        <>
                            <Icon name="check-decagram-outline" size={20} color="#FFF" />
                            <Text style={styles.actionBtnText}>APPROVE</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </OperatorLayout>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F9FAFB' },
    scrollContent: { padding: 16 },

    heroCard: {
        backgroundColor: '#FFF', borderRadius: 24, padding: 20, marginBottom: 24,
        borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2
    },
    heroRow: { flexDirection: 'row', alignItems: 'center' },
    batchLabel: { fontSize: 10, fontWeight: '900', color: '#9CA3AF', marginBottom: 4, letterSpacing: 1 },
    materialName: { fontSize: 24, fontWeight: '900', color: '#111827', marginBottom: 6 },
    metadataRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    metadataText: { fontSize: 13, color: '#6B7280', fontWeight: '600' },

    totalWeightBox: { alignItems: 'flex-end', backgroundColor: APP_GREEN_LIGHT, padding: 12, borderRadius: 16 },
    totalWeightLabel: { fontSize: 9, fontWeight: '900', color: APP_GREEN, marginBottom: 2 },
    totalWeightValue: { fontSize: 22, fontWeight: '900', color: APP_GREEN },

    section: { marginBottom: 32 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
    sectionTitle: { fontSize: 14, fontWeight: '900', color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 },

    splitRow: { flexDirection: 'row', gap: 16 },
    inputStack: { flex: 1.2 },
    resultStack: { flex: 1 },
    inputLabel: { fontSize: 10, fontWeight: '800', color: '#9CA3AF', marginBottom: 8 },
    mainInput: {
        backgroundColor: '#FFF', borderWidth: 2, borderColor: '#E5E7EB', borderRadius: 16,
        padding: 14, fontSize: 18, fontWeight: '800', color: '#111827'
    },
    inputTip: { fontSize: 10, color: '#9CA3AF', marginTop: 6, fontStyle: 'italic' },

    acceptedDisplay: {
        backgroundColor: '#FFF', borderWidth: 2, borderColor: APP_GREEN, borderRadius: 16,
        padding: 14, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center'
    },
    acceptedValue: { fontSize: 22, fontWeight: '900', color: APP_GREEN },
    acceptedUnit: { fontSize: 12, fontWeight: '800', color: APP_GREEN, marginLeft: 4 },

    fieldRow: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF',
        padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB'
    },
    fieldLabel: { fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 2 },
    fieldSub: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
    fieldInput: {
        width: 100, backgroundColor: '#F3F4F6', borderRadius: 10, padding: 10,
        fontSize: 14, fontWeight: '700', textAlign: 'right', borderBottomWidth: 2, borderBottomColor: APP_GREEN
    },

    emptyChecklist: { padding: 20, alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 16 },
    emptyText: { fontSize: 14, fontWeight: '800', color: '#6B7280' },
    emptySub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },

    remarksInput: {
        backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 16,
        padding: 16, fontSize: 15, color: '#111827', textAlignVertical: 'top'
    },

    actionBar: {
        position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20,
        backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E5E7EB',
        flexDirection: 'row', gap: 16, paddingBottom: 34
    },
    actionBtn: {
        flex: 1, height: 56, borderRadius: 18, flexDirection: 'row',
        alignItems: 'center', justifyContent: 'center', gap: 10, elevation: 4
    },
    rejectBtn: { backgroundColor: '#EF4444' },
    approveBtn: { backgroundColor: APP_GREEN },
    actionBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 }
});
