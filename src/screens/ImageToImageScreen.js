/**
 * 多图生图 Tab
 * POST /tools/multi-image/generate (FormData)
 * 1000 积分/次
 */
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Image, Alert, ActivityIndicator,
} from 'react-native';
import { Colors, FontSize, Spacing, BorderRadius } from '../Theme';
import * as ImagePicker from 'expo-image-picker';
import * as api from '../api/api';

const COST = 1000;

export default function ImageToImageScreen({ profile, onUpdateProfile }) {
  const [prompt, setPrompt] = useState('');
  const [images, setImages] = useState([]); // [{uri, width, height}]
  const [size, setSize] = useState('1024x1024');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [polling, setPolling] = useState(false);

  const pickImages = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('需要权限', '请允许访问相册以选择参考图片');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      selectionLimit: 5,
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!res.canceled && res.assets) {
      setImages(res.assets.map(a => ({ uri: a.uri })));
    }
  };

  const removeImage = (idx) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      Alert.alert('提示', '请输入画面描述');
      return;
    }
    if (images.length === 0) {
      Alert.alert('提示', '请上传至少一张参考图片');
      return;
    }
    if (profile?.points < COST) {
      Alert.alert('积分不足', `多图生图需要 ${COST} 积分，当前剩余 ${profile?.points || 0}`);
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const { data, status } = await api.generateMultiImage({
        prompt: prompt.trim(),
        imageUris: images.map(img => ({ uri: img.uri, type: 'image/jpeg', name: `ref_${Date.now()}.jpg` })),
        size,
        applyWatermark: false,
      });

      if (status !== 200 || data.error) {
        Alert.alert('生成失败', data.error || data.message || JSON.stringify(data));
        setLoading(false);
        return;
      }

      if (profile) {
        onUpdateProfile({ ...profile, points: (profile.points || 0) - COST });
      }

      const recordId = data.id;
      if (recordId) {
        setLoading(false);
        setPolling(true);
        pollStatus(recordId);
      } else {
        setLoading(false);
        Alert.alert('错误', '未获取到任务 ID');
      }
    } catch (e) {
      console.error('[MultiImage] 错误:', e);
      Alert.alert('错误', '网络异常: ' + e.message);
      setLoading(false);
    }
  };

  const pollStatus = async (recordId) => {
    let attempts = 0;
    const maxAttempts = 60;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const { data, status } = await api.getGenerationStatus(recordId);
        if (status === 200) {
          const genStatus = data?.metadata?.generationStatus || data?.generationStatus;
          if (genStatus === 'COMPLETED') {
            clearInterval(interval);
            setPolling(false);
            setResult({ url: api.getImageUrl(data.imageUrl || ''), status: 'COMPLETED' });
            const { data: prof } = await api.getProfile();
            if (prof?.points !== undefined) onUpdateProfile(prof);
          } else if (genStatus === 'FAILED') {
            clearInterval(interval);
            setPolling(false);
            Alert.alert('生成失败', '图片生成失败');
            const { data: prof } = await api.getProfile();
            if (prof?.points !== undefined) onUpdateProfile(prof);
          }
        }
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          setPolling(false);
          Alert.alert('超时', '请稍后在历史记录中查看');
        }
      } catch (e) { /* ignore */ }
    }, 3000);
  };

  const isWorking = loading || polling;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 参考图上传 */}
      <Text style={styles.label}>参考图片（最多5张）</Text>
      <TouchableOpacity style={styles.uploadBtn} onPress={pickImages}>
        <Text style={styles.uploadBtnText}>{images.length > 0 ? `已选 ${images.length} 张，点击更换` : '点击选择图片'}</Text>
      </TouchableOpacity>
      {images.length > 0 && (
        <ScrollView horizontal style={styles.previewRow} showsHorizontalScrollIndicator={false}>
          {images.map((img, idx) => (
            <View key={idx} style={styles.thumbWrap}>
              <Image source={{ uri: img.uri }} style={styles.thumb} />
              <TouchableOpacity style={styles.removeBtn} onPress={() => removeImage(idx)}>
                <Text style={styles.removeText}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Prompt */}
      <Text style={styles.label}>画面描述</Text>
      <TextInput
        style={styles.promptInput}
        placeholder="描述你想要的效果..."
        placeholderTextColor={Colors.text3}
        value={prompt}
        onChangeText={setPrompt}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />

      {/* 尺寸 */}
      <Text style={styles.label}>输出尺寸</Text>
      <View style={styles.sizeRow}>
        {['512x512', '768x768', '1024x1024'].map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.sizeOpt, size === s && styles.sizeOptActive]}
            onPress={() => setSize(s)}
          >
            <Text style={[styles.sizeText, size === s && styles.sizeTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 按钮 */}
      <TouchableOpacity
        style={[styles.btn, styles.btnPrimary, isWorking && styles.btnDisabled]}
        onPress={handleGenerate}
        disabled={isWorking}
      >
        {isWorking ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>生成 · {COST} 积分</Text>}
      </TouchableOpacity>

      {/* 结果 */}
      {result?.url ? (
        <View style={styles.resultWrap}>
          <Text style={styles.resultLabel}>生成结果</Text>
          <Image source={{ uri: result.url }} style={styles.resultImage} resizeMode="contain" />
        </View>
      ) : null}

      {polling && (
        <View style={styles.pollingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.pollingText}>正在生成中...</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.md },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text2, marginBottom: 6, marginTop: Spacing.md },
  uploadBtn: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md,
    padding: Spacing.lg, alignItems: 'center', backgroundColor: Colors.surface,
  },
  uploadBtnText: { fontSize: FontSize.md, color: Colors.text3 },
  previewRow: { marginTop: Spacing.sm, maxHeight: 90 },
  thumbWrap: { marginRight: 8, position: 'relative' },
  thumb: { width: 72, height: 72, borderRadius: 6, backgroundColor: Colors.surface2 },
  removeBtn: {
    position: 'absolute', top: -4, right: -4, width: 20, height: 20,
    borderRadius: 10, backgroundColor: Colors.error, justifyContent: 'center', alignItems: 'center',
  },
  removeText: { color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 18 },
  promptInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md,
    padding: Spacing.md, fontSize: FontSize.md, color: Colors.text,
    backgroundColor: Colors.surface, height: 80,
  },
  sizeRow: { flexDirection: 'row', gap: 8 },
  sizeOpt: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surface,
  },
  sizeOptActive: { borderColor: Colors.primary, backgroundColor: Colors.surface2 },
  sizeText: { fontSize: FontSize.sm, color: Colors.text3 },
  sizeTextActive: { color: Colors.text, fontWeight: '600' },
  btn: {
    height: 50, borderRadius: BorderRadius.md, justifyContent: 'center',
    alignItems: 'center', marginTop: Spacing.lg,
  },
  btnPrimary: { backgroundColor: Colors.primary },
  btnText: { color: Colors.primaryText, fontSize: FontSize.lg, fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },
  resultWrap: { marginTop: Spacing.lg },
  resultLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text2, marginBottom: 8 },
  resultImage: { width: '100%', height: 300, borderRadius: BorderRadius.md, backgroundColor: Colors.surface },
  pollingWrap: { alignItems: 'center', marginTop: Spacing.lg, padding: Spacing.lg },
  pollingText: { marginTop: Spacing.md, fontSize: FontSize.md, color: Colors.text3 },
});

