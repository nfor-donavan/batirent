import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { SettingsProvider, useSettings } from './src/settings';
import { AuthProvider, useAuth } from './src/auth';
import { flushQueue } from './src/queue';
import LoginScreen from './src/screens/LoginScreen';
import ContractsScreen from './src/screens/ContractsScreen';
import ContractScreen from './src/screens/ContractScreen';
import ReturnScreen from './src/screens/ReturnScreen';

const Stack = createNativeStackNavigator();

function Root() {
  const { user, ready } = useAuth();
  const { colors, dark, t } = useSettings();

  // Retry any returns saved while the phone had no signal.
  useEffect(() => {
    if (!user) return undefined;
    flushQueue();
    return NetInfo.addEventListener((s) => { if (s.isConnected) flushQueue(); });
  }, [user]);

  if (!ready) return null;
  const base = dark ? DarkTheme : DefaultTheme;
  const theme = { ...base, colors: { ...base.colors, background: colors.bg, card: colors.surface, text: colors.ink, border: colors.rule, primary: colors.amber } };
  return (
    <NavigationContainer theme={theme}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack.Navigator screenOptions={{ headerShadowVisible: false, headerTitleStyle: { fontWeight: '700' } }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Contracts" component={ContractsScreen} options={{ title: 'BatiRent' }} />
            <Stack.Screen name="Contract" component={ContractScreen} options={{ title: t('contract') }} />
            <Stack.Screen name="Return" component={ReturnScreen} options={{ title: t('returnTitle') }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <AuthProvider>
          <Root />
        </AuthProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
