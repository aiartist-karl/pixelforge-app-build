/**
 * 图生视频 Tab
 * POST /tools/i2v-video/generate (FormData)
 * 3600 积分/次 · 约90秒出视频
 */
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Image, Alert, ActivityIndicator,
  Linking,
} from 'react-native';
import { Colors, FontSize, Spacing, BorderRadius } from '../Theme';
import * as ImagePicker from 'expo-image-picker';
import * as api from '../api/api';

const COST = 3600;

export default function ImageToVideoScreen({ profile, onUpdateProfile }) {
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState(null); // {uri}
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const [polling, setPolling] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('需要权限', '请允许访问相册以选择图片');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: false,
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!res.canceled && res.assets?.[0]) {
      setImage({ uri: res.assets[0].uri });
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      Alert.alert('提示', '请输入动作描述');
      return;
    }
    if (!image) {
      Alert.alert('提示', '请上传参考图片');
      return;
    }
    if (profile?.points < COST) {
      Alert.alert('积分不足', `图生视频需要 ${COST} 积分，当前剩余 ${profile?.points || 0}`);
      return;
    }

    setLoading(true);
    setVideoUrl(null);
    setElapsed(0);
    try {
      const { data, status } = await api.generateVideo({
        prompt: prompt.trim(),
        imageUri: { uri: image.uri, type: 'image/jpeg', name: `ref_${Date.now()}.jpg` },
      });

      if (status !== 200 || data.error) {
        Alert.alert('生成失败', data.error || data.message || JSON.stringify(data));
        setLoading(false);
        return;
      }

      if (profile) {
        onUpdateProfile({ ...profile, points: (profile.points || 0) - COST });
      }

      // 视频任务提交成功后轮询
      setLoading(false);
      setPolling(true);
      pollVideo();
    } catch (e) {
      console.error('[Video] 错误:', e);
      Alert.alert('错误', '网络异常: ' + e.message);
      setLoading(false);
    }
  };

  const pollVideo = () => {
    let attempts = 0;
    const maxAttempts = 60; // 约 5 分钟
    const startTime = Date.now();

    const interval = setInterval(async () => {
      attempts++;
      setElapsed(Math.round((Date.now() - startTime) / 1000));

      try {
        // 查活跃任务
        const { data: activeList } = await api.getActiveWork();
        const videoTask = Array.isArray(activeList)
          ? activeList.find(t => t.type === 'I2V_VIDEO')
          : null;

        if (videoTask?.payload?.videoUrl) {
          // 视频已完成
          clearInterval(interval);
          setPolling(false);
          const url = videoTask.payload.videoUrl.startsWith('http')
            ? videoTask.payload.videoUrl
            : api.getVideoUrl(videoTask.payload.videoUrl);
          setVideoUrl(url);
          const { data: prof } = await api.getProfile();
          if (prof?.points !== undefined) onUpdateProfile(prof);
          return;
        }

        if (videoTask?.payload?.metadata?.generationStatus === 'FAILED') {
          clearInterval(interval);
          setPolling(false);
          Alert.alert('生成失败', '视频生成失败');
          const { data: prof } = await api.getProfile();
          if (prof?.points !== undefined) onUpdateProfile(prof);
          return;
        }

        // 如果活跃任务里没有视频任务，可能已完成，去 records 查
        if (!videoTask && attempts > 3) {
          const { data: records } = await api.getWorkRecords();
          const completed = Array.isArray(records)
            ? records.find(t => t.type === 'I2V_VIDEO' && t.payload?.videoUrl)
            : null;
          if (completed) {
            clearInterval(interval);
            setPolling(false);
            const url = completed.payload.videoUrl.startsWith('http')
              ? completed.payload.videoUrl
              : api.getVideoUrl(completed.payload.videoUrl);
            setVideoUrl(url);
            const { data: prof } = await api.getProfile();
            if (prof?.points !== undefined) onUpdateProfile(prof);
            return;
          }
        }

        if (attempts >= maxAttempts) {
          clearInterval(interval);
          setPolling(false);
          Alert.alert('超时', '视频生成时间较长，请稍后查看');
        }
      } catch (e) {
        console.error('[VideoPoll] 错误:', e);
      }
    }, 5000);
  };

  const isWorking = loading || polling;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 参考图 */}
      <Text style={styles.label}>参考图片</Text>
      <TouchableOpacity style={styles.uploadBtn} onPress={pickImage}>
        {image ? (
          <Image source={{ uri: image.uri }} style={styles.previewImg} />
        ) : (
          <Text style={styles.uploadBtnText}>点击选择图片</Text>
        )}
      </TouchableOpacity>

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
        {isWorking ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>生成视频 · {COST} 积分</Text>}
      </TouchableOpacity>

      {/* 进度 */}
      {polling && (
        <View style={styles.pollingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.pollingText}>视频生成中... {elapsed}s</Text>
          <Text style={styles.pollingHint}>通常需要 60~90 秒</Text>
        </View>
      )}

      {/* 视频结果 */}
      {videoUrl && (
        <View style={styles.resultWrap}>
          <Text style={styles.resultLabel}>视频生成完成</Text>
          <TouchableOpacity
            style={styles.videoLink}
            onPress={() => Linking.openURL(videoUrl)}
          >
            <Text style={styles.videoLinkText}>点击播放/下载视频</Text>
          </TouchableOpacity>
          <Text style={styles.videoUrl}>{videoUrl}</Text>
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
    overflow: 'hidden',
  },
  uploadBtnText: { fontSize: FontSize.md, color: Colors.text3 },
  previewImg: { width: '100%', height: 200, borderRadius: BorderRadius.sm },
  promptInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md,
    padding: Spacing.md, fontSize: FontSize.md, color: Colors.text,
    backgroundColor: Colors.surface, height: 80,
  },
  btn: {
    height: 50, borderRadius: BorderRadius.md, justifyContent: 'center',
    alignItems: 'center', marginTop: Spacing.lg,
  },
  btnPrimary: { backgroundColor: Colors.primary },
  btnText: { color: Colors.primaryText, fontSize: FontSize.lg, fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },
  pollingWrap: { alignItems: 'center', marginTop: Spacing.lg, padding: Spacing.lg },
  pollingText: { marginTop: Spacing.md, fontSize: FontSize.md, color: Colors.text2 },
  pollingHint: { marginTop: 4, fontSize: FontSize.sm, color: Colors.text3 },
  resultWrap: { marginTop: Spacing.lg },
  resultLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text2, marginBottom: 8 },
  videoLink: {
    padding: Spacing.md, backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md, alignItems: 'center',
  },
  videoLinkText: { fontSize: FontSize.md, color: Colors.info, fontWeight: '600' },
  videoUrl: { fontSize: FontSize.xs, color: Colors.text3, marginTop: 6, textAlign: 'center' },
});
