/**
 * Web-Only App Entry Point
 * 
 * This file is automatically used by React Native Web instead of App.tsx.
 * Web portal is ONLY for Authority users - no regular user features.
 */

import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LanguageProvider } from './src/context/LanguageContext';
import { AuthorityLoginScreen } from './src/screens/AuthorityLoginScreen';
import { AuthorityRegisterScreen } from './src/screens/AuthorityRegisterScreen.web';
import { AuthorityDashboardScreen } from './src/screens/AuthorityDashboardScreen';
import { EquipmentManagementScreen } from './src/screens/EquipmentManagementScreen';
import { SafeAreaManagementScreen } from './src/screens/SafeAreaManagementScreen.web';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initApi } from './src/services/api';

// Web-specific map component using iframe for OpenStreetMap
import { WebMapScreen } from './src/screens/web/WebMapScreen';

const Stack = createStackNavigator();

const WebAppNavigator: React.FC = () => {
    const { isAuthenticated, userType, loading: authLoading } = useAuth();

    const [apiReady, setApiReady] = useState(false);
    // const [userType, setUserType] = useState<string | null>(null);

    // useEffect(() => {
    //     (async () => {
    //         try {
    //             await initApi();
    //             const type = await AsyncStorage.getItem('user_type');
    //             setUserType(type);
    //             setApiReady(true);
    //         } catch (e) {
    //             console.error('Web app init failed:', e);
    //             setApiReady(true); // Still show login screen
    //         }
    //     })();
    // }, []);
    useEffect(() => {
        (async () => {
            try {
                await initApi();
                setApiReady(true);
            } catch (e) {
                console.error('Web app init failed:', e);
                setApiReady(true);
            }
        })();
    }, []);
    if (authLoading || !apiReady) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#1a1a2e" />
                <Text style={styles.loadingText}>Loading Authority Portal...</Text>
            </View>
        );
    }

    return (
        <NavigationContainer>
            <Stack.Navigator
                screenOptions={{
                    headerShown: true,
                    headerStyle: { backgroundColor: '#1a1a2e' },
                    headerTintColor: '#fff',
                    headerTitleStyle: { fontWeight: 'bold' },
                }}
            >
                {!isAuthenticated || userType !== 'authority' ? (
                    // Not authenticated as authority - show login
                    <>
                        <Stack.Screen
                            name="AuthorityLogin"
                            component={AuthorityLoginScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="AuthorityRegister"
                            component={AuthorityRegisterScreen}
                            options={{ title: 'Register Authority' }}
                        />
                    </>
                ) : (
                    // Authenticated authority - show dashboard and management screens
                    <>
                        <Stack.Screen
                            name="AuthorityDashboard"
                            component={AuthorityDashboardScreen}
                            options={{ title: '🏛️ Authority Dashboard' }}
                        />
                        <Stack.Screen
                            name="EquipmentManagement"
                            component={EquipmentManagementScreen}
                            options={{ title: '🔧 Equipment Management' }}
                        />
                        <Stack.Screen
                            name="SafeAreaManagement"
                            component={SafeAreaManagementScreen}
                            options={{ title: '🟢 Safe Zones' }}
                        />
                        <Stack.Screen
                            name="WebMap"
                            component={WebMapScreen}
                            options={{ title: '🗺️ Disaster Map' }}
                        />
                        <Stack.Screen
                            name="AlertsMap"
                            component={WebMapScreen}
                            options={{ title: 'Alerts Map' }}
                        />
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
                <View style={styles.container}>
                    <WebAppNavigator />
                </View>
            </AuthProvider>
        </LanguageProvider>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#1a1a2e',
    },
});
