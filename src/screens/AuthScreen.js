/**
 * 登录页面 — 自动使用后端账号登录
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { Colors, FontSize, Spacing, BorderRadius } from '../Theme';
import * as api from '../api/api';

export default function AuthScreen({ onSuccess }) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('正在连接服务器...');

  useEffect(() => {
    autoLogin();
  }, []);

  const autoLogin = async () => {
    setLoading(true);
    try {
      setStatus('正在登录...');
      // 使用后端账号自动登录
      const { data, status } = await api.login('', '');
      
      if (status === 200 && data.token) {
        setStatus('登录成功');
        setTimeout(() => onSuccess(), 500);
      } else {
        setStatus('登录失败');
        Alert.alert('错误', data.error || '登录失败');
        setLoading(false);
      }
    } catch (e) {
      console.error('[Auth] 登录失败:', e);
      setStatus('网络错误');
      Alert.alert('错误', '网络连接失败，请检查网络');
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Logo */}
        <View style={styles.logoWrap}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoText}>P</Text>
          </View>
          <Text style={styles.title}>PixelForge AI</Text>
          <Text style={styles.subtitle}>AI 图像 · 视频创作平台</Text>
        </View>

        {/* 加载状态 */}
        <View style={styles.loadingWrap}>
          {loading ? (
            <>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.statusText}>{status}</Text>
            </>
          ) : (
            <>
              <Text style={styles.errorText}>连接失败</Text>
              <Text style={styles.retryBtn} onPress={autoLogin}>点击重试</Text>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.bg,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logoIcon: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  logoText: {
    color: Colors.primaryText,
    fontSize: 36,
    fontWeight: '700',
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.text3,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  statusText: {
    marginTop: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text2,
  },
  errorText: {
    fontSize: FontSize.md,
    color: Colors.error,
    marginBottom: Spacing.md,
  },
  retryBtn: {
    fontSize: FontSize.md,
    color: Colors.primary,
    fontWeight: '600',
  },
});
