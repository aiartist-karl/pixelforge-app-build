/**
 * PixelForge AI Studio — React Native App
 */
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as api from './src/api/api';
import AuthScreen from './src/screens/AuthScreen';
import MainApp from './src/screens/MainApp';

export default function App() {
  const [isAuth, setIsAuth] = useState(false);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await api.getToken();
      if (token) {
        const { data, status } = await api.getProfile();
        if (status === 200) {
          setProfile(data);
          setIsAuth(true);
        } else {
          await api.logout();
        }
      }
    } catch (e) {
      console.log('Auth check failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    const { data } = await api.getProfile();
    setProfile(data);
    setIsAuth(true);
  };

  const handleLogout = async () => {
    await api.logout();
    setIsAuth(false);
    setProfile(null);
  };

  if (loading) return <View style={styles.loading} />;

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.container}>
        {!isAuth ? (
          <AuthScreen onSuccess={handleLogin} />
        ) : (
          <MainApp profile={profile} onUpdateProfile={setProfile} onLogout={handleLogout} />
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loading:   { flex: 1, backgroundColor: '#fff' },
});
