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
import api from '../services/api';

interface Equipment {
    id: number;
    name: string;
    quantity: number;
    status: 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE';
    last_updated: string;
}

export const EquipmentManagementScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const { t } = useLanguage();
    const [equipment, setEquipment] = useState<Equipment[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
    const [formData, setFormData] = useState({ name: '', quantity: '', status: 'AVAILABLE' as Equipment['status'] });

    useEffect(() => {
        loadEquipment();
    }, []);

    const loadEquipment = async () => {
        try {
            const response = await api.get('/api/authorities/equipment');
            setEquipment(response.data);
        } catch (error) {
            console.error('Error loading equipment:', error);
            // Mock data for development
            setEquipment([
                { id: 1, name: 'Rescue Boats', quantity: 5, status: 'AVAILABLE', last_updated: new Date().toISOString() },
                { id: 2, name: 'First Aid Kits', quantity: 50, status: 'AVAILABLE', last_updated: new Date().toISOString() },
                { id: 3, name: 'Emergency Tents', quantity: 20, status: 'IN_USE', last_updated: new Date().toISOString() },
                { id: 4, name: 'Water Pumps', quantity: 3, status: 'MAINTENANCE', last_updated: new Date().toISOString() },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleAddEquipment = () => {
        setEditingEquipment(null);
        setFormData({ name: '', quantity: '', status: 'AVAILABLE' });
        setModalVisible(true);
    };

    const handleEditEquipment = (item: Equipment) => {
        setEditingEquipment(item);
        setFormData({ name: item.name, quantity: String(item.quantity), status: item.status });
        setModalVisible(true);
    };

    const handleSaveEquipment = async () => {
        if (!formData.name || !formData.quantity) {
            Alert.alert(t('error'), 'Please fill all fields');
            return;
        }

        try {
            if (editingEquipment) {
                await api.put(`/api/authorities/equipment/${editingEquipment.id}`, {
                    name: formData.name,
                    quantity: parseInt(formData.quantity),
                    status: formData.status,
                });
            } else {
                await api.post('/api/authorities/equipment', {
                    name: formData.name,
                    quantity: parseInt(formData.quantity),
                    status: formData.status,
                });
            }
            vibrationService.success();
            setModalVisible(false);
            loadEquipment();
        } catch (error) {
            vibrationService.error();
            // For demo, update locally
            if (editingEquipment) {
                setEquipment(equipment.map(e =>
                    e.id === editingEquipment.id
                        ? { ...e, name: formData.name, quantity: parseInt(formData.quantity), status: formData.status, last_updated: new Date().toISOString() }
                        : e
                ));
            } else {
                setEquipment([...equipment, {
                    id: Math.max(...equipment.map(e => e.id)) + 1,
                    name: formData.name,
                    quantity: parseInt(formData.quantity),
                    status: formData.status,
                    last_updated: new Date().toISOString(),
                }]);
            }
            setModalVisible(false);
        }
    };

    const getStatusColor = (status: Equipment['status']) => {
        switch (status) {
            case 'AVAILABLE': return '#4caf50';
            case 'IN_USE': return '#ff9800';
            case 'MAINTENANCE': return '#f44336';
            default: return '#999';
        }
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
                        <Text style={styles.summaryNumber}>{equipment.filter(e => e.status === 'AVAILABLE').length}</Text>
                        <Text style={styles.summaryLabel}>Available</Text>
                    </View>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryNumber}>{equipment.filter(e => e.status === 'IN_USE').length}</Text>
                        <Text style={styles.summaryLabel}>In Use</Text>
                    </View>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryNumber}>{equipment.filter(e => e.status === 'MAINTENANCE').length}</Text>
                        <Text style={styles.summaryLabel}>Maintenance</Text>
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
                            <Text style={styles.equipmentName}>{item.name}</Text>
                            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                                <Text style={styles.statusText}>{item.status.replace('_', ' ')}</Text>
                            </View>
                        </View>
                        <Text style={styles.quantityText}>Quantity: {item.quantity}</Text>
                        <Text style={styles.updateText}>
                            Updated: {new Date(item.last_updated).toLocaleString()}
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

                        <TextInput
                            style={styles.input}
                            placeholder="Equipment Name"
                            placeholderTextColor="#666"
                            value={formData.name}
                            onChangeText={(text) => setFormData({ ...formData, name: text })}
                        />

                        <TextInput
                            style={styles.input}
                            placeholder="Quantity"
                            placeholderTextColor="#666"
                            keyboardType="numeric"
                            value={formData.quantity}
                            onChangeText={(text) => setFormData({ ...formData, quantity: text })}
                        />

                        <View style={styles.statusSelector}>
                            {(['AVAILABLE', 'IN_USE', 'MAINTENANCE'] as Equipment['status'][]).map((status) => (
                                <TouchableOpacity
                                    key={status}
                                    style={[
                                        styles.statusOption,
                                        formData.status === status && { backgroundColor: getStatusColor(status) },
                                    ]}
                                    onPress={() => setFormData({ ...formData, status })}
                                >
                                    <Text style={[
                                        styles.statusOptionText,
                                        formData.status === status && { color: '#fff' },
                                    ]}>
                                        {status.replace('_', ' ')}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

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
});
