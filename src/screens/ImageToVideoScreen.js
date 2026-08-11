/**
 * 图生视频 Tab — 暂未对接
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontSize, Spacing } from '../Theme';

export default function ImageToVideoScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>🚧</Text>
        <Text style={styles.title}>功能开发中</Text>
        <Text style={styles.desc}>图生视频功能正在对接中，敬请期待...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  icon: { fontSize: 48, marginBottom: Spacing.md },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  desc: {
    fontSize: FontSize.md,
    color: Colors.text3,
    textAlign: 'center',
  },
});
