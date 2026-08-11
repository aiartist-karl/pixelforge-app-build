/**
 * 图生视频 Tab
 */
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Image, Alert, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors, FontSize, Spacing, BorderRadius } from '../Theme';
import * as api from '../api/api';

const COST = 5000;

export default function ImageToVideoScreen({ profile, onUpdateProfile }) {
  const [prompt, setPrompt] = useState('');
  const [imageUri, setImageUri] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [polling, setPolling] = useState(false);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('权限不足', '请在系统设置中允许访问相册');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });
    if (!res.canceled && res.assets?.[0]) {
      setImageUri(res.assets[0].uri);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      Alert.alert('提示', '请输入动作描述');
      return;
    }
    if (!imageUri) {
      Alert.alert('提示', '请上传参考图片');
      return;
    }
    if (profile?.points < COST) {
      Alert.alert('积分不足', `图生视频需要 ${COST} 积分，当前剩余 ${profile?.points || 0}`);
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const { data, status } = await api.generateVideo({
        prompt: prompt.trim(),
        imageUri,
      });

      if (status !== 200 || data.error) {
        Alert.alert('生成失败', data.error || '请求失败');
        setLoading(false);
        return;
      }

      if (data.points_left !== undefined) {
        onUpdateProfile({ ...profile, points: data.points_left });
      }

      // 视频生成需要轮询
      const razId = data.id || data.recordId;
      if (razId) {
        setLoading(false);
        setPolling(true);
        pollVideoStatus(razId);
      } else {
        // 直接返回了视频 URL
        if (data.videoUrl) {
          setResult({ type: 'video', url: api.getVideoUrl(data.videoUrl) });
        }
        setLoading(false);
      }
    } catch (e) {
      Alert.alert('错误', '网络异常');
      setLoading(false);
    }
  };

  const pollVideoStatus = async (razId) => {
    let attempts = 0;
    const maxAttempts = 120; // 视频生成更久，最多 6 分钟
    const interval = setInterval(async () => {
      attempts++;
      try {
        // 查活跃任务
        const { data: activeData } = await api.request('/api/work-active', { method: 'GET' });
        const activeList = Array.isArray(activeData) ? activeData : [];
        const { data: doneData } = await api.request('/api/work-records', { method: 'GET' });
        const doneList = Array.isArray(doneData) ? doneData : [];

        // 在活跃任务中查找
        let found = null;
        for (const t of activeList) {
          if (t.id === razId || t.type === 'I2V_VIDEO') {
            const vUrl = t.payload?.videoUrl;
            if (vUrl) { found = t; break; }
          }
        }
        // 在已完成中查找
        if (!found) {
          for (const t of doneList) {
            if (t.id === razId) { found = t; break; }
          }
        }

        if (found) {
          const vUrl = found.payload?.videoUrl;
          const gst = found.payload?.metadata?.generationStatus;
          if (vUrl) {
            clearInterval(interval);
            setPolling(false);
            setResult({ type: 'video', url: api.getVideoUrl(vUrl) });
          } else if (gst === 'FAILED') {
            clearInterval(interval);
            setPolling(false);
            Alert.alert('生成失败', '视频生成失败，积分已退还');
            const { data: prof } = await api.getProfile();
            onUpdateProfile(prof);
          }
        }

        if (attempts >= maxAttempts) {
          clearInterval(interval);
          setPolling(false);
          Alert.alert('超时', '视频生成时间较长，请在历史记录中查看');
        }
      } catch (e) { /* ignore */ }
    }, 5000);
  };

  const isWorking = loading || polling;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 图片选择 */}
      <Text style={styles.label}>参考图片</Text>
      <TouchableOpacity style={styles.pickBtn} onPress={pickImage}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
        ) : (
          <>
            <Text style={styles.pickBtnIcon}>🖼</Text>
            <Text style={styles.pickBtnText}>选择一张图片作为视频起始帧</Text>
          </>
        )}
      </TouchableOpacity>

      {imageUri && (
        <TouchableOpacity style={styles.removeTag} onPress={() => setImageUri(null)}>
          <Text style={styles.removeTagText}>重新选择</Text>
        </TouchableOpacity>
      )}

      {/* 动作描述 */}
      <Text style={styles.label}>动作描述</Text>
      <TextInput
        style={styles.promptInput}
        placeholder="描述你希望图片中的主体做什么动作..."
        placeholderTextColor={Colors.text3}
        value={prompt}
        onChangeText={setPrompt}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />

      {/* 按钮 */}
      <TouchableOpacity
        style={[styles.btn, styles.btnPrimary, isWorking && styles.btnDisabled]}
        onPress={handleGenerate}
        disabled={isWorking}
      >
        {isWorking ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>生成视频  ·  {COST} 积分</Text>
        )}
      </TouchableOpacity>

      {/* 结果 */}
      {result && result.url && (
        <View style={styles.resultWrap}>
          <Text style={styles.resultLabel}>生成结果</Text>
          {/* RN 不支持直接播放远程视频 without Video 组件，这里显示提示 */}
          <View style={styles.videoPlaceholder}>
            <Text style={styles.videoIcon}>▶</Text>
            <Text style={styles.videoHint}>视频已生成</Text>
            <Text style={styles.videoUrl} numberOfLines={2}>{result.url}</Text>
          </View>
        </View>
      )}

      {polling && (
        <View style={styles.pollingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.pollingText}>正在生成视频，请耐心等待...</Text>
          <Text style={styles.pollingSub}>视频生成通常需要 1-3 分钟</Text>
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
  pickBtn: {
    height: 180,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickBtnIcon: { fontSize: 36, marginBottom: 8 },
  pickBtnText: { fontSize: FontSize.sm, color: Colors.text3 },
  preview: { width: '100%', height: '100%', borderRadius: BorderRadius.md },
  removeTag: {
    alignSelf: 'center',
    marginTop: Spacing.sm,
    paddingVertical: 4,
    paddingHorizontal: Spacing.md,
  },
  removeTagText: { fontSize: FontSize.sm, color: Colors.info },
  promptInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
    backgroundColor: Colors.surface,
    height: 80,
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
  videoPlaceholder: {
    height: 200,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  videoIcon: { fontSize: 40, marginBottom: 8 },
  videoHint: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  videoUrl: { fontSize: FontSize.xs, color: Colors.text3, textAlign: 'center' },
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
  pollingSub: {
    marginTop: 4,
    fontSize: FontSize.sm,
    color: Colors.text3,
  },
});
