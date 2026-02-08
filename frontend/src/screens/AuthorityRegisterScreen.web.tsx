import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { apiClient } from '../services/api';

export const AuthorityRegisterScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [form, setForm] = useState({
    username: '',
    password: '',
    authority_type: 'fire',
    organization_name: '',
    contact_number: '',
    base_latitude: '',
    base_longitude: '',
    operational_radius_km: '50',
  });

  const [loading, setLoading] = useState(false);

  const update = (k: string, v: string) => setForm({ ...form, [k]: v });

  const handleRegister = async () => {
    if (!form.username || !form.password || !form.organization_name) {
      Alert.alert('Error', 'Please fill required fields');
      return;
    }

    setLoading(true);
    try {
      const api = await apiClient();
      await api.post('/api/authorities/register', {
        username: form.username,
        password: form.password,
        authority_type: form.authority_type,
        organization_name: form.organization_name,
        contact_number: form.contact_number,
        base_latitude: Number(form.base_latitude || 0),
        base_longitude: Number(form.base_longitude || 0),
        operational_radius_km: Number(form.operational_radius_km || 50),
      });

      Alert.alert('Success', 'Authority registered successfully');
      navigation.replace('AuthorityLogin');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>🏛️ Register New Authority (Web)</Text>

        <TextInput style={styles.input} placeholder="Username" placeholderTextColor="#999"
          value={form.username} onChangeText={(v) => update('username', v)} />

        <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#999"
          secureTextEntry value={form.password} onChangeText={(v) => update('password', v)} />

        <TextInput style={styles.input} placeholder="Authority Type (fire/police/medical)"
          placeholderTextColor="#999" value={form.authority_type}
          onChangeText={(v) => update('authority_type', v)} />

        <TextInput style={styles.input} placeholder="Organization Name"
          placeholderTextColor="#999" value={form.organization_name}
          onChangeText={(v) => update('organization_name', v)} />

        <TextInput style={styles.input} placeholder="Contact Number"
          placeholderTextColor="#999" value={form.contact_number}
          onChangeText={(v) => update('contact_number', v)} />

        <TextInput style={styles.input} placeholder="Base Latitude"
          placeholderTextColor="#999" keyboardType="numeric"
          value={form.base_latitude} onChangeText={(v) => update('base_latitude', v)} />

        <TextInput style={styles.input} placeholder="Base Longitude"
          placeholderTextColor="#999" keyboardType="numeric"
          value={form.base_longitude} onChangeText={(v) => update('base_longitude', v)} />

        <TextInput style={styles.input} placeholder="Operational Radius (km)"
          placeholderTextColor="#999" keyboardType="numeric"
          value={form.operational_radius_km}
          onChangeText={(v) => update('operational_radius_km', v)} />

        <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Register Authority</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back to Login</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  content: { padding: 20 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
  input: {
    backgroundColor: '#2a2a4e',
    color: '#fff',
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  btn: { backgroundColor: '#4caf50', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  backText: { color: '#4caf50', marginTop: 16, textAlign: 'center' },
});
