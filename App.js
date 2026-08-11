/**
 * PixelForge AI Studio — React Native App
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar, Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as api from './src/api/api';
import AuthScreen from './src/screens/AuthScreen';
import MainApp from './src/screens/MainApp';

// 全局错误处理
ErrorUtils.setGlobalHandler((error, isFatal) => {
  if (isFatal) {
    Alert.alert(
      '致命错误',
      `${error.message}\n\n${error.stack}`,
      [{text: '确定'}]
    );
  }
  console.error('Global error:', error);
});

export default function App() {
  const [isAuth, setIsAuth] = useState(false);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      setError(e.message);
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

  if (loading) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>PixelForge AI</Text>
        <Text style={styles.loadingSubtext}>加载中...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorText}>启动错误</Text>
        <Text style={styles.errorMessage}>{error}</Text>
      </View>
    );
  }

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
  loading: { flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 24, fontWeight: 'bold', color: '#1A1A1A' },
  loadingSubtext: { fontSize: 14, color: '#888', marginTop: 8 },
  errorText: { fontSize: 20, fontWeight: 'bold', color: '#FF3B30' },
  errorMessage: { fontSize: 14, color: '#666', marginTop: 12, padding: 16, textAlign: 'left' },
});
