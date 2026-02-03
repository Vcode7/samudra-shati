import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LanguageProvider, useLanguage } from './src/context/LanguageContext';
import { notificationService } from './src/services/notificationService';
import { LanguageSelectionScreen } from './src/screens/LanguageSelectionScreen';
import { OTPVerificationScreen } from './src/screens/OTPVerificationScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { UploadDisasterScreen } from './src/screens/UploadDisasterScreen';
import { RecentAlertsScreen } from './src/screens/RecentAlertsScreen';
import { DisasterDetailsScreen } from './src/screens/DisasterDetailsScreen';
import { VerificationScreen } from './src/screens/VerificationScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const Stack = createStackNavigator();

const AppNavigator: React.FC = () => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { primaryLanguage, loading: langLoading } = useLanguage();
  const [languageSelected, setLanguageSelected] = useState(false);
  const [checkingLanguage, setCheckingLanguage] = useState(true);

  useEffect(() => {
    checkLanguageSelection();
    setupNotifications();
  }, []);

  const checkLanguageSelection = async () => {
    try {
      const lang = await AsyncStorage.getItem('primary_language');
      setLanguageSelected(!!lang);
    } catch (error) {
      console.error('Error checking language selection:', error);
    } finally {
      setCheckingLanguage(false);
    }
  };

  const setupNotifications = async () => {
    const token = await notificationService.registerForPushNotifications();
    console.log('Push token:', token);

    notificationService.addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification);
    });

    notificationService.addNotificationResponseListener((response) => {
      console.log('Notification tapped:', response);
    });
  };

  if (authLoading || langLoading || checkingLanguage) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!languageSelected ? (
          <Stack.Screen name="LanguageSelection">
            {(props) => (
              <LanguageSelectionScreen
                {...props}
                onComplete={() => setLanguageSelected(true)}
              />
            )}
          </Stack.Screen>
        ) : !isAuthenticated ? (
          <Stack.Screen name="OTPVerification" component={OTPVerificationScreen} />
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="UploadDisaster" component={UploadDisasterScreen} />
            <Stack.Screen name="RecentAlerts" component={RecentAlertsScreen} />
            <Stack.Screen name="DisasterDetails" component={DisasterDetailsScreen} />
            <Stack.Screen name="Verification" component={VerificationScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#666' },
});
