/**
 * 我的 Tab
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Colors, FontSize, Spacing, BorderRadius } from '../Theme';

export default function ProfileScreen({ profile, onUpdateProfile, onLogout }) {
  const handleLogout = () => {
    Alert.alert('退出登录', '确定退出登录？', [
      { text: '取消', style: 'cancel' },
      { text: '退出', style: 'destructive', onPress: onLogout },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* 用户信息 */}
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(profile?.username || 'U')[0].toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{profile?.username || '用户'}</Text>
        <Text style={styles.email}>{profile?.email || ''}</Text>
      </View>

      {/* 积分 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>当前积分</Text>
        <Text style={styles.points}>{profile?.points ?? 0}</Text>
        <Text style={styles.hint}>积分用于 AI 生成，消耗后不可退还</Text>
      </View>

      {/* 充值提示 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>充值</Text>
        <Text style={styles.hint}>请联系管理员获取充值卡密</Text>
      </View>

      {/* 退出 */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>退出登录</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, padding: Spacing.md },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  avatarText: { fontSize: 24, fontWeight: '700', color: Colors.primaryText },
  name: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  email: { fontSize: FontSize.sm, color: Colors.text3 },
  cardTitle: { fontSize: FontSize.sm, color: Colors.text3, marginBottom: Spacing.sm },
  points: { fontSize: 36, fontWeight: '700', color: Colors.primary },
  hint: { fontSize: FontSize.sm, color: Colors.text3, marginTop: Spacing.sm },
  logoutBtn: {
    marginTop: Spacing.lg,
    height: 50,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.error,
  },
  logoutText: { color: Colors.error, fontSize: FontSize.lg, fontWeight: '600' },
});
