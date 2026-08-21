/**
 * 主界面 — 底部 Tab 导航（修复顶部状态栏遮挡）
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Spacing, BorderRadius } from '../Theme';
import TextToImageScreen from './TextToImageScreen';
import ImageToImageScreen from './ImageToImageScreen';
import ImageToVideoScreen from './ImageToVideoScreen';
import HistoryScreen from './HistoryScreen';
import ProfileScreen from './ProfileScreen';

const TABS = [
  { key: 't2i', label: '文生图', icon: '✦' },
  { key: 'i2i', label: '图生图', icon: '◫' },
  { key: 'i2v', label: '图生视频', icon: '▶' },
  { key: 'history', label: '记录', icon: '☰' },
  { key: 'profile', label: '我的', icon: '●' },
];

export default function MainApp({ profile, onUpdateProfile, onLogout }) {
  const [activeTab, setActiveTab] = React.useState('t2i');
  const insets = useSafeAreaInsets();

  const renderTab = () => {
    switch (activeTab) {
      case 't2i':     return <TextToImageScreen profile={profile} onUpdateProfile={onUpdateProfile} />;
      case 'i2i':     return <ImageToImageScreen profile={profile} onUpdateProfile={onUpdateProfile} />;
      case 'i2v':     return <ImageToVideoScreen profile={profile} onUpdateProfile={onUpdateProfile} />;
      case 'history': return <HistoryScreen />;
      case 'profile': return <ProfileScreen profile={profile} onUpdateProfile={onUpdateProfile} onLogout={onLogout} />;
      default:        return null;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} translucent={false} />
      {/* 顶部 Header — 用 paddingTop: insets.top 避开状态栏 */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerLeft}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoText}>P</Text>
          </View>
          <Text style={styles.headerTitle}>PixelForge AI</Text>
        </View>
        <View style={styles.pointsBadge}>
          <Text style={styles.pointsLabel}>积分</Text>
          <Text style={styles.pointsValue}>{profile?.points ?? 0}</Text>
        </View>
      </View>

      {/* 内容区 */}
      <View style={styles.content}>
        {renderTab()}
      </View>

      {/* 底部 Tab Bar */}
      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabItem}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.6}
            >
              <Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>
                {tab.icon}
              </Text>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  logoText: {
    color: Colors.primaryText,
    fontSize: 16,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pointsLabel: {
    fontSize: FontSize.sm,
    color: Colors.text3,
    marginRight: 4,
  },
  pointsValue: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.bg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabIcon: {
    fontSize: 20,
    color: Colors.text3,
    marginBottom: 2,
  },
  tabIconActive: {
    color: Colors.primary,
  },
  tabLabel: {
    fontSize: FontSize.xs,
    color: Colors.text3,
  },
  tabLabelActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
});
