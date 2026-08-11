/**
 * 我的 Tab — 个人信息 + 卡密充值
 */
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert,
} from 'react-native';
import { Colors, FontSize, Spacing, BorderRadius } from '../Theme';
import * as api from '../api/api';

export default function ProfileScreen({ profile, onUpdateProfile, onLogout }) {
  const [cardCode, setCardCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  const handleRedeem = async () => {
    if (!cardCode.trim()) {
      Alert.alert('提示', '请输入卡密');
      return;
    }
    setRedeeming(true);
    try {
      const { data, status } = await api.redeemCard(cardCode.trim());
      if (status === 200) {
        Alert.alert('充值成功', `获得 ${data.added} 积分，当前余额 ${data.points}`);
        onUpdateProfile({ ...profile, points: data.points });
        setCardCode('');
      } else {
        Alert.alert('充值失败', data.error || '卡密无效');
      }
    } catch (e) {
      Alert.alert('错误', '网络异常');
    } finally {
      setRedeeming(false);
    }
  };

  const handleRefresh = async () => {
    try {
      const { data } = await api.getProfile();
      onUpdateProfile(data);
      Alert.alert('已刷新', `当前积分：${data.points}`);
    } catch (e) {
      Alert.alert('刷新失败', '网络异常');
    }
  };

  const handleLogoutConfirm = () => {
    Alert.alert('退出登录', '确定要退出吗？', [
      { text: '取消', style: 'cancel' },
      { text: '退出', style: 'destructive', onPress: onLogout },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 用户信息卡 */}
      <View style={styles.card}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(profile?.email || 'U')[0].toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={styles.email}>{profile?.email || ''}</Text>

        <View style={styles.pointsRow}>
          <Text style={styles.pointsLabel}>当前积分</Text>
          <Text style={styles.pointsValue}>{profile?.points ?? 0}</Text>
        </View>

        <TouchableOpacity style={styles.refreshBtn} onPress={handleRefresh}>
          <Text style={styles.refreshBtnText}>刷新积分</Text>
        </TouchableOpacity>
      </View>

      {/* 卡密充值 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>卡密充值</Text>
        <TextInput
          style={styles.input}
          placeholder="输入卡密，如 PF-XXXXXXXXXXXX"
          placeholderTextColor={Colors.text3}
          value={cardCode}
          onChangeText={setCardCode}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary, redeeming && styles.btnDisabled]}
          onPress={handleRedeem}
          disabled={redeeming}
        >
          <Text style={styles.btnText}>{redeeming ? '兑换中...' : '兑换'}</Text>
        </TouchableOpacity>
      </View>

      {/* 定价说明 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>积分定价</Text>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>文生图</Text>
          <Text style={styles.priceValue}>150 积分</Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>图生图</Text>
          <Text style={styles.priceValue}>500 积分</Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>图生视频</Text>
          <Text style={styles.priceValue}>5,000 积分</Text>
        </View>
      </View>

      {/* 退出 */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogoutConfirm}>
        <Text style={styles.logoutText}>退出登录</Text>
      </TouchableOpacity>

      <Text style={styles.version}>PixelForge AI v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  avatarWrap: { alignItems: 'center', marginBottom: Spacing.md },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: Colors.primaryText,
    fontSize: 28,
    fontWeight: '700',
  },
  email: {
    textAlign: 'center',
    fontSize: FontSize.md,
    color: Colors.text,
    fontWeight: '500',
    marginBottom: Spacing.md,
  },
  pointsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  pointsLabel: { fontSize: FontSize.md, color: Colors.text2 },
  pointsValue: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  refreshBtn: {
    marginTop: Spacing.md,
    alignItems: 'center',
    padding: Spacing.sm,
  },
  refreshBtnText: { fontSize: FontSize.sm, color: Colors.info },

  cardTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
    backgroundColor: Colors.bg,
    marginBottom: Spacing.md,
  },
  btn: {
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnPrimary: { backgroundColor: Colors.primary },
  btnText: { color: Colors.primaryText, fontSize: FontSize.md, fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },

  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  priceLabel: { fontSize: FontSize.md, color: Colors.text2 },
  priceValue: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },

  logoutBtn: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  logoutText: { fontSize: FontSize.md, color: Colors.error },

  version: {
    textAlign: 'center',
    fontSize: FontSize.xs,
    color: Colors.text3,
    marginTop: Spacing.lg,
  },
});
