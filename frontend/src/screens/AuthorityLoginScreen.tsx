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
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { vibrationService } from '../services/vibrationService';
import { apiClient } from '../services/api';
import { notificationService } from '../services/notificationService';

export const AuthorityLoginScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const { login } = useAuth();
    const { t } = useLanguage();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!username || !password) {
            Alert.alert(t('error'), 'Please enter username and password');
            vibrationService.error();
            return;
        }

        setLoading(true);
        try {
            const api = await apiClient();
            const response = await api.post('/api/authorities/login', {
                username,
                password,
            });

            if (response.data.access_token) {
                vibrationService.success();
                await login(response.data.access_token, 'authority');

                // Link device to the authenticated authority
                await notificationService.linkDeviceToUser();

                navigation.replace('AuthorityDashboard');
            }
        } catch (error: any) {
            vibrationService.error();
            Alert.alert(t('error'), error.response?.data?.detail || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.content}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                            <Text style={styles.backButtonText}>← Back</Text>
                        </TouchableOpacity>
                        <Text style={styles.title}>🏛️ Authority Login</Text>
                        <Text style={styles.subtitle}>
                            For verified government officials and disaster management authorities
                        </Text>
                    </View>

                    <View style={styles.form}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Username</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter your username"
                                placeholderTextColor="#999"
                                value={username}
                                onChangeText={setUsername}
                                keyboardType="default"
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Password</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter your password"
                                placeholderTextColor="#999"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.loginButton, loading && styles.buttonDisabled]}
                            onPress={handleLogin}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.loginButtonText}>Login as Authority</Text>
                            )}
                        </TouchableOpacity>

                        <View style={styles.infoBox}>
                            <Text style={styles.infoTitle}>🔐 Access Restricted</Text>
                            <Text style={styles.infoText}>
                                This login is only for verified authorities. If you are a regular user,
                                please use the main app login with your phone number.
                            </Text>
                        </View>

                        <View style={styles.contactBox}>
                            <Text style={styles.contactTitle}>Need Access?</Text>
                            <Text style={styles.contactText}>
                                Contact your district disaster management office to get authority credentials.
                            </Text>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1a1a2e' },
    content: { flex: 1 },
    scrollContent: { flexGrow: 1 },
    header: { padding: 20, paddingTop: 10 },
    backButton: { marginBottom: 20 },
    backButtonText: { fontSize: 16, color: '#fff', fontWeight: '600' },
    title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
    subtitle: { fontSize: 14, color: '#aaa', lineHeight: 20 },
    form: { flex: 1, padding: 20 },
    inputGroup: { marginBottom: 20 },
    label: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 8 },
    input: {
        backgroundColor: '#2a2a4e',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#fff',
        borderWidth: 2,
        borderColor: '#3a3a5e',
    },
    loginButton: {
        backgroundColor: '#ff6600',
        borderRadius: 12,
        padding: 18,
        alignItems: 'center',
        marginTop: 10,
    },
    buttonDisabled: { opacity: 0.6 },
    loginButtonText: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
    infoBox: {
        backgroundColor: '#2a2a4e',
        padding: 16,
        borderRadius: 12,
        marginTop: 30,
        borderWidth: 1,
        borderColor: '#ff9800',
    },
    infoTitle: { fontSize: 16, fontWeight: '600', color: '#ff9800', marginBottom: 8 },
    infoText: { fontSize: 14, color: '#aaa', lineHeight: 20 },
    contactBox: {
        backgroundColor: '#2a2a4e',
        padding: 16,
        borderRadius: 12,
        marginTop: 16,
    },
    contactTitle: { fontSize: 16, fontWeight: '600', color: '#0088ff', marginBottom: 8 },
    contactText: { fontSize: 14, color: '#aaa', lineHeight: 20 },
});
