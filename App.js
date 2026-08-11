/**
 * PixelForge AI Studio — React Native App
 */
import { AppRegistry } from 'react-native';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar, Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as api from './src/api/api';
import AuthScreen from './src/screens/AuthScreen';
import MainApp from './src/screens/MainApp';

// 全局错误处理
ErrorUtils.setGlobalHandler((error, isFatal) => {
  if (isFatal) {
    Alert.alert('致命错误', error.message + '\n\n' + error.stack, [{text: '确定'}]);
  }
  console.error('Global error:', error);
});

function PixelForgeApp() {
  const [isAuth, setIsAuth] = useState(false);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { checkAuth(); }, []);

  const checkAuth = async () => {
    try {
      const token = await api.getToken();
      if (token) {
        const { data, status } = await api.getProfile();
        if (status === 200) { setProfile(data); setIsAuth(true); }
        else { await api.logout(); }
      }
    } catch (e) { console.log('Auth check failed:', e); setError(e.message); }
    finally { setLoading(false); }
  };

  const handleLogin = async () => {
    const { data } = await api.getProfile();
    setProfile(data); setIsAuth(true);
  };

  const handleLogout = async () => {
    await api.logout(); setIsAuth(false); setProfile(null);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.logo}>PixelForge AI</Text>
        <Text style={styles.sub}>加载中...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.err}>启动错误</Text>
        <Text style={styles.errMsg}>{error}</Text>
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
  center: { flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  logo: { fontSize: 24, fontWeight: 'bold', color: '#1A1A1A' },
  sub: { fontSize: 14, color: '#888', marginTop: 8 },
  err: { fontSize: 20, fontWeight: 'bold', color: '#FF3B30' },
  errMsg: { fontSize: 13, color: '#666', marginTop: 12, padding: 16 },
});

//  关键：注册组件，让原生端能找到入口
AppRegistry.registerComponent('main', () => PixelForgeApp);
AppRegistry.registerComponent('PixelForgeAI', () => PixelForgeApp);
