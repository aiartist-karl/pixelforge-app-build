/**
 * 图生图 Tab
 */
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Image, Alert, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors, FontSize, Spacing, BorderRadius } from '../Theme';
import * as api from '../api/api';

const COST = 500;

export default function ImageToImageScreen({ profile, onUpdateProfile }) {
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

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('权限不足', '请在系统设置中允许使用相机');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });
    if (!res.canceled && res.assets?.[0]) {
      setImageUri(res.assets[0].uri);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      Alert.alert('提示', '请输入创作描述');
      return;
    }
    if (!imageUri) {
      Alert.alert('提示', '请上传参考图片');
      return;
    }
    if (profile?.points < COST) {
      Alert.alert('积分不足', `图生图需要 ${COST} 积分，当前剩余 ${profile?.points || 0}`);
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const { data, status } = await api.generateMultiImage({
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

      if (data.imageUrl) {
        setResult({ type: 'image', url: api.getImageUrl(data.imageUrl), status: 'COMPLETED' });
        setLoading(false);
        return;
      }

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
    const maxAttempts = 60;
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
      } catch (e) { /* ignore */ }
    }, 3000);
  };

  const isWorking = loading || polling;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 图片选择 */}
      <Text style={styles.label}>参考图片</Text>
      <View style={styles.imagePickerRow}>
        <TouchableOpacity style={styles.pickBtn} onPress={pickImage}>
          <Text style={styles.pickBtnIcon}>🖼</Text>
          <Text style={styles.pickBtnText}>从相册选择</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.pickBtn} onPress={takePhoto}>
          <Text style={styles.pickBtnIcon}>📷</Text>
          <Text style={styles.pickBtnText}>拍照</Text>
        </TouchableOpacity>
      </View>

      {imageUri && (
        <View style={styles.previewWrap}>
          <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
          <TouchableOpacity style={styles.removeBtn} onPress={() => setImageUri(null)}>
            <Text style={styles.removeBtnText}>×</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 描述 */}
      <Text style={styles.label}>创作描述</Text>
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

      {/* 按钮 */}
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

      {/* 结果 */}
      {result && result.url && (
        <View style={styles.resultWrap}>
          <Text style={styles.resultLabel}>生成结果</Text>
          <Image source={{ uri: result.url }} style={styles.resultImage} resizeMode="contain" />
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
  imagePickerRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  pickBtn: {
    flex: 1,
    height: 80,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickBtnIcon: { fontSize: 24, marginBottom: 4 },
  pickBtnText: { fontSize: FontSize.sm, color: Colors.text2 },
  previewWrap: {
    marginTop: Spacing.md,
    position: 'relative',
    alignSelf: 'center',
  },
  preview: {
    width: 200,
    height: 200,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
  },
  removeBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeBtnText: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: -2 },
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
