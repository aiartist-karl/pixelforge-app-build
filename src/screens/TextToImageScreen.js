/**
 * 文生图 Tab — 分辨率选择 + 多结果网格 + Modal 双指缩放预览
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Image, Alert, ActivityIndicator,
  FlatList, Modal, Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, FontSize, Spacing, BorderRadius } from '../Theme';
import * as api from '../api/api';

const STORAGE_KEY = '@pixelforge:t2i_results';
const MAX_RESULTS = 20;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 8;
const CARD_SIZE = (SCREEN_WIDTH - GRID_GAP * 3) / 2;

// 分辨率选项（3档，竖屏+横屏，300/400/500积分）
const RESOLUTIONS = [
  { label: '768×1024',  width: 768,  height: 1024, cost: 300, tag: '竖' },
  { label: '1024×768',  width: 1024, height: 768,  cost: 300, tag: '横' },
  { label: '1080×1440', width: 1080, height: 1440, cost: 400, tag: '竖' },
  { label: '1440×1080', width: 1440, height: 1080, cost: 400, tag: '横' },
  { label: '1080×1920', width: 1080, height: 1920, cost: 500, tag: '竖' },
  { label: '1920×1080', width: 1920, height: 1080, cost: 500, tag: '横' },
];

let _idCounter = Date.now();
const genTempId = () => `t2i_${_idCounter++}`;

export default function TextToImageScreen({ profile, onUpdateProfile }) {
  const [prompt, setPrompt] = useState('');
  const [negPrompt, setNegPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [results, setResults] = useState([]);
  const [previewItem, setPreviewItem] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRes, setSelectedRes] = useState(RESOLUTIONS[0]); // 默认 768x1024 竖屏
  const pollingRef = useRef({});

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          setResults(Array.isArray(parsed) ? parsed : []);
        }
      } catch (e) {
        console.warn('Load results failed:', e);
      }
    })();
  }, []);

  const saveResults = async (newResults) => {
    try {
      const trimmed = newResults.slice(0, MAX_RESULTS);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch (e) {
      console.warn('Save results failed:', e);
    }
  };

  const updateResult = (id, updates) => {
    setResults(prev => {
      const next = prev.map(r => r.id === id ? { ...r, ...updates } : r);
      saveResults(next);
      return next;
    });
  };

  const removeResult = (id) => {
    setResults(prev => {
      const next = prev.filter(r => r.id !== id);
      saveResults(next);
      return next;
    });
    if (pollingRef.current[id]) {
      clearInterval(pollingRef.current[id]);
      delete pollingRef.current[id];
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      Alert.alert('提示', '请输入画面描述');
      return;
    }
    const cost = selectedRes.cost;
    if (profile?.points < cost) {
      Alert.alert('积分不足', `当前分辨率需要 ${cost} 积分，剩余 ${profile?.points || 0}`);
      return;
    }

    const tempId = genTempId();
    const placeholder = {
      id: tempId,
      prompt: prompt.trim(),
      status: 'PENDING',
      url: null,
      createdAt: Date.now(),
      resolution: selectedRes.label,
    };
    
    setResults(prev => {
      const next = [placeholder, ...prev];
      saveResults(next);
      return next;
    });

    setLoading(true);
    
    try {
      const { data, status } = await api.generateImage({ 
        prompt: prompt.trim(), 
        negativePrompt: negPrompt.trim() || 'blurry, watermark, low quality',
        width: selectedRes.width,
        height: selectedRes.height,
        pf_cost: cost,
      });

      if (status !== 200 || data.error) {
        Alert.alert('生成失败', data.error || data.message || '请求失败');
        removeResult(tempId);
        setLoading(false);
        return;
      }

      // 先本地扣减显示
      if (profile) {
        onUpdateProfile({ ...profile, points: (profile.points || 0) - cost });
      }

      const recordId = data.id;
      if (recordId) {
        setLoading(false);
        setPolling(true);
        pollStatus(recordId, tempId);
      } else if (data.imageUrl) {
        updateResult(tempId, {
          url: api.getImageUrl(data.imageUrl),
          status: 'COMPLETED',
        });
        setLoading(false);
      } else {
        removeResult(tempId);
        setLoading(false);
        Alert.alert('错误', '未获取到任务 ID');
      }
    } catch (e) {
      console.error('[TextToImage] 错误:', e);
      Alert.alert('错误', '网络异常');
      removeResult(tempId);
      setLoading(false);
    }
  };

  const pollStatus = async (recordId, localId) => {
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
            delete pollingRef.current[localId];
            setPolling(false);
            const imgPath = data.imageUrl || '';
            updateResult(localId, {
              url: api.getImageUrl(imgPath),
              status: 'COMPLETED',
              remoteId: recordId,
            });
            // 从服务器同步最新积分
            const { data: prof } = await api.getProfile();
            if (prof?.points !== undefined) onUpdateProfile(prof);
          } else if (genStatus === 'FAILED') {
            clearInterval(interval);
            delete pollingRef.current[localId];
            setPolling(false);
            removeResult(localId);
            Alert.alert('生成失败', '图片生成失败，积分已退还');
            const { data: prof } = await api.getProfile();
            if (prof?.points !== undefined) onUpdateProfile(prof);
          }
        }
        
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          delete pollingRef.current[localId];
          setPolling(false);
          updateResult(localId, { status: 'TIMEOUT' });
          Alert.alert('超时', '生成时间过长，请稍后在历史记录中查看');
        }
      } catch (e) {
        console.error('[Poll] 错误:', e);
      }
    }, 3000);
    
    pollingRef.current[localId] = interval;
  };

  const handlePreview = (item) => {
    if (item.status === 'COMPLETED' && item.url) {
      setPreviewItem(item);
      setModalVisible(true);
    }
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setPreviewItem(null);
  };

  const isWorking = loading || polling;

  const renderItem = ({ item }) => {
    const isPending = item.status === 'PENDING' || item.status === 'TIMEOUT';
    
    return (
      <View style={styles.gridItem}>
        {isPending || !item.url ? (
          <View style={styles.placeholderCard}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.placeholderText}>
              {item.status === 'TIMEOUT' ? '超时' : '生成中...'}
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.imageCard}
            onPress={() => handlePreview(item)}
          >
            <Image
              source={{ uri: item.url }}
              style={styles.gridImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={() => removeResult(item.id)}
        >
          <Text style={styles.removeText}>×</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.form} contentContainerStyle={styles.formContent}>
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
        <Text style={styles.label}>反向提示词（可选）</Text>
        <TextInput
          style={[styles.promptInput, { height: 60 }]}
          placeholder="不想出现的元素..."
          placeholderTextColor={Colors.text3}
          value={negPrompt}
          onChangeText={setNegPrompt}
          multiline
        />

        {/* 分辨率选择器 */}
        <Text style={styles.label}>输出尺寸</Text>
        <View style={styles.resContainer}>
          {RESOLUTIONS.map((res) => {
            const isActive = selectedRes.label === res.label;
            return (
              <TouchableOpacity
                key={res.label}
                style={[styles.resBtn, isActive && styles.resBtnActive]}
                onPress={() => setSelectedRes(res)}
              >
                <Text style={[styles.resText, isActive && styles.resTextActive]}>
                  {res.label}
                </Text>
                <Text style={[styles.resCost, isActive && styles.resCostActive]}>
                  {res.cost}分
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary, isWorking && styles.btnDisabled]}
          onPress={handleGenerate}
          disabled={isWorking}
        >
          {isWorking ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>生成 · {selectedRes.cost} 积分</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {results.length > 0 && (
        <View style={styles.gridContainer}>
          <Text style={styles.gridLabel}>生成结果 ({results.length})</Text>
          <FlatList
            data={results}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            numColumns={2}
            key={2}
            contentContainerStyle={styles.gridContent}
            columnWrapperStyle={styles.gridRow}
          />
        </View>
      )}

      {/* 全屏预览 Modal — 支持双指缩放 */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalCloseBtn}
            onPress={handleCloseModal}
          >
            <Text style={styles.modalCloseText}>✕</Text>
          </TouchableOpacity>

          {previewItem?.url && (
            <ScrollView
              style={styles.zoomScroll}
              contentContainerStyle={styles.zoomContent}
              maximumZoomScale={4}
              minimumZoomScale={1}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              bounces={true}
              bouncesZoom={true}
              centerContent={true}
            >
              <Image
                source={{ uri: previewItem.url }}
                style={styles.fullImage}
                resizeMode="contain"
              />
            </ScrollView>
          )}

          {previewItem?.prompt && (
            <View style={styles.modalInfo}>
              <Text style={styles.modalPrompt} numberOfLines={3}>
                {previewItem.prompt}
              </Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  form: { maxHeight: '50%' },
  formContent: { padding: Spacing.md },
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
  // 分辨率选择器
  resContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  resBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    minWidth: 80,
  },
  resBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  resText: {
    fontSize: FontSize.sm,
    color: Colors.text2,
    fontWeight: '600',
  },
  resTextActive: {
    color: Colors.primaryText,
  },
  resCost: {
    fontSize: FontSize.xs,
    color: Colors.text3,
    marginTop: 2,
  },
  resCostActive: {
    color: 'rgba(255,255,255,0.8)',
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
  gridContainer: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  gridLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text2,
    padding: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  gridContent: {
    paddingHorizontal: GRID_GAP,
    paddingBottom: Spacing.md,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: GRID_GAP,
  },
  gridItem: {
    width: CARD_SIZE,
    position: 'relative',
  },
  placeholderCard: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    backgroundColor: Colors.bg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    marginTop: Spacing.sm,
    fontSize: FontSize.sm,
    color: Colors.text3,
  },
  imageCard: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  modalCloseText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  zoomScroll: {
    width: '100%',
    height: '65%',
  },
  zoomContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  modalInfo: {
    width: '90%',
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  modalPrompt: {
    fontSize: FontSize.md,
    color: '#fff',
    textAlign: 'center',
  },
});

