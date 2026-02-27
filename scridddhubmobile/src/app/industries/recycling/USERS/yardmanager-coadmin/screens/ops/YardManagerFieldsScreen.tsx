import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert,
    TextInput, ActivityIndicator, SafeAreaView, Modal, Switch, StatusBar, Platform
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {
    getInventorySettings, updateInventorySettings,
    getWeighFieldTemplates, createWeighFieldTemplate, deleteWeighFieldTemplate
} from '../../../../../../../shared/inventory/api';

const Icon = (props: any) => <MaterialCommunityIcons {...props} />;

export default function YardManagerFieldsScreen({ navigation }: any) {
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'dropdowns' | 'fields'>('dropdowns');

    // --- DROPDOWN SETTINGS STATE ---
    const [settings, setSettings] = useState<any>({
        materials: [], suppliers: [], units: [],
        hidden_sections: [],
        deleted_materials: [], deleted_suppliers: [], deleted_units: []
    });

    // --- CUSTOM FIELDS STATE ---
    const [fields, setFields] = useState<any[]>([]);
    const [modalVisible, setModalVisible] = useState(false);

    // Form State
    const [label, setLabel] = useState("");
    const [type, setType] = useState<'number' | 'text' | 'boolean' | 'dropdown'>('number');
    const [required, setRequired] = useState(false);
    const [materialScope, setMaterialScope] = useState<string[]>([]); // Array for multi-select
    const [dropdownOptions, setDropdownOptions] = useState(""); // Keeping for legacy/compatibility if needed, but not used in new UI

    // New List Builder State
    const [currentOptionInput, setCurrentOptionInput] = useState("");
    const [optionsList, setOptionsList] = useState<string[]>([]);

    // --- DROPDOWN LOCAL STATE ---
    const [addModalVisible, setAddModalVisible] = useState(false);
    const [newItem, setNewItem] = useState("");
    const [optionCategory, setOptionCategory] = useState<'materials' | 'suppliers' | 'units' | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [settingsRes, fieldsRes] = await Promise.all([
                getInventorySettings("TENANT-001"),
                getWeighFieldTemplates("TENANT-001") // Get all
            ]);

            if (settingsRes.success) setSettings(settingsRes.data);
            if (fieldsRes.success) setFields(fieldsRes.data);
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Failed to load settings");
        } finally {
            setLoading(false);
        }
    };

    // --- NEW FIELD OPTION HANDLERS (Form Builder) ---
    const handleAddOptionToField = () => {
        // Just add an empty placeholder for the user to type in
        setOptionsList([...optionsList, ""]);
    };

    const handleUpdateOption = (index: number, text: string) => {
        const newList = [...optionsList];
        newList[index] = text;
        setOptionsList(newList);
    };

    const handleRemoveOptionFromField = (index: number) => {
        const newList = [...optionsList];
        newList.splice(index, 1);
        setOptionsList(newList);
    };

    // --- DROPDOWN LOGIC ---
    const handleDeleteOption = async (category: 'materials' | 'suppliers' | 'units', item: string) => {
        Alert.alert("Confirm", `Delete "${item}"?`, [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                    const currentList = settings[category] || [];
                    const newList = currentList.filter((i: string) => i !== item);

                    // Add to deleted list for history
                    const deletedKey = `deleted_${category}`;
                    const currentDeleted = settings[deletedKey] || [];
                    const newDeleted = [item, ...currentDeleted]; // Add to top

                    const newSettings = {
                        ...settings,
                        [category]: newList,
                        [deletedKey]: newDeleted
                    };

                    try {
                        setSettings(newSettings);
                        await updateInventorySettings("TENANT-001", newSettings);
                    } catch (e: any) {
                        Alert.alert("Error", e.message);
                        loadData(); // Revert
                    }
                }
            }
        ]);
    };

    const handleRestoreOption = async (category: 'materials' | 'suppliers' | 'units', item: string) => {
        const deletedKey = `deleted_${category}`;
        const currentDeleted = settings[deletedKey] || [];
        const newDeleted = currentDeleted.filter((i: string) => i !== item);

        const currentList = settings[category] || [];
        const newList = [...currentList, item];

        const newSettings = {
            ...settings,
            [category]: newList,
            [deletedKey]: newDeleted
        };

        try {
            setSettings(newSettings);
            await updateInventorySettings("TENANT-001", newSettings);
        } catch (e: any) {
            Alert.alert("Error", e.message);
            loadData();
        }
    };

    const handleAddOption = async () => {
        if (!newItem.trim() || !optionCategory) return;

        const currentList = settings[optionCategory] || [];
        if (currentList.includes(newItem)) return Alert.alert("Error", "Item already exists");

        const newSettings = { ...settings, [optionCategory]: [...currentList, newItem] };

        try {
            setSettings(newSettings);
            await updateInventorySettings("TENANT-001", newSettings);
            setAddModalVisible(false);
            setNewItem("");
            setOptionCategory(null);
        } catch (e: any) {
            Alert.alert("Error", e.message);
        }
    };

    const handleDeleteSection = async (section: string) => {
        Alert.alert(
            "Delete Section",
            `Are you sure you want to remove the entire "${section}" section?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        const currentHidden = settings.hidden_sections || [];
                        const updatedHidden = [...currentHidden, section];
                        const newSettings = { ...settings, hidden_sections: updatedHidden };
                        try {
                            setSettings(newSettings);
                            await updateInventorySettings("TENANT-001", { hidden_sections: updatedHidden });
                        } catch (e: any) {
                            Alert.alert("Error", e.message);
                            loadData();
                        }
                    }
                }
            ]
        );
    };

    const handleRestoreSection = async (section: string) => {
        const currentHidden = settings.hidden_sections || [];
        const updatedHidden = currentHidden.filter((s: string) => s !== section);
        const newSettings = { ...settings, hidden_sections: updatedHidden };
        try {
            setSettings(newSettings);
            await updateInventorySettings("TENANT-001", { hidden_sections: updatedHidden });
        } catch (e: any) {
            Alert.alert("Error", e.message);
            loadData();
        }
    };

    // --- FIELDS LOGIC ---
    const handleDeleteField = async (fieldId: string) => {
        Alert.alert(
            "Delete Field",
            "Are you sure you want to delete this field? It will be removed for all operators.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteWeighFieldTemplate("TENANT-001", fieldId);
                            loadData(); // Reload list
                        } catch (e: any) {
                            Alert.alert("Error", "Failed to delete: " + e.message);
                        }
                    }
                }
            ]
        );
    };

    const handleCreateField = async () => {
        if (!label) return Alert.alert("Required", "Please enter Label");

        // SWITCH TO DROPDOWN LOGIC
        // optionsList contains strings "Name:::Type"
        // We will ignore Type for now, as these are dropdown options (strings).

        if (optionsList.length === 0) return Alert.alert("Required", "Please add at least one value");

        const options = optionsList.map(opt => {
            const [name] = opt.split(':::');
            return name.trim();
        });

        // Validate
        const invalid = options.find(opt => !opt);
        if (invalid) return Alert.alert("Required", "All values must have a name");

        const payload = {
            label, // The Field Title (e.g. "Color")
            type: 'dropdown', // Changed from 'group'
            required: false,
            material_scope: ['All'],
            options: options // distinct values
        };

        try {
            setLoading(true);
            await createWeighFieldTemplate("TENANT-001", payload);
            setModalVisible(false);
            setLabel("");
            setType("number");
            setRequired(false);
            setMaterialScope([]);
            setOptionsList([]);
            setCurrentOptionInput("");
            loadData();
        } catch (e: any) {
            console.error(e);
            Alert.alert("Error", "Failed to create field");
        } finally {
            setLoading(false);
        }
    };

    const renderDeletedItems = (label: string, items: string[], category: 'materials' | 'suppliers' | 'units') => {
        if (settings.hidden_sections?.includes(category)) return null;
        if (!items || items.length === 0) return null;
        return (
            <View style={{ marginBottom: 15 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#999', marginBottom: 5 }}>{label}</Text>
                <View style={[styles.chipContainer, { opacity: 0.7 }]}>
                    {items.map((item, i) => (
                        <TouchableOpacity
                            key={i}
                            style={[styles.chip, { backgroundColor: '#FEE2E2' }]}
                            onPress={() => handleRestoreOption(category, item)}
                        >
                            <Text style={[styles.chipText, { color: '#B91C1C', textDecorationLine: 'line-through' }]}>{item}</Text>
                            <Icon name="refresh" size={14} color="#B91C1C" style={{ marginLeft: 5 }} />
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        );
    };

    const isSectionVisible = (section: string) => !settings.hidden_sections?.includes(section);

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: Platform.OS === 'android' ? 40 : 0 }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 10 }}>
                    <Icon name="arrow-left" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.title}>Inventory Setup</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Tabs */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'dropdowns' && styles.tabActive]}
                    onPress={() => setActiveTab('dropdowns')}
                >
                    <Text style={[styles.tabText, activeTab === 'dropdowns' && styles.tabTextActive]}>Dropdown Options</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'fields' && styles.tabActive]}
                    onPress={() => setActiveTab('fields')}
                >
                    <Text style={[styles.tabText, activeTab === 'fields' && styles.tabTextActive]}>Custom Fields</Text>
                </TouchableOpacity>
            </View>

            {loading ? <ActivityIndicator size="large" color="#1D7A27" style={{ marginTop: 50 }} /> : (
                <ScrollView contentContainerStyle={styles.list}>

                    {/* DROPDOWNS VIEW */}
                    {activeTab === 'dropdowns' && (
                        <View>
                            {isSectionVisible('materials') && (
                                <SettingsSection
                                    title="Material Types"
                                    items={settings.materials}
                                    onAdd={() => { setOptionCategory('materials'); setAddModalVisible(true); }}
                                    onDelete={(item: string) => handleDeleteOption('materials', item)}
                                    onDeleteSection={() => handleDeleteSection('materials')}
                                />
                            )}
                            {isSectionVisible('suppliers') && (
                                <SettingsSection
                                    title="Suppliers"
                                    items={settings.suppliers}
                                    onAdd={() => { setOptionCategory('suppliers'); setAddModalVisible(true); }}
                                    onDelete={(item: string) => handleDeleteOption('suppliers', item)}
                                    onDeleteSection={() => handleDeleteSection('suppliers')}
                                />
                            )}
                            {isSectionVisible('units') && (
                                <SettingsSection
                                    title="Units"
                                    items={settings.units}
                                    onAdd={() => { setOptionCategory('units'); setAddModalVisible(true); }}
                                    onDelete={(item: string) => handleDeleteOption('units', item)}
                                    onDeleteSection={() => handleDeleteSection('units')}
                                />
                            )}

                            {/* HISTORY / TRASH SECTION */}
                            <View style={[styles.section, { borderTopWidth: 4, borderTopColor: '#F3F4F6', marginTop: 20 }]}>
                                <Text style={[styles.sectionTitle, { color: '#666', fontSize: 14 }]}>🗑️ Recently Deleted (Tap to Restore)</Text>

                                {/* Deleted Sections List */}
                                {settings.hidden_sections?.length > 0 && (
                                    <View style={{ marginBottom: 20 }}>
                                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#999', marginBottom: 5 }}>Deleted Sections</Text>
                                        <View style={{ gap: 10 }}>
                                            {settings.hidden_sections.map((sec: string, i: number) => (
                                                <TouchableOpacity key={i} onPress={() => handleRestoreSection(sec)} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEE2E2', padding: 10, borderRadius: 8 }}>
                                                    <Icon name="refresh" size={16} color="#B91C1C" />
                                                    <Text style={{ marginLeft: 10, color: '#B91C1C', fontWeight: '600' }}>Restore "{sec.toUpperCase()}" Section</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                )}

                                {renderDeletedItems("Materials", settings.deleted_materials, 'materials')}
                                {renderDeletedItems("Suppliers", settings.deleted_suppliers, 'suppliers')}
                                {renderDeletedItems("Units", settings.deleted_units, 'units')}

                                {(!settings.deleted_materials?.length && !settings.deleted_suppliers?.length && !settings.deleted_units?.length && !settings.hidden_sections?.length) && (
                                    <Text style={{ textAlign: 'center', color: '#CCC', fontStyle: 'italic', padding: 20 }}>
                                        Trash is empty
                                    </Text>
                                )}
                            </View>
                        </View>
                    )}

                    {/* CUSTOM FIELDS VIEW */}
                    {activeTab === 'fields' && (
                        <View>
                            <TouchableOpacity style={styles.addFullBtn} onPress={() => setModalVisible(true)}>
                                <Text style={styles.addFullBtnText}>+ Add New Field Template</Text>
                            </TouchableOpacity>

                            {fields.length === 0 ? (
                                <Text style={{ textAlign: 'center', color: '#999', marginTop: 30 }}>No custom fields configured.</Text>
                            ) : (
                                fields.map((field) => (
                                    <View key={field.field_id} style={styles.fieldCard}>
                                        <View style={styles.rowBetween}>
                                            <View>
                                                <Text style={styles.fieldLabel}>{field.label}</Text>
                                                <Text style={styles.fieldSub}>Type: {field.type.toUpperCase()} | Required: {field.required ? "Yes" : "No"}</Text>
                                                <Text style={styles.fieldSub}>Applies to: {field.material_scope.join(", ")}</Text>
                                            </View>
                                            <TouchableOpacity onPress={() => handleDeleteField(field.field_id)}>
                                                <Icon name="trash-can-outline" size={20} color="#EF4444" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))
                            )}
                        </View>
                    )}

                </ScrollView>
            )}

            {/* Modal for Creating New Field */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>New Field Template</Text>

                        <TextInput
                            style={styles.input}
                            placeholder="Field Label (e.g. Quality)"
                            value={label}
                            onChangeText={setLabel}
                        />

                        {/* SUB-FIELDS BUILDER (Values) */}
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#333', marginTop: 15, marginBottom: 8 }}>Field Values:</Text>

                        <View style={{ gap: 10, marginBottom: 15 }}>
                            {optionsList.map((opt, index) => {
                                // We store values in optionsList as JSON strings for simplicity in this local state, 
                                // or we can change optionsList to be an array of objects. 
                                // Let's refactor `optionsList` usage. Actually, to avoid breaking too much, let's use a new state paramList if possible.
                                // But `optionsList` is string[]. Let's use `optionsList` to store just names, and `typeList` for types?
                                // Better: Use a local component state for this form or refactor `optionsList`.
                                // Since I can't easily change the file's top level hooks in a partial edit without context, I will try to use `optionsList` to store the NAMES, and a new state for TYPES? 
                                // Wait, the prompt says "start fresh". 

                                // Let's simplify: `optionsList` will hold complex objects serialized as JSON strings? No, effectively I should change `optionsList` type but that requires verifying imports. 
                                // Quick fix: I will assume `optionsList` contains the NAMES. I'll add a new state `parameterTypes` to track types. 
                                // OR better: I'll Replace the `fields` rendering logic.

                                return (
                                    <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' }}>
                                        <View style={{ flex: 1 }}>
                                            <TextInput
                                                style={[styles.input, { marginBottom: 0, backgroundColor: '#FFF', height: 40, borderWidth: 1, borderColor: '#DDD' }]}
                                                placeholder={`Value Name (e.g. Clean)`}
                                                value={opt.split(':::')[0]} // Name
                                                onChangeText={(text) => {
                                                    // Just keep default type 'text' effectively, though we ignore it
                                                    const currentType = 'text';
                                                    handleUpdateOption(index, `${text}:::${currentType}`);
                                                }}
                                            />
                                        </View>
                                        <TouchableOpacity onPress={() => handleRemoveOptionFromField(index)}>
                                            <Icon name="trash-can-outline" size={20} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                )
                            })}
                        </View>

                        <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, backgroundColor: '#FFF', borderRadius: 8, borderWidth: 1, borderColor: '#166534', borderStyle: 'dashed', marginBottom: 20 }}
                            onPress={() => {
                                // Add new parameter default: Name="", Type="number"
                                // Stored as "name:::type" string to fit in string[] state
                                setOptionsList([...optionsList, ":::number"]);
                            }}
                        >
                            <Icon name="plus" size={18} color="#166534" style={{ marginRight: 5 }} />
                            <Text style={{ color: '#166534', fontWeight: '700' }}>Add Value</Text>
                        </TouchableOpacity>

                        {(!settings.materials || settings.materials.length === 0) && (
                            <Text style={{ fontSize: 11, color: '#EF4444', marginBottom: 10 }}>No materials defined in Dropdown Tabs yet. Please add materials first.</Text>
                        )}

                        {/* Hidden/Defaulted Fields: Material Scope = All, Required = False */}

                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                            <TouchableOpacity
                                style={[styles.btn, { backgroundColor: '#F3F4F6', flex: 1 }]}
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={{ color: '#333' }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.btn, { flex: 2 }]}
                                onPress={handleCreateField}
                            >
                                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>Save</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal for Adding Dropdown Option */}
            <Modal visible={addModalVisible} animationType="fade" transparent>
                <View style={[styles.modalOverlay, { justifyContent: 'center' }]}>
                    <View style={[styles.modalContent, { marginHorizontal: 30 }]}>
                        <Text style={styles.modalTitle}>Add New {optionCategory?.slice(0, -1)}</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter Name"
                            value={newItem}
                            onChangeText={setNewItem}
                        />
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                            <TouchableOpacity
                                style={[styles.btn, { backgroundColor: '#F3F4F6', flex: 1 }]}
                                onPress={() => setAddModalVisible(false)}
                            >
                                <Text style={{ color: '#333' }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.btn, { flex: 2 }]}
                                onPress={handleAddOption}
                            >
                                <Text style={styles.btnText}>Add</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const SettingsSection = ({ title, items, onAdd, onDelete, onDeleteSection }: any) => (
    <View style={styles.section}>
        <View style={styles.rowBetween}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={styles.sectionTitle}>{title}</Text>
                {onDeleteSection && (
                    <TouchableOpacity onPress={onDeleteSection}>
                        <Icon name="trash-can-outline" size={18} color="#EF4444" style={{ marginBottom: 10 }} />
                    </TouchableOpacity>
                )}
            </View>
            <TouchableOpacity onPress={onAdd}>
                <Text style={{ color: '#1D7A27', fontWeight: '600' }}>+ Add</Text>
            </TouchableOpacity>
        </View>
        <View style={styles.chipContainer}>
            {items?.map((item: string, i: number) => (
                <View key={i} style={styles.chip}>
                    <Text style={styles.chipText}>{item}</Text>
                    <TouchableOpacity onPress={() => onDelete(item)}>
                        <Icon name="close-circle" size={16} color="#999" style={{ marginLeft: 5 }} />
                    </TouchableOpacity>
                </View>
            ))}
            {(!items || items.length === 0) && <Text style={{ color: '#999', fontSize: 12 }}>No items configured.</Text>}
        </View>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6' },
    header: { padding: 15, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: '#DDD' },
    title: { fontSize: 18, fontWeight: '700', color: '#111' },

    tabContainer: { flexDirection: 'row', backgroundColor: '#FFF', marginBottom: 10 },
    tab: { flex: 1, paddingVertical: 15, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabActive: { borderBottomColor: '#1D7A27' },
    tabText: { fontWeight: '600', color: '#666' },
    tabTextActive: { color: '#1D7A27' },

    list: { padding: 15 },
    section: { backgroundColor: '#FFF', padding: 15, borderRadius: 12, marginBottom: 15 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 10 },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },

    chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
    chipText: { fontSize: 13, color: '#333' },

    // Field Cards
    fieldCard: { backgroundColor: '#FFF', padding: 15, borderRadius: 12, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: '#1D7A27' },
    fieldLabel: { fontSize: 16, fontWeight: '700', color: '#111' },
    fieldSub: { fontSize: 12, color: '#666', marginTop: 2 },

    addFullBtn: { backgroundColor: '#1D7A27', padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 20 },
    addFullBtnText: { color: '#FFF', fontWeight: '700' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#FFF', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
    modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 15 },
    input: { backgroundColor: '#F3F4F6', padding: 12, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#DDD' },
    typeBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: '#DDD' },
    typeBtnActive: { backgroundColor: '#DCFCE7', borderColor: '#1D7A27' },
    typeText: { fontSize: 12, color: '#666' },
    typeTextActive: { color: '#1D7A27', fontWeight: '700' },
    btn: { padding: 15, borderRadius: 10, alignItems: 'center', backgroundColor: '#1D7A27' },
    btnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
    inputContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },

    scopeChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#DDD' },
    scopeChipActive: { backgroundColor: '#1D7A27', borderColor: '#1D7A27' },
    scopeChipText: { fontSize: 12, color: '#666' },
    scopeChipTextActive: { color: '#FFF', fontWeight: '700' }
});
