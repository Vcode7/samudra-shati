import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { vibrationService } from '../services/vibrationService';
import { apiClient } from '../services/api';
import { notificationService } from '../services/notificationService';

export const OTPVerificationScreen: React.FC = () => {
    
    const { login } = useAuth();
    const { t } = useLanguage();
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otp, setOtp] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleRequestOTP = async () => {
        const api = await apiClient();
        if (phoneNumber.length < 10) {
            Alert.alert(t('error'), 'Please enter a valid phone number');
            vibrationService.error();
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/api/users/request-otp', { phone_number: phoneNumber });
            if (response.data.success) {
                setOtpSent(true);
                vibrationService.success();
                Alert.alert(t('success'), `OTP sent to ${phoneNumber}${response.data.otp_code ? `\n\nDev OTP: ${response.data.otp_code}` : ''}`);
            }
        } catch (error: any) {
            vibrationService.error();
            Alert.alert(t('error'), error.response?.data?.detail || 'Failed to send OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        
        if (otp.length !== 6) {
            Alert.alert(t('error'), 'Please enter 6-digit OTP');
            vibrationService.error();
            return;
        }

        setLoading(true);
        try {
            const api = await apiClient();
            const pushToken = await notificationService.registerForPushNotifications();
            console.log('Push token:', pushToken);
            const response = await api.post('/api/users/verify-otp', {
                phone_number: phoneNumber,
                otp_code: otp,
                expo_push_token: pushToken,
            });

            if (response.data.access_token) {
                vibrationService.success();
                await login(response.data.access_token, 'user');
            }
        } catch (error: any) {
            vibrationService.error();
            Alert.alert(t('error'), error.response?.data?.detail || 'Invalid OTP');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.title}>🌊 Samudar Shati</Text>
                    <Text style={styles.subtitle}>Verify Your Phone Number</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>{t('phoneNumber')}</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="+91 9876543210"
                            placeholderTextColor="#999"
                            value={phoneNumber}
                            onChangeText={setPhoneNumber}
                            keyboardType="phone-pad"
                            maxLength={15}
                            editable={!otpSent}
                        />
                    </View>

                    {otpSent && (
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>{t('enterOTP')}</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="123456"
                                placeholderTextColor="#999"
                                value={otp}
                                onChangeText={setOtp}
                                keyboardType="number-pad"
                                maxLength={6}
                            />
                        </View>
                    )}

                    {!otpSent ? (
                        <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleRequestOTP} disabled={loading}>
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t('requestOTP')}</Text>}
                        </TouchableOpacity>
                    ) : (
                        <>
                            <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleVerifyOTP} disabled={loading}>
                                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t('verify')}</Text>}
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.resendButton} onPress={() => { setOtpSent(false); setOtp(''); }}>
                                <Text style={styles.resendText}>{t('resendOTP')}</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    content: { flex: 1, padding: 20 },
    header: { alignItems: 'center', marginTop: 60, marginBottom: 40 },
    title: { fontSize: 32, fontWeight: 'bold', color: '#0066cc', marginBottom: 8 },
    subtitle: { fontSize: 16, color: '#666' },
    form: { flex: 1 },
    inputGroup: { marginBottom: 24 },
    label: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8 },
    input: { backgroundColor: '#fff', borderRadius: 12, padding: 16, fontSize: 18, borderWidth: 2, borderColor: '#ddd' },
    button: { backgroundColor: '#0066cc', borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 20 },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
    resendButton: { marginTop: 16, alignItems: 'center' },
    resendText: { fontSize: 16, color: '#0066cc', textDecorationLine: 'underline' },
});
