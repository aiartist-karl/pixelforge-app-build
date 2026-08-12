/**
 * PixelForge AI Studio — React Native App
 * v1.0.8 - Added ErrorBoundary for crash debugging
 */
import React, { useState, useEffect, Component } from 'react';
import { View, Text, ScrollView, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as api from './src/api/api';
import AuthScreen from './src/screens/AuthScreen';
import MainApp from './src/screens/MainApp';

// Error Boundary - catches JS errors and shows on screen instead of crashing
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error: error.toString() };
  }
  
  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo: JSON.stringify(errorInfo, null, 2) });
    console.error('App crashed:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#FF3B30" />
          <Text style={styles.errorTitle}>App Error</Text>
          <ScrollView style={styles.errorScroll}>
            <Text style={styles.errorText}>{this.state.error}</Text>
            {this.state.errorInfo && (
              <Text style={styles.errorDetail}>{this.state.errorInfo}</Text>
            )}
          </ScrollView>
          <Text style={styles.errorHint}>
            Build: v1.0.8 | Bundle: PixelForgeAI
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const [isAuth, setIsAuth] = useState(false);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const jwt = await api.getJWT();
      if (jwt) {
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

  if (initError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Init Error</Text>
        <Text style={styles.errorText}>{initError}</Text>
      </View>
    );
  }

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

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loading: { flex: 1, backgroundColor: '#fff' },
  errorContainer: {
    flex: 1, backgroundColor: '#1A1A1A', padding: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  errorTitle: { color: '#FF3B30', fontSize: 20, fontWeight: '700', marginBottom: 16 },
  errorScroll: { flex: 1, width: '100%' },
  errorText: { color: '#FF6B6B', fontSize: 14, fontFamily: 'monospace', marginBottom: 12 },
  errorDetail: { color: '#888', fontSize: 11, fontFamily: 'monospace' },
  errorHint: { color: '#555', fontSize: 11, marginTop: 12 },
});
