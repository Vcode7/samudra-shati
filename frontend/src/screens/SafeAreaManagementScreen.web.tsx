import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { apiClient } from '../services/api';

interface SafeArea {
  id: number;
  latitude: number;
  longitude: number;
  radius_km: number;
  description: string | null;
  is_active: boolean;
}

export const SafeAreaManagementScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [safeAreas, setSafeAreas] = useState<SafeArea[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const api = await apiClient();
      const response = await api.get('/api/authorities/safe-areas');
      setSafeAreas(response.data);
    } catch (error) {
      console.error('Error loading safe areas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4caf50" />
          <Text style={styles.loadingText}>Loading safe areas...</Text>
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
        <Text style={styles.title}>🟢 Safe Area Management (Web)</Text>
      </View>

      <View style={styles.webPanel}>
        <Text style={styles.infoText}>
          Map interaction is available on mobile devices.
          On web, manage safe areas using the table below.
        </Text>

        {safeAreas.map((area) => (
          <View key={area.id} style={styles.areaItem}>
            <Text style={styles.areaText}>
              📍 {area.description || `Area ${area.id}`} — {area.radius_km} km —{' '}
              {area.is_active ? 'Active' : 'Inactive'}
            </Text>

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.toggleBtn}
                onPress={async () => {
                  try {
                    const api = await apiClient();
                    await api.put(`/api/authorities/safe-areas/${area.id}`, {
                      is_active: !area.is_active,
                    });
                    loadData();
                  } catch {
                    Alert.alert('Error', 'Failed to update status');
                  }
                }}
              >
                <Text style={styles.toggleText}>
                  {area.is_active ? 'Disable' : 'Enable'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={async () => {
                  try {
                    const api = await apiClient();
                    await api.delete(`/api/authorities/safe-areas/${area.id}`);
                    loadData();
                  } catch {
                    Alert.alert('Error', 'Failed to delete');
                  }
                }}
              >
                <Text style={styles.deleteText}>🗑️</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#aaa' },
  header: { backgroundColor: '#16213e', padding: 16 },
  backButton: { marginBottom: 8 },
  backButtonText: { fontSize: 16, color: '#4caf50', fontWeight: '600' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  webPanel: { padding: 16 },
  infoText: { color: '#aaa', marginBottom: 12 },
  areaItem: {
    backgroundColor: '#0f0f23',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  areaText: { color: '#fff', fontSize: 14, marginBottom: 6 },
  actionsRow: { flexDirection: 'row', gap: 8 },
  toggleBtn: {
    backgroundColor: '#2a2a4e',
    padding: 8,
    borderRadius: 6,
  },
  toggleText: { color: '#4caf50', fontSize: 12 },
  deleteBtn: { backgroundColor: '#ff444422', padding: 8, borderRadius: 6 },
  deleteText: { fontSize: 14 },
});

export default SafeAreaManagementScreen;
