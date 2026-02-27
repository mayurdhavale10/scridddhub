import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Alert,
    ActivityIndicator,
    Vibration,
    Linking
} from "react-native";
import OperatorLayout from "../../../dashboard/OperatorLayout";
import { createWeighEntry, getWeighEntries, deleteWeighEntry, getWeighFieldTemplates } from "../../../../../../../../shared/inventory/api";

// Hardcoded for Emulator Testing
const API_BASE = "http://10.0.2.2:3000";

export default function WeighScreen({ route, navigation }: any) {
    console.log("Rendering WeighScreen"); // Debug log to force bundle update
    const params = route.params || {};
    const { materialId = "UNKNOWN", supplierId = "UNKNOWN", supplierContact = "", unit = "kg", initialCustomValues = {} } = params;

    // --- HOOKS (Must be unconditional) ---
    const [weight, setWeight] = useState("");
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<"weigh" | "history">("weigh");
    const [recentLogs, setRecentLogs] = useState<any[]>([]);
    const [bypassSetup, setBypassSetup] = useState(false);

    // Dynamic Fields State
    const [customFields, setCustomFields] = useState<any[]>([]);
    const [customValues, setCustomValues] = useState<Record<string, any>>({});

    // Filters
    const [showFilter, setShowFilter] = useState(false);
    const [filterMaterial, setFilterMaterial] = useState("");
    const [filterSupplier, setFilterSupplier] = useState("");
    const [filterPhone, setFilterPhone] = useState("");
    const [filterCustomValues, setFilterCustomValues] = useState<Record<string, string>>({});
    const [availableCustomFields, setAvailableCustomFields] = useState<string[]>([]);

    const fetchHistory = async () => {
        try {
            const res = await getWeighEntries("TENANT-001");
            if (res.success && Array.isArray(res.data)) {
                setRecentLogs(res.data);

                // Extract all unique custom keys from logs
                const fieldSet = new Set<string>();
                res.data.forEach((log: any) => {
                    if (log.custom_values) {
                        Object.keys(log.custom_values).forEach(k => fieldSet.add(k));
                    }
                });
                setAvailableCustomFields(Array.from(fieldSet));
            }
        } catch (e) {
            console.error("Failed to fetch history", e);
        } finally {
            setLoading(false);
        }
    };

    const fetchTemplates = async () => {
        if (!materialId || materialId === "UNKNOWN") return;
        try {
            const res = await getWeighFieldTemplates("TENANT-001", materialId);
            if (res.success) {
                setCustomFields(res.data);
                // Initialize with passed values, or reset if none
                setCustomValues(initialCustomValues || {});
            }
        } catch (e) {
            console.error("Failed to fetch templates", e);
        }
    };

    React.useEffect(() => {
        fetchHistory();
        fetchTemplates();
    }, [viewMode, materialId]);

    React.useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            fetchHistory();
            if (viewMode === 'weigh') fetchTemplates();
        });
        return unsubscribe;
    }, [navigation]);

    // --- LOGIC ---
    const capture = async () => {
        const numeric = Number(weight);
        if (!numeric) return Alert.alert("Enter valid weight");

        // Validate Required Custom Fields
        for (const field of customFields) {
            if (field.required && !customValues[field.field_id]) {
                return Alert.alert("Missing Field", `Please enter ${field.label}`);
            }
        }

        const normalized = unit === "ton" ? numeric * 1000 : numeric;

        // Map IDs to Labels for history display AND Convert Types
        const payloadCustomValues: Record<string, any> = {};
        Object.keys(customValues).forEach(key => {
            const field = customFields.find(f => f.field_id === key);
            // Check if subfield inside a group
            let targetField = field;
            if (!targetField) {
                // Search in groups
                customFields.forEach(f => {
                    if (f.type === 'group' && f.sub_fields) {
                        const sub = f.sub_fields.find((s: any) => s.field_id === key);
                        if (sub) targetField = sub;
                    }
                });
            }

            const label = targetField ? targetField.label : key;
            let value = customValues[key];

            // Convert to Number if field type is number
            if (targetField?.type === 'number') {
                const asNum = Number(value);
                if (!isNaN(asNum)) value = asNum;
            }

            payloadCustomValues[label] = value;
        });

        setLoading(true);
        try {
            const res = await createWeighEntry(
                {
                    materialId,
                    supplierId,
                    supplierContact,
                    yardId: "YARD-001",
                    employeeId: "EMP-001",
                    grossWeight: normalized,
                    tareWeight: 0,
                    weighMethod: "manual",
                    intakeType: "purchase",
                    customValues: payloadCustomValues
                },
                "TENANT-001"
            );
            Vibration.vibrate(100);
            Alert.alert(
                "Batch Created Successfully",
                `Batch ID: ${res.data.weighEntry.batch_id}\n` +
                `Net Weight: ${res.data.weighEntry.net_weight} ${unit}`,
                [{
                    text: "OK", onPress: () => {
                        navigation.navigate("DashboardHome");
                    }
                }]
            );
        } catch (error: any) {
            Alert.alert("Submission Failed", error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = (batchId: string) => {
        Alert.alert(
            "Confirm Delete",
            "Are you sure?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete", style: "destructive", onPress: async () => {
                        try {
                            await deleteWeighEntry("TENANT-001", batchId);
                            fetchHistory();
                        } catch (e) {
                            Alert.alert("Error", "Failed to delete");
                        }
                    }
                }
            ]
        );
    };

    const handleCall = (supplierId: string, contactNumber?: string) => {
        const number = contactNumber || "555-0000";
        Alert.alert(
            `Contact ${supplierId}`,
            `Call ${number}?`,
            [
                { text: "Cancel", style: "cancel" },
                { text: "Call", onPress: () => Linking.openURL(`tel:${number}`) }
            ]
        );
    };

    const updateCustomField = (fieldId: string, value: any) => {
        setCustomValues(prev => ({
            ...prev,
            [fieldId]: value
        }));
    };

    const clearCustomField = (fieldId: string) => {
        setCustomValues(prev => {
            const copy = { ...prev };
            delete copy[fieldId];
            return copy;
        });
    };

    const filteredLogs = recentLogs.filter(log => {
        if (filterMaterial && !log.material_id.toLowerCase().includes(filterMaterial.toLowerCase())) return false;
        if (filterSupplier && !log.supplier_id.toLowerCase().includes(filterSupplier.toLowerCase())) return false;
        if (filterPhone && (!log.supplier_contact || !log.supplier_contact.includes(filterPhone))) return false;

        // Dynamic Custom Field Filters
        for (const field of availableCustomFields) {
            const filterVal = filterCustomValues[field];
            if (filterVal) {
                const logVal = log.custom_values?.[field];
                if (!logVal || !String(logVal).toLowerCase().includes(filterVal.toLowerCase())) {
                    return false;
                }
            }
        }

        return true;
    });

    const isLandingMode = !params.materialId && !bypassSetup;

    // --- RENDER ---
    return (
        <OperatorLayout title={isLandingMode ? "Inventory Dashboard" : "Weigh Material"} navigation={navigation}>
            {isLandingMode ? (
                // --- LANDING MODE CONTENT ---
                <View style={[styles.container, { gap: 20 }]}>
                    <Text style={{ fontSize: 20, fontWeight: '700', color: '#111', marginBottom: 5 }}>Choose Action</Text>

                    {/* Card 1: Setup */}
                    <TouchableOpacity
                        style={styles.landingCard}
                        onPress={() => navigation.navigate('WeighSetupScreen')}
                    >
                        <View style={styles.cardIconBox}>
                            <Text style={{ fontSize: 24 }}>⚙️</Text>
                        </View>
                        <View>
                            <Text style={styles.landingCardTitle}>New Weigh-in</Text>
                            <Text style={styles.landingCardSubtitle}>Select Material & Supplier first</Text>
                        </View>
                    </TouchableOpacity>

                    {/* Card 2: Dashboard */}
                    <TouchableOpacity
                        style={[styles.landingCard, { backgroundColor: '#2563EB', borderColor: '#2563EB' }]}
                        onPress={() => {
                            setViewMode('history'); // Default to history if bypassing
                            setBypassSetup(true);
                        }}
                    >
                        <View style={[styles.cardIconBox, { backgroundColor: '#60A5FA' }]} >
                            <Text style={{ fontSize: 24 }}>📊</Text>
                        </View>
                        <View>
                            <Text style={[styles.landingCardTitle, { color: '#FFF' }]}>Dashboard / History</Text>
                            <Text style={[styles.landingCardSubtitle, { color: '#E0E7FF' }]}>View logs & quick stats</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            ) : (
                // --- MAIN APP CONTENT ---
                <View style={styles.container}>
                    {/* Toggle */}
                    <View style={styles.toggleRow}>
                        <TouchableOpacity
                            style={[styles.toggleBtn, viewMode === "weigh" && styles.toggleBtnActive]}
                            onPress={() => setViewMode("weigh")}
                        >
                            <Text style={[styles.toggleText, viewMode === "weigh" && styles.toggleTextActive]}>Weigh</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.toggleBtn, viewMode === "history" && styles.toggleBtnActive]}
                            onPress={() => setViewMode("history")}
                        >
                            <Text style={[styles.toggleText, viewMode === "history" && styles.toggleTextActive]}>History</Text>
                        </TouchableOpacity>
                    </View>

                    {viewMode === "weigh" ? (
                        <>
                            <View style={styles.context}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.contextLabel}>Material</Text>
                                        <Text style={styles.contextValue}>{params.materialName || "Unknown Material"}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => navigation.navigate('WeighSetupScreen')} style={{ padding: 5 }}>
                                        <Text style={{ color: '#2563EB', fontWeight: '600', fontSize: 13 }}>CHANGE</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.divider} />

                                <Text style={styles.contextLabel}>Supplier</Text>
                                <Text style={styles.contextValue}>{params.supplierName || "Unknown Supplier"}</Text>
                            </View>

                            <TextInput
                                placeholder={`Enter Weight (${unit})`}
                                keyboardType="numeric"
                                value={weight}
                                onChangeText={setWeight}
                                style={styles.input}
                            />

                            {/* DYNAMIC FIELDS SECTION */}
                            {customFields.length > 0 && (
                                <View style={{ marginBottom: 20 }}>
                                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 10 }}>Additional Details</Text>

                                    {customFields.map((field) => {
                                        if (field.type === 'group' && field.sub_fields) {
                                            return (
                                                <View key={field.field_id} style={{ marginBottom: 15, padding: 12, backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' }}>
                                                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#111', marginBottom: 10, textTransform: 'uppercase' }}>{field.label}</Text>

                                                    {field.sub_fields.map((sub: any) => (
                                                        <View key={sub.field_id} style={{ marginBottom: 10 }}>
                                                            <Text style={{ fontSize: 12, fontWeight: '600', color: '#4B5563', marginBottom: 5 }}>
                                                                {sub.label} {sub.required && <Text style={{ color: 'red' }}>*</Text>}
                                                            </Text>
                                                            <TextInput
                                                                placeholder={sub.type === 'number' ? "0" : "Type here..."}
                                                                keyboardType={sub.type === 'number' ? 'numeric' : 'default'}
                                                                value={customValues[sub.field_id]?.toString() || ""}
                                                                onChangeText={(txt) => updateCustomField(sub.field_id, txt)}
                                                                style={styles.smallInput}
                                                            />
                                                        </View>
                                                    ))}
                                                </View>
                                            );
                                        }

                                        return (
                                            <View key={field.field_id} style={{ marginBottom: 12 }}>
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#4B5563', marginBottom: 5 }}>
                                                        {field.label} {field.required && <Text style={{ color: 'red' }}>*</Text>}
                                                    </Text>
                                                    {customValues[field.field_id] && (
                                                        <TouchableOpacity onPress={() => clearCustomField(field.field_id)}>
                                                            <Text style={{ fontSize: 11, color: '#EF4444', fontWeight: '600' }}>Clear</Text>
                                                        </TouchableOpacity>
                                                    )}
                                                </View>

                                                {field.type === 'boolean' ? (
                                                    <View style={{ flexDirection: 'row', gap: 10 }}>
                                                        <TouchableOpacity
                                                            style={[styles.choiceBtn, customValues[field.field_id] === true && styles.choiceBtnActive]}
                                                            onPress={() => updateCustomField(field.field_id, true)}
                                                        >
                                                            <Text style={[styles.choiceText, customValues[field.field_id] === true && styles.choiceTextActive]}>Yes</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            style={[styles.choiceBtn, customValues[field.field_id] === false && styles.choiceBtnActive]}
                                                            onPress={() => updateCustomField(field.field_id, false)}
                                                        >
                                                            <Text style={[styles.choiceText, customValues[field.field_id] === false && styles.choiceTextActive]}>No</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                ) : field.type === 'dropdown' ? (
                                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                                        {field.options?.map((opt: string) => (
                                                            <TouchableOpacity
                                                                key={opt}
                                                                style={[
                                                                    styles.choiceBtn,
                                                                    { flex: 0, paddingHorizontal: 15 },
                                                                    customValues[field.field_id] === opt && styles.choiceBtnActive
                                                                ]}
                                                                onPress={() => updateCustomField(field.field_id, opt)}
                                                            >
                                                                <Text style={[styles.choiceText, customValues[field.field_id] === opt && styles.choiceTextActive]}>{opt}</Text>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </View>
                                                ) : (
                                                    <TextInput
                                                        placeholder={field.type === 'number' ? "0" : "Type here..."}
                                                        keyboardType={field.type === 'number' ? 'numeric' : 'default'}
                                                        value={customValues[field.field_id]?.toString() || ""}
                                                        onChangeText={(txt) => updateCustomField(field.field_id, txt)}
                                                        style={styles.smallInput}
                                                    />
                                                )}
                                            </View>
                                        );
                                    })}
                                </View>
                            )}

                            <TouchableOpacity style={styles.btn} onPress={capture}>
                                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>CAPTURE</Text>}
                            </TouchableOpacity>
                        </>
                    ) : (
                        <View>
                            {/* Actions Row */}
                            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                                <TouchableOpacity
                                    style={[styles.btn, { flex: 1, padding: 10, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#DDD' }]}
                                    onPress={() => setShowFilter(!showFilter)}
                                >
                                    <Text style={{ color: '#333', textAlign: 'center', fontWeight: 'bold' }}>🔍 Filter {showFilter ? '▲' : '▼'}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.btn, { flex: 1, padding: 10, backgroundColor: '#2563EB' }]}
                                    onPress={() => {
                                        const header = "Batch ID,Date,Material,Supplier,Net Weight (kg)\n";
                                        const rows = filteredLogs.map(l =>
                                            `${l.batch_id},${l.created_at},${l.material_id},${l.supplier_id},${l.net_weight}`
                                        ).join("\n");
                                        const csvArg = header + rows;
                                        const { Share } = require('react-native');
                                        Share.share({ message: csvArg, title: "Inventory_Report.csv" });
                                    }}
                                >
                                    <Text style={{ color: '#FFF', textAlign: 'center', fontWeight: 'bold' }}>📥 Excel</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.btn, { flex: 1, padding: 10, backgroundColor: '#4B5563' }]}
                                    onPress={() => navigation.navigate('DailyReportScreen')}
                                >
                                    <Text style={{ color: '#FFF', textAlign: 'center', fontWeight: 'bold' }}>📊 Report</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Filter Panel */}
                            {showFilter && (
                                <View style={{ backgroundColor: '#F9FAFB', padding: 15, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#E5E7EB' }}>
                                    <Text style={{ fontWeight: '700', marginBottom: 10, color: '#374151' }}>Search Criteria</Text>

                                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Material ID</Text>
                                            <TextInput style={{ backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 6, padding: 8 }} value={filterMaterial} onChangeText={setFilterMaterial} placeholder="e.g. MAT" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Supplier ID</Text>
                                            <TextInput style={{ backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 6, padding: 8 }} value={filterSupplier} onChangeText={setFilterSupplier} placeholder="e.g. SUP" />
                                        </View>
                                    </View>

                                    <View style={{ marginBottom: 10 }}>
                                        <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Phone Number</Text>
                                        <TextInput
                                            style={{ backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 6, padding: 8 }}
                                            value={filterPhone}
                                            onChangeText={setFilterPhone}
                                            keyboardType="phone-pad"
                                            placeholder="e.g. 12345"
                                        />
                                    </View>

                                    {/* DYNAMIC CUSTOM FIELD FILTERS */}
                                    {availableCustomFields.map(field => (
                                        <View key={field} style={{ marginBottom: 10 }}>
                                            <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>{field}</Text>
                                            <TextInput
                                                style={{ backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 6, padding: 8 }}
                                                value={filterCustomValues[field] || ""}
                                                onChangeText={(text) => setFilterCustomValues(prev => ({ ...prev, [field]: text }))}
                                                placeholder={`Filter by ${field}...`}
                                            />
                                        </View>
                                    ))}

                                    <TouchableOpacity onPress={() => { setFilterMaterial(""); setFilterSupplier(""); setFilterPhone(""); setFilterCustomValues({}); }}>
                                        <Text style={{ textAlign: 'center', color: '#EF4444', fontSize: 13, fontWeight: '600' }}>Clear Filters</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {filteredLogs.length === 0 ? (
                                <Text style={{ textAlign: 'center', color: '#999', marginTop: 20 }}>No matching records</Text>
                            ) : (
                                filteredLogs.map((log) => (
                                    <View key={log.batch_id} style={styles.logCard}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text style={styles.logMaterial}>{log.material_id}</Text>
                                            <Text style={styles.logWeight}>{log.net_weight} {unit}</Text>
                                        </View>

                                        {/* CUSTOM VALUES DISPLAY IN HISTORY */}
                                        {log.custom_values && Object.keys(log.custom_values).length > 0 && (
                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4, marginBottom: 4 }}>
                                                {Object.entries(log.custom_values).map(([key, val]) => (
                                                    <View key={key} style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#E0E7FF' }}>
                                                        <Text style={{ fontSize: 10, color: '#4338CA' }}>
                                                            <Text style={{ fontWeight: '600' }}>{key}:</Text> {String(val)}
                                                        </Text>
                                                    </View>
                                                ))}
                                            </View>
                                        )}

                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, justifyContent: 'space-between' }}>
                                            <View>
                                                <TouchableOpacity onPress={() => handleCall(log.supplier_id, log.supplier_contact)}>
                                                    <Text style={[styles.logSupplier, { color: '#2563EB', textDecorationLine: 'underline' }]}>
                                                        📞 {log.supplier_id}
                                                    </Text>
                                                </TouchableOpacity>
                                                <Text style={styles.logTime}>{new Date(log.created_at).toLocaleString()}</Text>
                                            </View>
                                            <TouchableOpacity onPress={() => handleDelete(log.batch_id)} style={{ backgroundColor: '#FEE2E2', padding: 8, borderRadius: 6 }}>
                                                <Text style={{ color: '#DC2626' }}>🗑️</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))
                            )}
                        </View>
                    )}
                </View>
            )}
        </OperatorLayout>
    );
}

const styles = StyleSheet.create({
    container: { padding: 20 },
    context: { backgroundColor: "#FFF", padding: 12, borderRadius: 10, marginBottom: 20, borderWidth: 1, borderColor: "#E5E7EB" },
    contextLabel: { fontSize: 12, color: "#6B7280", fontWeight: "600", textTransform: "uppercase" },
    contextValue: { fontSize: 16, color: "#111", fontWeight: "700", marginBottom: 5 },
    divider: { height: 1, backgroundColor: "#F3F4F6", marginVertical: 8 },
    input: { backgroundColor: "#FFF", padding: 18, borderRadius: 10, fontSize: 22, marginBottom: 20, borderWidth: 1, borderColor: "#E5E7EB" },
    btn: { backgroundColor: "#1D7A27", padding: 16, borderRadius: 12, alignItems: "center", shadowColor: "#1D7A27", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 3 },
    btnText: { color: "#FFF", fontWeight: "700", fontSize: 16 },
    toggleRow: { flexDirection: 'row', backgroundColor: '#E5E7EB', borderRadius: 8, padding: 2, marginBottom: 20 },
    toggleBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
    toggleBtnActive: { backgroundColor: '#FFF' },
    toggleText: { fontWeight: '600', color: '#6B7280' },
    toggleTextActive: { color: '#111' },
    logCard: { backgroundColor: '#FFF', padding: 12, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#EEE' },
    logMaterial: { fontWeight: '700', fontSize: 16, color: '#111' },
    logWeight: { fontWeight: '700', fontSize: 16, color: '#1D7A27' },
    logSupplier: { fontSize: 13, color: '#4B5563' },
    logTime: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
    logId: { fontSize: 10, color: '#9CA3AF', fontFamily: 'monospace' },
    landingCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 15, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
    cardIconBox: { width: 50, height: 50, backgroundColor: '#DCFCE7', borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
    landingCardTitle: { fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 4 },
    landingCardSubtitle: { fontSize: 13, color: '#6B7280' },
    // Dynamic Field Styles
    smallInput: { backgroundColor: "#FFF", padding: 12, borderRadius: 8, fontSize: 14, borderWidth: 1, borderColor: "#D1D5DB" },
    choiceBtn: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center', backgroundColor: '#FFF' },
    choiceBtnActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
    choiceText: { color: '#4B5563', fontWeight: '600' },
    choiceTextActive: { color: '#FFF' }
});
