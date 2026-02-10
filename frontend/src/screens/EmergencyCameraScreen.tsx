import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Camera, CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useLanguage } from '../context/LanguageContext';
import { vibrationService } from '../services/vibrationService';
import { locationService } from '../services/locationService';
import { apiClient } from '../services/api';

export const EmergencyCameraScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { t } = useLanguage();

  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicrophonePermission] = useMicrophonePermissions();

  const cameraRef = useRef<CameraView>(null);
  const isRecordingRef = useRef(false);
  const lastTriggerRef = useRef(0);

  const [isRecording, setIsRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [countdown, setCountdown] = useState(3);

  // Ask permissions once
  useEffect(() => {
    (async () => {
      if (!permission?.granted) await requestPermission();
      if (!micPermission?.granted) await requestMicrophonePermission();

      if (permission?.granted && micPermission?.granted) {
        startEmergencySequence();
      }
    })();
  }, [permission?.granted, micPermission?.granted]);

  // Debounced emergency start
  const startEmergencySequence = () => {
    const now = Date.now();
    if (now - lastTriggerRef.current < 5000) return; // 5s cooldown
    lastTriggerRef.current = now;

    if (isRecordingRef.current) return;

    vibrationService.light();
    let count = 3;
    setCountdown(count);

    const timer = setInterval(() => {
      count--;
      setCountdown(count);
      if (count > 0) vibrationService.light();

      if (count === 0) {
        clearInterval(timer);
        startRecording();
      }
    }, 1000);
  };

  const startRecording = async () => {
    if (!cameraRef.current || isRecordingRef.current) return;

    try {
      isRecordingRef.current = true;
      setIsRecording(true);
      vibrationService.success();

      const videoData = await (cameraRef.current as any).recordAsync({
        maxDuration: 2,
        quality: '480p',
        mute: true,
      });

      if (videoData?.uri) {
        await uploadDisasterReport(videoData.uri);
      }
    } catch (error) {
      console.error('Recording failed:', error);
      Alert.alert(t('error'), t('recording_failed'));
    } finally {
      isRecordingRef.current = false;
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    try {
      if (cameraRef.current && isRecordingRef.current) {
        await cameraRef.current.stopRecording();
      }
    } catch { }
  };

  const uploadDisasterReport = async (videoUri: string) => {
    setUploading(true);
    try {
      const formData = new FormData();
      const api = await apiClient();
      const coords = await locationService.getCoordinates();
      const locationName = coords
        ? await locationService.reverseGeocode(coords.latitude, coords.longitude)
        : t('unknown_location');

      const filename = videoUri.split('/').pop() || 'emergency_video.mp4';

      formData.append('image', {
        uri: videoUri,
        name: filename,
        type: 'video/mp4',
      } as any);

      formData.append('latitude', coords?.latitude?.toString() || '0');
      formData.append('longitude', coords?.longitude?.toString() || '0');
      formData.append('location_name', locationName || t('emergency_location'));
      formData.append('description', t('emergency_shake_report'));

      await api.post('/api/disasters/report', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });

      Alert.alert(t('report_sent'), t('emergency_report_submitted'), [
        { text: t('ok'), onPress: () => navigation.navigate('Home') },
      ]);
    } catch (error) {
      console.error('Upload failed:', error);
      Alert.alert(t('upload_failed'), t('upload_failed_message'));
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = async () => {
    await stopRecording();
    navigation.goBack();
  };

  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>{t('camera_permission_required')}</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.button}>
          <Text style={styles.buttonText}>{t('grant_permission')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} mode="video" facing="back" />

      {/* Overlay */}
      <View style={styles.overlay}>
        <View style={styles.header}>
          <Text style={styles.headerText}>{t('emergency_mode')}</Text>
        </View>

        <View style={styles.centerContent}>
          {countdown > 0 ? (
            <Text style={styles.countdownText}>{countdown}</Text>
          ) : uploading ? (
            <>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.statusText}>{t('uploading')}</Text>
            </>
          ) : (
            <Text style={styles.statusText}>
              {isRecording ? t('recording') : t('processing')}
            </Text>
          )}
        </View>

        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
          <Text style={styles.cancelButtonText}>{t('cancel').toUpperCase()}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'space-between',
    padding: 20,
  },
  header: { paddingTop: 40, alignItems: 'center' },
  headerText: { color: '#ff3333', fontSize: 24, fontWeight: 'bold' },
  text: { color: '#fff', textAlign: 'center' },
  button: { backgroundColor: '#0066cc', padding: 15, borderRadius: 10, marginTop: 20 },
  buttonText: { color: '#fff', fontSize: 16 },
  centerContent: { alignItems: 'center', justifyContent: 'center' },
  countdownText: { fontSize: 120, color: '#fff', fontWeight: 'bold' },
  statusText: { fontSize: 22, color: '#fff', fontWeight: '600', marginTop: 10 },
  cancelButton: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 30,
  },
  cancelButtonText: { color: '#000', fontSize: 20, fontWeight: 'bold' },
});
