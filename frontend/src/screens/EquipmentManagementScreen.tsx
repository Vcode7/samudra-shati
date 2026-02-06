import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TextInput,
    Alert,
    ActivityIndicator,
    Modal,
} from 'react-native';
import { useLanguage } from '../context/LanguageContext';
import { vibrationService } from '../services/vibrationService';
import { apiClient } from '../services/api';

// Must match backend EquipmentTypeEnum
type EquipmentType = 'boat' | 'ambulance' | 'helicopter' | 'rescue_kit';

const EQUIPMENT_TYPES: { value: EquipmentType; label: string; icon: string }[] = [
    { value: 'boat', label: 'Rescue Boat', icon: '🚤' },
    { value: 'ambulance', label: 'Ambulance', icon: '🚑' },
    { value: 'helicopter', label: 'Helicopter', icon: '🚁' },
    { value: 'rescue_kit', label: 'Rescue Kit', icon: '🛟' },
];

interface Equipment {
    id: number;
    equipment_type: EquipmentType;
    quantity: number;
    is_available: boolean;
    description: string | null;
    created_at: string;
}

export const EquipmentManagementScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const { t } = useLanguage();
    const [equipment, setEquipment] = useState<Equipment[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
    const [formData, setFormData] = useState({
        equipment_type: 'boat' as EquipmentType,
        quantity: '',
        is_available: true,
        description: '',
    });

    useEffect(() => {
        loadEquipment();
    }, []);

    const loadEquipment = async () => {
        try {
            const api = await apiClient();
            const response = await api.get('/api/authorities/equipment');
            setEquipment(response.data);
        } catch (error) {
            console.error('Error loading equipment:', error);
            // Mock data for development - matching backend schema
            setEquipment([
                { id: 1, equipment_type: 'boat', quantity: 5, is_available: true, description: 'Rescue boats for flood operations', created_at: new Date().toISOString() },
                { id: 2, equipment_type: 'rescue_kit', quantity: 50, is_available: true, description: 'First aid and rescue kits', created_at: new Date().toISOString() },
                { id: 3, equipment_type: 'ambulance', quantity: 3, is_available: false, description: 'Medical transport', created_at: new Date().toISOString() },
                { id: 4, equipment_type: 'helicopter', quantity: 1, is_available: true, description: null, created_at: new Date().toISOString() },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleAddEquipment = () => {
        setEditingEquipment(null);
        setFormData({ equipment_type: 'boat', quantity: '', is_available: true, description: '' });
        setModalVisible(true);
    };

    const handleEditEquipment = (item: Equipment) => {
        setEditingEquipment(item);
        setFormData({
            equipment_type: item.equipment_type,
            quantity: String(item.quantity),
            is_available: item.is_available,
            description: item.description || '',
        });
        setModalVisible(true);
    };

    const handleSaveEquipment = async () => {
        if (!formData.quantity) {
            Alert.alert(t('error'), 'Please enter quantity');
            return;
        }

        try {
            const api = await apiClient();
            if (editingEquipment) {
                await api.put(`/api/authorities/equipment/${editingEquipment.id}`, {
                    quantity: parseInt(formData.quantity),
                    is_available: formData.is_available,
                    description: formData.description || null,
                });
            } else {
                await api.post('/api/authorities/equipment', {
                    equipment_type: formData.equipment_type,
                    quantity: parseInt(formData.quantity),
                    description: formData.description || null,
                });
            }
            vibrationService.success();
            setModalVisible(false);
            loadEquipment();
        } catch (error: any) {
            vibrationService.error();
            console.error('Equipment save error:', error.response?.data || error);
            Alert.alert(t('error'), error.response?.data?.detail || 'Failed to save equipment');
        }
    };

    const getEquipmentLabel = (type: EquipmentType): string => {
        return EQUIPMENT_TYPES.find(e => e.value === type)?.label || type;
    };

    const getEquipmentIcon = (type: EquipmentType): string => {
        return EQUIPMENT_TYPES.find(e => e.value === type)?.icon || '📦';
    };



    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#ff6600" />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.title}>🚒 Equipment Management</Text>
            </View>

            <ScrollView style={styles.scrollView}>
                {/* Summary */}
                <View style={styles.summary}>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryNumber}>{equipment.filter(e => e.is_available).length}</Text>
                        <Text style={styles.summaryLabel}>Available</Text>
                    </View>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryNumber}>{equipment.filter(e => !e.is_available).length}</Text>
                        <Text style={styles.summaryLabel}>In Use</Text>
                    </View>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryNumber}>{equipment.reduce((sum, e) => sum + e.quantity, 0)}</Text>
                        <Text style={styles.summaryLabel}>Total Items</Text>
                    </View>
                </View>

                {/* Equipment List */}
                {equipment.map((item) => (
                    <TouchableOpacity
                        key={item.id}
                        style={styles.equipmentCard}
                        onPress={() => handleEditEquipment(item)}
                    >
                        <View style={styles.equipmentHeader}>
                            <Text style={styles.equipmentName}>
                                {getEquipmentIcon(item.equipment_type)} {getEquipmentLabel(item.equipment_type)}
                            </Text>
                            <View style={[styles.statusBadge, { backgroundColor: item.is_available ? '#4caf50' : '#ff9800' }]}>
                                <Text style={styles.statusText}>{item.is_available ? 'Available' : 'In Use'}</Text>
                            </View>
                        </View>
                        <Text style={styles.quantityText}>Quantity: {item.quantity}</Text>
                        {item.description && (
                            <Text style={styles.descriptionText}>{item.description}</Text>
                        )}
                        <Text style={styles.updateText}>
                            Added: {new Date(item.created_at).toLocaleDateString()}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Add Button */}
            <TouchableOpacity style={styles.addButton} onPress={handleAddEquipment}>
                <Text style={styles.addButtonText}>+ Add Equipment</Text>
            </TouchableOpacity>

            {/* Edit Modal */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>
                            {editingEquipment ? 'Edit Equipment' : 'Add Equipment'}
                        </Text>

                        {/* Equipment Type Selector (only for new equipment) */}
                        {!editingEquipment && (
                            <>
                                <Text style={styles.inputLabel}>Equipment Type</Text>
                                <View style={styles.typeSelector}>
                                    {EQUIPMENT_TYPES.map((type) => (
                                        <TouchableOpacity
                                            key={type.value}
                                            style={[
                                                styles.typeOption,
                                                formData.equipment_type === type.value && styles.typeOptionActive,
                                            ]}
                                            onPress={() => setFormData({ ...formData, equipment_type: type.value })}
                                        >
                                            <Text style={styles.typeIcon}>{type.icon}</Text>
                                            <Text style={[
                                                styles.typeLabel,
                                                formData.equipment_type === type.value && styles.typeLabelActive,
                                            ]}>{type.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </>
                        )}

                        <Text style={styles.inputLabel}>Quantity</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter quantity"
                            placeholderTextColor="#666"
                            keyboardType="numeric"
                            value={formData.quantity}
                            onChangeText={(text) => setFormData({ ...formData, quantity: text })}
                        />

                        <Text style={styles.inputLabel}>Description (optional)</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            placeholder="Equipment description..."
                            placeholderTextColor="#666"
                            multiline
                            numberOfLines={3}
                            value={formData.description}
                            onChangeText={(text) => setFormData({ ...formData, description: text })}
                        />

                        {/* Availability Toggle */}
                        <TouchableOpacity
                            style={styles.availabilityToggle}
                            onPress={() => setFormData({ ...formData, is_available: !formData.is_available })}
                        >
                            <View style={[
                                styles.toggleSwitch,
                                formData.is_available && styles.toggleSwitchActive,
                            ]}>
                                <View style={[
                                    styles.toggleKnob,
                                    formData.is_available && styles.toggleKnobActive,
                                ]} />
                            </View>
                            <Text style={styles.availabilityText}>
                                {formData.is_available ? '✅ Available' : '🔴 In Use'}
                            </Text>
                        </TouchableOpacity>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveButton} onPress={handleSaveEquipment}>
                                <Text style={styles.saveButtonText}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>

    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1a1a2e' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { backgroundColor: '#16213e', padding: 16, paddingTop: 10 },
    backButton: { marginBottom: 8 },
    backButtonText: { fontSize: 16, color: '#fff', fontWeight: '600' },
    title: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
    scrollView: { flex: 1, padding: 16 },
    summary: { flexDirection: 'row', marginBottom: 20, gap: 12 },
    summaryItem: {
        flex: 1,
        backgroundColor: '#16213e',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    summaryNumber: { fontSize: 24, fontWeight: 'bold', color: '#ff6600' },
    summaryLabel: { fontSize: 12, color: '#aaa', marginTop: 4 },
    equipmentCard: {
        backgroundColor: '#16213e',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
    },
    equipmentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    equipmentName: { fontSize: 18, fontWeight: '600', color: '#fff' },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    statusText: { fontSize: 12, fontWeight: '600', color: '#fff' },
    quantityText: { fontSize: 14, color: '#aaa', marginBottom: 4 },
    updateText: { fontSize: 12, color: '#666' },
    addButton: {
        backgroundColor: '#ff6600',
        margin: 16,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    addButtonText: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: { backgroundColor: '#16213e', padding: 20, borderRadius: 16 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 20 },
    input: {
        backgroundColor: '#2a2a4e',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#fff',
        marginBottom: 12,
    },
    statusSelector: { flexDirection: 'row', gap: 8, marginBottom: 20 },
    statusOption: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#2a2a4e',
        alignItems: 'center',
    },
    statusOptionText: { fontSize: 12, fontWeight: '600', color: '#aaa' },
    modalButtons: { flexDirection: 'row', gap: 12 },
    cancelButton: {
        flex: 1,
        padding: 14,
        borderRadius: 12,
        backgroundColor: '#2a2a4e',
        alignItems: 'center',
    },
    cancelButtonText: { fontSize: 16, fontWeight: '600', color: '#aaa' },
    saveButton: {
        flex: 1,
        padding: 14,
        borderRadius: 12,
        backgroundColor: '#ff6600',
        alignItems: 'center',
    },
    saveButtonText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
    // New styles for updated form
    descriptionText: { fontSize: 13, color: '#888', marginBottom: 4, fontStyle: 'italic' },
    inputLabel: { fontSize: 14, fontWeight: '600', color: '#aaa', marginBottom: 8 },
    textArea: { minHeight: 80, textAlignVertical: 'top' },
    typeSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    typeOption: {
        width: '47%',
        padding: 12,
        borderRadius: 12,
        backgroundColor: '#2a2a4e',
        alignItems: 'center',
    },
    typeOptionActive: { backgroundColor: '#ff6600', borderWidth: 2, borderColor: '#ffaa00' },
    typeIcon: { fontSize: 28, marginBottom: 4 },
    typeLabel: { fontSize: 12, fontWeight: '600', color: '#aaa', textAlign: 'center' },
    typeLabelActive: { color: '#fff' },
    availabilityToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 16,
        padding: 12,
        backgroundColor: '#2a2a4e',
        borderRadius: 12,
    },
    toggleSwitch: {
        width: 50,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#666',
        padding: 3,
        marginRight: 12,
    },
    toggleSwitchActive: { backgroundColor: '#4caf50' },
    toggleKnob: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#fff',
    },
    toggleKnobActive: { marginLeft: 22 },
    availabilityText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
