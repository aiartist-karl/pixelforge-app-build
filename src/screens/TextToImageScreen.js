/**
 * 文生图 Tab
 */
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Image, Alert, ActivityIndicator,
} from 'react-native';
import { Colors, FontSize, Spacing, BorderRadius } from '../Theme';
import * as api from '../api/api';

const COST = 150;

export default function TextToImageScreen({ profile, onUpdateProfile }) {
  const [prompt, setPrompt] = useState('');
  const [negPrompt, setNegPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [polling, setPolling] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      Alert.alert('提示', '请输入画面描述');
      return;
    }
    if (profile?.points < COST) {
      Alert.alert('积分不足', `文生图需要 ${COST} 积分，当前剩余 ${profile?.points || 0}`);
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const { data, status } = await api.generateImage({ prompt: prompt.trim(), negativePrompt: negPrompt.trim() });

      if (status !== 200 || data.error) {
        Alert.alert('生成失败', data.error || '请求失败');
        setLoading(false);
        return;
      }

      // 更新积分
      if (data.points_left !== undefined) {
        onUpdateProfile({ ...profile, points: data.points_left });
      }

      // 如果直接返回了图片 URL
      if (data.imageUrl) {
        setResult({ type: 'image', url: api.getImageUrl(data.imageUrl), status: 'COMPLETED' });
        setLoading(false);
        return;
      }

      // 否则需要轮询
      if (data.id) {
        setLoading(false);
        setPolling(true);
        pollStatus(data.id);
      } else {
        setLoading(false);
      }
    } catch (e) {
      Alert.alert('错误', '网络异常');
      setLoading(false);
    }
  };

  const pollStatus = async (razId) => {
    let attempts = 0;
    const maxAttempts = 60; // 最多轮询 3 分钟 (3s * 60)
    const interval = setInterval(async () => {
      attempts++;
      try {
        const { data } = await api.getGenerationStatus(razId);
        const status = data?.metadata?.generationStatus || data?.generationStatus;
        if (status === 'COMPLETED') {
          clearInterval(interval);
          setPolling(false);
          const imgPath = data.imageUrl || '';
          setResult({ type: 'image', url: api.getImageUrl(imgPath), status: 'COMPLETED' });
        } else if (status === 'FAILED') {
          clearInterval(interval);
          setPolling(false);
          Alert.alert('生成失败', '图片生成失败，积分已退还');
          const { data: prof } = await api.getProfile();
          onUpdateProfile(prof);
        }
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          setPolling(false);
          Alert.alert('超时', '生成时间过长，请在历史记录中查看');
        }
      } catch (e) {
        // 忽略单次轮询错误
      }
    }, 3000);
  };

  const isWorking = loading || polling;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 描述输入 */}
      <Text style={styles.label}>画面描述</Text>
      <TextInput
        style={styles.promptInput}
        placeholder="描述你想要的画面..."
        placeholderTextColor={Colors.text3}
        value={prompt}
        onChangeText={setPrompt}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />

      {/* 反向提示词 */}
      <Text style={styles.label}>反向提示词（可选）</Text>
      <TextInput
        style={[styles.promptInput, { height: 60 }]}
        placeholder="不想出现的元素..."
        placeholderTextColor={Colors.text3}
        value={negPrompt}
        onChangeText={setNegPrompt}
        multiline
      />

      {/* 生成按钮 */}
      <TouchableOpacity
        style={[styles.btn, styles.btnPrimary, isWorking && styles.btnDisabled]}
        onPress={handleGenerate}
        disabled={isWorking}
      >
        {isWorking ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>生成  ·  {COST} 积分</Text>
        )}
      </TouchableOpacity>

      {/* 结果展示 */}
      {result && result.url && (
        <View style={styles.resultWrap}>
          <Text style={styles.resultLabel}>生成结果</Text>
          <Image
            source={{ uri: result.url }}
            style={styles.resultImage}
            resizeMode="contain"
          />
        </View>
      )}

      {polling && (
        <View style={styles.pollingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.pollingText}>正在生成中，请稍候...</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.md },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text2,
    marginBottom: 6,
    marginTop: Spacing.md,
  },
  promptInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
    backgroundColor: Colors.surface,
    height: 100,
  },
  btn: {
    height: 50,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  btnPrimary: { backgroundColor: Colors.primary },
  btnText: { color: Colors.primaryText, fontSize: FontSize.lg, fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },
  resultWrap: { marginTop: Spacing.lg },
  resultLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text2, marginBottom: 8 },
  resultImage: {
    width: '100%',
    height: 300,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
  },
  pollingWrap: {
    alignItems: 'center',
    marginTop: Spacing.lg,
    padding: Spacing.lg,
  },
  pollingText: {
    marginTop: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text3,
  },
});
