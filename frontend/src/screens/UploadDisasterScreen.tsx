import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    Alert,
    ActivityIndicator,
    Image,
    ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLanguage } from '../context/LanguageContext';
import { vibrationService } from '../services/vibrationService';
import { locationService } from '../services/locationService';
import {apiClient} from '../services/api';

export const UploadDisasterScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const { t } = useLanguage();
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [description, setDescription] = useState('');
    const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [locationName, setLocationName] = useState('');
    const [loading, setLoading] = useState(false);
    const [gettingLocation, setGettingLocation] = useState(false);

    useEffect(() => {
        getCurrentLocation();
    }, []);

    const getCurrentLocation = async () => {
        setGettingLocation(true);
        try {
            const coords = await locationService.getCoordinates();
            if (coords) {
                setLocation(coords);
                const name = await locationService.reverseGeocode(coords.latitude, coords.longitude);
                setLocationName(name || `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
            }
        } catch (error) {
            console.error('Error getting location:', error);
            Alert.alert(t('error'), 'Failed to get location');
        } finally {
            setGettingLocation(false);
        }
    };

    const pickImage = async (useCamera: boolean) => {
        try {
            const permissionResult = useCamera
                ? await ImagePicker.requestCameraPermissionsAsync()
                : await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (!permissionResult.granted) {
                Alert.alert(t('error'), 'Permission denied');
                return;
            }

            const result = useCamera
                ? await ImagePicker.launchCameraAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    allowsEditing: true,
                    aspect: [4, 3],
                    quality: 0.8,
                })
                : await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    allowsEditing: true,
                    aspect: [4, 3],
                    quality: 0.8,
                });

            if (!result.canceled && result.assets[0]) {
                setImageUri(result.assets[0].uri);
                vibrationService.success();
            }
        } catch (error) {
            console.error('Error picking image:', error);
            Alert.alert(t('error'), 'Failed to pick image');
        }
    };

    const handleSubmit = async () => {
        if (!imageUri) {
            Alert.alert(t('error'), 'Please select an image');
            vibrationService.error();
            return;
        }

        if (!location) {
            Alert.alert(t('error'), 'Location not available');
            vibrationService.error();
            return;
        }

        setLoading(true);
        try {
            const formData = new FormData();
            const api = await apiClient();
            // Add image
            const filename = imageUri.split('/').pop() || 'disaster.jpg';
            const match = /\.(\w+)$/.exec(filename);
            const type = match ? `image/${match[1]}` : 'image/jpeg';

            formData.append('image', {
                uri: imageUri,
                name: filename,
                type,
            } as any);

            // Add other data
            formData.append('latitude', location.latitude.toString());
            formData.append('longitude', location.longitude.toString());
            formData.append('location_name', locationName);
            if (description) {
                formData.append('description', description);
            }

            const response = await api.post('/api/disasters/report', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            vibrationService.success();
            Alert.alert(
                t('success'),
                'Disaster report submitted successfully!\n\nNearby users will be notified for verification.',
                [
                    {
                        text: 'OK',
                        onPress: () => navigation.goBack(),
                    },
                ]
            );
        } catch (error: any) {
            vibrationService.error();
            Alert.alert(t('error'), error.response?.data?.detail || 'Failed to submit report');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scrollView}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Text style={styles.backButtonText}>← Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>{t('reportDisaster')}</Text>
                </View>

                {/* Image Selection */}
                <View style={styles.section}>
                    <Text style={styles.label}>{t('uploadImage')} *</Text>
                    {imageUri ? (
                        <View style={styles.imageContainer}>
                            <Image source={{ uri: imageUri }} style={styles.image} />
                            <TouchableOpacity
                                style={styles.changeImageButton}
                                onPress={() => setImageUri(null)}
                            >
                                <Text style={styles.changeImageText}>Change Image</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.imagePickerButtons}>
                            <TouchableOpacity
                                style={styles.imagePickerButton}
                                onPress={() => pickImage(true)}
                            >
                                <Text style={styles.imagePickerIcon}>📷</Text>
                                <Text style={styles.imagePickerText}>{t('takePhoto')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.imagePickerButton}
                                onPress={() => pickImage(false)}
                            >
                                <Text style={styles.imagePickerIcon}>🖼️</Text>
                                <Text style={styles.imagePickerText}>{t('chooseFromGallery')}</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Location */}
                <View style={styles.section}>
                    <Text style={styles.label}>{t('location')} *</Text>
                    <View style={styles.locationContainer}>
                        <Text style={styles.locationText}>
                            {gettingLocation ? t('gettingLocation') : locationName || 'Location not available'}
                        </Text>
                        <TouchableOpacity
                            style={styles.refreshButton}
                            onPress={getCurrentLocation}
                            disabled={gettingLocation}
                        >
                            <Text style={styles.refreshButtonText}>🔄</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Description */}
                <View style={styles.section}>
                    <Text style={styles.label}>{t('description')}</Text>
                    <TextInput
                        style={styles.textArea}
                        placeholder="Describe what you see..."
                        placeholderTextColor="#999"
                        value={description}
                        onChangeText={setDescription}
                        multiline
                        numberOfLines={4}
                        maxLength={500}
                    />
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                    style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                    onPress={handleSubmit}
                    disabled={loading || !imageUri || !location}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.submitButtonText}>{t('submit')}</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    scrollView: { flex: 1 },
    header: { backgroundColor: '#0066cc', padding: 20, paddingTop: 10 },
    backButton: { marginBottom: 10 },
    backButtonText: { fontSize: 16, color: '#fff', fontWeight: '600' },
    title: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
    section: { padding: 16, marginBottom: 8 },
    label: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 12 },
    imageContainer: { alignItems: 'center' },
    image: { width: '100%', height: 250, borderRadius: 12, backgroundColor: '#ddd' },
    changeImageButton: { marginTop: 12, padding: 12, backgroundColor: '#ff6600', borderRadius: 8 },
    changeImageText: { fontSize: 16, fontWeight: '600', color: '#fff' },
    imagePickerButtons: { flexDirection: 'row', gap: 12 },
    imagePickerButton: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#ddd',
    },
    imagePickerIcon: { fontSize: 32, marginBottom: 8 },
    imagePickerText: { fontSize: 14, fontWeight: '600', color: '#333' },
    locationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#ddd',
    },
    locationText: { flex: 1, fontSize: 16, color: '#333' },
    refreshButton: { padding: 8 },
    refreshButtonText: { fontSize: 20 },
    textArea: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        borderWidth: 2,
        borderColor: '#ddd',
        textAlignVertical: 'top',
        minHeight: 100,
    },
    submitButton: {
        backgroundColor: '#ff6600',
        margin: 16,
        padding: 18,
        borderRadius: 12,
        alignItems: 'center',
    },
    submitButtonDisabled: { opacity: 0.6 },
    submitButtonText: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
});
