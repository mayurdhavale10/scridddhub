import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import OperatorLayout from "../../../dashboard/OperatorLayout";
import { getInventorySettings, getWeighFieldTemplates } from "../../../../../../../../shared/inventory/api";

// In-Memory Storage for Linked Contacts (Session Persistence)
const CONTACT_CACHE: Record<string, string> = {};

export default function WeighSetupScreen({ navigation }: any) {
    const [loading, setLoading] = useState(true);

    // Settings State
    const [settings, setSettings] = useState<any>({ materials: [], suppliers: [], units: [], hidden_sections: [] });

    // Selection State
    const [selectedMatType, setSelectedMatType] = useState<string>("");
    const [customMaterial, setCustomMaterial] = useState("");

    const [supplier, setSupplier] = useState("");
    const [showSupplierInput, setShowSupplierInput] = useState(false);
    const [phone, setPhone] = useState("");
    const [isLinked, setIsLinked] = useState(false);

    const [unitType, setUnitType] = useState<string>("");
    const [customUnit, setCustomUnit] = useState("");

    // Custom Fields
    const [customFields, setCustomFields] = useState<any[]>([]);
    const [customValues, setCustomValues] = useState<Record<string, any>>({});

    // Load Settings
    useEffect(() => {
        const loadSettings = async () => {
            try {
                // Fetch Settings
                const res = await getInventorySettings("TENANT-001");

                // Fetch Global/All Scope Custom Fields immediately or when material changes?
                // Let's doing it here or in a separate effect.

                if (res.success && res.data) {
                    setSettings(res.data);

                    // Set Defaults if visible
                    if (res.data.materials?.length > 0 && !res.data.hidden_sections?.includes('materials')) {
                        setSelectedMatType(res.data.materials[0]);
                    }
                    if (res.data.units?.length > 0 && !res.data.hidden_sections?.includes('units')) {
                        setUnitType(res.data.units[0]);
                    }
                }
            } catch (e) {
                console.error("Failed to load settings", e);
            } finally {
                setLoading(false);
            }
        };
        loadSettings();
    }, []);

    // Helper: Check if a section is visible (not hidden)
    const isSectionVisible = (section: string) => !settings.hidden_sections?.includes(section);

    // Auto-fill phone logic
    useEffect(() => {
        if (supplier && CONTACT_CACHE[supplier]) {
            setPhone(CONTACT_CACHE[supplier]);
            setIsLinked(true);
        } else {
            setPhone("");
            setIsLinked(false);
        }
    }, [supplier]);

    // Fetch Custom Fields when Material Changes (or initially)
    useEffect(() => {
        const fetchTemplates = async () => {
            // We can fetch fields scoped to 'All' or specific material
            // If selectedMatType is "Other", we might just fetch 'All'
            const matId = selectedMatType === "Other" ? "All" : (selectedMatType || "All");

            try {
                const res = await getWeighFieldTemplates("TENANT-001", matId);
                if (res.success) {
                    setCustomFields(res.data);
                    setCustomValues({}); // Reset values on material change
                }
            } catch (e) {
                console.error("Failed to load fields", e);
            }
        };
        fetchTemplates();
    }, [selectedMatType]);

    const updateCustomField = (fieldId: string, value: any) => {
        setCustomValues(prev => ({ ...prev, [fieldId]: value }));
    };

    const proceed = () => {
        const finalMaterial = (selectedMatType === "Other" ? customMaterial : selectedMatType) || "General";
        const finalSupplier = supplier || "Unknown Supplier";
        const finalUnit = unitType === "other" || unitType === "Other" ? customUnit : unitType;

        if (isSectionVisible('materials') && selectedMatType === "Other" && !customMaterial.trim()) {
            Alert.alert("Error", "Please enter a custom material name");
            return;
        }
        if (isSectionVisible('units') && (unitType === "other" || unitType === "Other") && !customUnit.trim()) {
            Alert.alert("Error", "Please enter a custom unit");
            return;
        }

        navigation.navigate("WeighScreen", {
            materialId: finalMaterial,
            materialName: finalMaterial,
            supplierId: finalSupplier,
            supplierName: finalSupplier,
            supplierContact: phone,
            unit: finalUnit,
            initialCustomValues: customValues
        });
    };

    if (loading) {
        return (
            <OperatorLayout title="Weigh Setup" navigation={navigation}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#1D7A27" />
                    <Text>Loading configurations...</Text>
                </View>
            </OperatorLayout>
        );
    }

    return (
        <OperatorLayout title="New Weigh-In" navigation={navigation}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.container}>

                    {/* --- MATERIAL SECTION --- */}
                    {isSectionVisible('materials') && (
                        <View>
                            <Text style={styles.sectionLabel}>Material Type</Text>
                            <View style={styles.chipContainer}>
                                {(settings.materials || []).map((type: string) => (
                                    <TouchableOpacity
                                        key={type}
                                        style={[styles.chip, selectedMatType === type && styles.chipActive]}
                                        onPress={() => setSelectedMatType(type)}
                                    >
                                        <Text style={[styles.chipText, selectedMatType === type && styles.chipTextActive]}>{type}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {selectedMatType === "Other" && (
                                <View style={styles.inputBox}>
                                    <Text style={styles.inputLabel}>Enter Custom Material Name</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="e.g. Copper Wire"
                                        value={customMaterial}
                                        onChangeText={setCustomMaterial}
                                    />
                                </View>
                            )}
                            <View style={styles.divider} />
                        </View>
                    )}

                    {/* --- SUPPLIER SECTION --- */}
                    {isSectionVisible('suppliers') && (
                        <View>
                            <Text style={styles.sectionLabel}>Supplier</Text>
                            {!showSupplierInput ? (
                                <View>
                                    <View style={styles.chipContainer}>
                                        {(settings.suppliers || []).map((sup: string) => (
                                            <TouchableOpacity
                                                key={sup}
                                                style={[styles.chip, supplier === sup && styles.chipActive]}
                                                onPress={() => setSupplier(sup)}
                                            >
                                                <Text style={[styles.chipText, supplier === sup && styles.chipTextActive]}>{sup}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                    <TouchableOpacity style={styles.addBtn} onPress={() => { setShowSupplierInput(true); setSupplier(""); }}>
                                        <Icon name="plus" size={20} color="#1D7A27" />
                                        <Text style={styles.addBtnText}>+ Manual Entry</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View style={styles.inputBox}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={styles.inputLabel}>Supplier Name</Text>
                                        <TouchableOpacity onPress={() => setShowSupplierInput(false)}>
                                            <Text style={{ color: '#666', fontSize: 12 }}>Cancel</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="Enter Supplier Name"
                                        value={supplier}
                                        onChangeText={setSupplier}
                                        autoFocus
                                    />
                                </View>
                            )}

                            {/* Contact Number Logic */}
                            {supplier ? (
                                <View style={{ marginTop: 15, padding: 12, backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' }}>
                                    <Text style={styles.inputLabel}>Contact Number (Optional)</Text>
                                    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                                        <TextInput
                                            style={[styles.textInput, { flex: 1, borderBottomWidth: 1, paddingVertical: 8 }]}
                                            placeholder="Enter Phone Number"
                                            keyboardType="phone-pad"
                                            value={phone}
                                            onChangeText={(text) => {
                                                setPhone(text);
                                                if (CONTACT_CACHE[supplier] && text !== CONTACT_CACHE[supplier]) setIsLinked(false);
                                            }}
                                        />
                                        <TouchableOpacity
                                            style={[
                                                styles.chip,
                                                { marginBottom: 0, paddingVertical: 8, borderColor: isLinked ? '#1D7A27' : '#CCC', backgroundColor: isLinked ? '#DCFCE7' : '#F9FAFB' }
                                            ]}
                                            onPress={() => {
                                                if (isLinked) {
                                                    delete CONTACT_CACHE[supplier];
                                                    setIsLinked(false);
                                                    setPhone("");
                                                } else {
                                                    if (!phone.trim()) return Alert.alert("Enter a number to link");
                                                    CONTACT_CACHE[supplier] = phone;
                                                    setIsLinked(true);
                                                }
                                            }}
                                        >
                                            <Text style={{ color: isLinked ? '#1D7A27' : '#666', fontWeight: '700', fontSize: 13 }}>
                                                {isLinked ? "✅ Linked" : "🔗 Link"}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : null}

                            <View style={styles.divider} />
                        </View>
                    )}

                    {/* --- CUSTOM FIELDS SECTION (Rendered Dynamically) --- */}
                    {customFields.map((field) => (
                        <View key={field.field_id} style={{ marginBottom: 20 }}>
                            <Text style={styles.sectionLabel}>
                                {field.label} {field.required && <Text style={{ color: 'red' }}>*</Text>}
                            </Text>

                            {field.type === 'dropdown' ? (
                                <View style={styles.chipContainer}>
                                    {field.options?.map((opt: string) => (
                                        <TouchableOpacity
                                            key={opt}
                                            style={[styles.chip, customValues[field.field_id] === opt && styles.chipActive]}
                                            onPress={() => updateCustomField(field.field_id, opt)}
                                        >
                                            <Text style={[styles.chipText, customValues[field.field_id] === opt && styles.chipTextActive]}>{opt}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            ) : field.type === 'boolean' ? (
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <TouchableOpacity
                                        style={[styles.chip, customValues[field.field_id] === true && styles.chipActive]}
                                        onPress={() => updateCustomField(field.field_id, true)}
                                    >
                                        <Text style={[styles.chipText, customValues[field.field_id] === true && styles.chipTextActive]}>Yes</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.chip, customValues[field.field_id] === false && styles.chipActive]}
                                        onPress={() => updateCustomField(field.field_id, false)}
                                    >
                                        <Text style={[styles.chipText, customValues[field.field_id] === false && styles.chipTextActive]}>No</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View style={styles.inputBox}>
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder={`Enter ${field.label}`}
                                        keyboardType={field.type === 'number' ? 'numeric' : 'default'}
                                        value={customValues[field.field_id]?.toString() || ""}
                                        onChangeText={(txt) => updateCustomField(field.field_id, txt)}
                                    />
                                </View>
                            )}
                            <View style={styles.divider} />
                        </View>
                    ))}

                    {/* --- UNIT SECTION --- */}
                    {isSectionVisible('units') && (
                        <View>
                            <Text style={styles.sectionLabel}>Unit</Text>
                            <View style={styles.row}>
                                {(settings.units || []).map((unit: string) => (
                                    <UnitBtn
                                        key={unit}
                                        label={unit.toUpperCase()}
                                        active={unitType === unit}
                                        onPress={() => setUnitType(unit)}
                                    />
                                ))}
                            </View>

                            {(unitType === "other" || unitType === "Other") && (
                                <View style={styles.inputBox}>
                                    <Text style={styles.inputLabel}>Enter Unit (e.g. lbs, boxes)</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="Unit Name"
                                        value={customUnit}
                                        onChangeText={setCustomUnit}
                                    />
                                </View>
                            )}
                        </View>
                    )}

                    <TouchableOpacity style={styles.primaryBtn} onPress={proceed}>
                        <Text style={styles.primaryText}>CONTINUE</Text>
                        <Icon name="arrow-right" size={20} color="#FFF" style={{ marginLeft: 10 }} />
                    </TouchableOpacity>

                </ScrollView>
            </KeyboardAvoidingView>
        </OperatorLayout>
    );
}

// Sub-components
const UnitBtn = ({ label, active, onPress }: any) => (
    <TouchableOpacity
        onPress={onPress}
        style={[styles.unitBtn, active && styles.unitActive]}
    >
        <Text style={{ color: active ? "#FFF" : "#374151", fontWeight: "600" }}>{label}</Text>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    container: { padding: 20, paddingBottom: 50 },

    sectionLabel: { fontSize: 16, fontWeight: "700", color: "#111", marginBottom: 12 },

    chipContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
        marginBottom: 10,
    },
    chip: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: "#FFF",
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        marginBottom: 8,
    },
    chipActive: {
        backgroundColor: "#DCFCE7",
        borderColor: "#1D7A27",
    },
    chipText: { color: "#374151", fontWeight: "500" },
    chipTextActive: { color: "#15803D", fontWeight: "700" },

    addBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
        borderWidth: 1,
        borderColor: "#1D7A27",
        borderRadius: 10,
        borderStyle: 'dashed',
        marginBottom: 10,
    },
    addBtnText: { color: "#1D7A27", fontWeight: "600", marginLeft: 8 },

    inputBox: {
        backgroundColor: "#FFF",
        padding: 15,
        borderRadius: 12,
        marginTop: 5,
        borderWidth: 1,
        borderColor: "#E5E7EB",
    },
    inputLabel: { fontSize: 12, color: "#6B7280", marginBottom: 8, textTransform: "uppercase", fontWeight: "600" },
    textInput: {
        fontSize: 16,
        color: "#111",
        borderBottomWidth: 1,
        borderBottomColor: "#E5E7EB",
        paddingVertical: 5,
    },

    divider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 20 },

    row: { flexDirection: "row", gap: 10, marginBottom: 10 },
    unitBtn: {
        flex: 1,
        padding: 14,
        borderRadius: 10,
        backgroundColor: "#FFF",
        borderWidth: 1,
        borderColor: "#E5E7EB",
        alignItems: "center",
    },
    unitActive: {
        backgroundColor: "#1D7A27",
        borderColor: "#1D7A27",
    },

    primaryBtn: {
        backgroundColor: "#1D7A27",
        padding: 18,
        borderRadius: 14,
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "center",
        marginTop: 30,
        shadowColor: "#1D7A27",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryText: { color: "#FFF", fontWeight: "800", fontSize: 16 },
});
