/**
 * 历史记录 Tab — 支持查看大图(双指缩放)、单条删除、一键清空、用户隔离
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, Image, StyleSheet,
  RefreshControl, TouchableOpacity, Alert, Modal, Share, Platform,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, FontSize, Spacing, BorderRadius } from '../Theme';
import * as api from '../api/api';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

const DELETED_KEY_PREFIX = '@pixelforge:deleted_history:';

export default function HistoryScreen() {
  const [records, setRecords] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const user = await AsyncStorage.getItem('@pixelforge:user');
        const parsed = user ? JSON.parse(user) : null;
        const uid = parsed?.userId || 'anonymous';
        setCurrentUserId(uid);
      } catch (e) {
        setCurrentUserId('anonymous');
      }
    })();
  }, []);

  const getDeletedKey = () => `${DELETED_KEY_PREFIX}${currentUserId || 'anonymous'}`;

  const loadDeletedIds = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(getDeletedKey());
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  }, [currentUserId]);

  const saveDeletedIds = useCallback(async (set) => {
    try {
      await AsyncStorage.setItem(getDeletedKey(), JSON.stringify([...set]));
    } catch (e) {
      console.warn('save deleted ids failed:', e);
    }
  }, [currentUserId]);

  const loadHistory = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data } = await api.getHistory();
      let list = Array.isArray(data) ? data : [];
      const deleted = await loadDeletedIds();
      if (deleted.size > 0) {
        list = list.filter(r => !deleted.has(r.id));
      }
      setRecords(list);
    } catch (e) {
      console.error('Load history failed:', e);
    } finally {
      setRefreshing(false);
    }
  }, [loadDeletedIds]);

  useEffect(() => {
    if (currentUserId) loadHistory();
  }, [currentUserId, loadHistory]);

  const handleDelete = (id) => {
    Alert.alert('删除确认', '确定删除此记录？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteHistory(id);
          } catch (e) {
            console.warn('Backend delete failed:', e);
          }
          const deleted = await loadDeletedIds();
          deleted.add(id);
          await saveDeletedIds(deleted);
          setRecords(prev => prev.filter(r => r.id !== id));
        },
      },
    ]);
  };

  const handleClearAll = () => {
    Alert.alert(
      '清空确认',
      `确定要清空所有历史记录吗？\n\n共 ${records.length} 条记录`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '清空',
          style: 'destructive',
          onPress: async () => {
            let successCount = 0;
            let failCount = 0;
            for (const r of records) {
              try {
                await api.deleteHistory(r.id);
                successCount++;
              } catch (e) {
                failCount++;
              }
            }
            const deleted = await loadDeletedIds();
            records.forEach(r => deleted.add(r.id));
            await saveDeletedIds(deleted);
            setRecords([]);
            Alert.alert('完成', `已删除 ${successCount} 条记录${failCount > 0 ? `，${failCount} 条失败` : ''}`);
          },
        },
      ]
    );
  };

  const handleViewImage = (item) => {
    setSelectedImage(item);
    setModalVisible(true);
  };

  const handleSaveImage = async () => {
    const imgPath = selectedImage?.result_url;
    if (!imgPath) return;
    try {
      const imageUrl = api.getImageUrl(imgPath);
      if (!imageUrl) {
        Alert.alert('错误', '图片 URL 无效');
        return;
      }
      const localUri = FileSystem.cacheDirectory + `pixelforge_${Date.now()}.jpg`;
      const downloadRes = await FileSystem.downloadAsync(imageUrl, localUri);
      if (!downloadRes.uri || downloadRes.status !== 200) {
        Alert.alert('错误', '图片下载失败');
        return;
      }
      if (Platform.OS === 'ios') {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('权限不足', '需要相册权限才能保存图片');
          return;
        }
        await MediaLibrary.saveToLibraryAsync(downloadRes.uri);
        Alert.alert('已保存', '图片已保存到相册');
      } else {
        await Share.share({
          url: downloadRes.uri,
          message: `PixelForge: ${selectedImage?.prompt}`,
        });
      }
    } catch (e) {
      console.error('Save failed:', e);
      Alert.alert('错误', `保存失败: ${e.message}`);
    }
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedImage(null);
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      {item.result_url && (
        <TouchableOpacity onPress={() => handleViewImage(item)} style={styles.imageContainer}>
          <Image source={{ uri: api.getImageUrl(item.result_url) }} style={styles.image} resizeMode="cover" />
        </TouchableOpacity>
      )}
      <View style={styles.info}>
        <Text style={styles.prompt} numberOfLines={2}>{item.prompt}</Text>
        <View style={styles.meta}>
          <Text style={styles.type}>{item.type === 't2i' ? '文生图' : item.type === 'i2i' ? '图生图' : '图生视频'}</Text>
          <Text style={[styles.status, item.status === 'COMPLETED' ? styles.statusDone : styles.statusPending]}>
            {item.status === 'COMPLETED' ? '已完成' : '生成中'}
          </Text>
        </View>
      </View>
      <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
        <Text style={styles.deleteText}>×</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {records.length > 0 && (
        <View style={styles.actionBar}>
          <Text style={styles.recordCount}>共 {records.length} 条记录</Text>
          <TouchableOpacity style={styles.clearAllBtn} onPress={handleClearAll}>
            <Text style={styles.clearAllText}>🗑 一键清空</Text>
          </TouchableOpacity>
        </View>
      )}
      <FlatList
        data={records}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadHistory} />}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>暂无生成记录</Text></View>}
        contentContainerStyle={records.length === 0 ? styles.emptyContainer : null}
      />
      {/* 全屏预览 Modal — 支持双指缩放 */}
      <Modal visible={modalVisible} transparent={true} animationType="fade" onRequestClose={handleCloseModal}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalCloseBtn} onPress={handleCloseModal}>
            <Text style={styles.modalCloseText}>✕</Text>
          </TouchableOpacity>
          {selectedImage?.result_url && (
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
                source={{ uri: api.getImageUrl(selectedImage.result_url) }}
                style={styles.fullImage}
                resizeMode="contain"
              />
            </ScrollView>
          )}
          <View style={styles.modalInfo}>
            {selectedImage?.prompt && (
              <Text style={styles.modalPrompt} numberOfLines={3}>{selectedImage?.prompt}</Text>
            )}
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveImage}>
              <Text style={styles.saveBtnText}>💾 分享/保存</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  emptyContainer: { flex: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: FontSize.md, color: Colors.text3 },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  recordCount: { fontSize: FontSize.sm, color: Colors.text2, fontWeight: '600' },
  clearAllBtn: {
    backgroundColor: Colors.error,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  clearAllText: { color: '#fff', fontSize: FontSize.sm, fontWeight: '600' },
  card: {
    flexDirection: 'row',
    margin: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    alignItems: 'center',
  },
  imageContainer: { width: 80, height: 80 },
  image: { width: 80, height: 80 },
  info: { flex: 1, padding: Spacing.sm },
  prompt: { fontSize: FontSize.md, color: Colors.text, marginBottom: 4 },
  meta: { flexDirection: 'row', alignItems: 'center' },
  type: { fontSize: FontSize.xs, color: Colors.text3, marginRight: Spacing.sm },
  status: { fontSize: FontSize.xs, fontWeight: '600' },
  statusDone: { color: '#34C759' },
  statusPending: { color: '#FF9500' },
  deleteBtn: { padding: Spacing.md },
  deleteText: { fontSize: 20, color: Colors.error },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
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
  modalCloseText: { fontSize: 24, color: '#fff', fontWeight: 'bold' },
  zoomScroll: {
    width: '100%',
    height: '55%',
  },
  zoomContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: { width: '100%', height: '100%' },
  modalInfo: { width: '90%', marginTop: Spacing.lg, alignItems: 'center' },
  modalPrompt: { fontSize: FontSize.md, color: '#fff', textAlign: 'center', marginBottom: Spacing.md },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  saveBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '600' },
});
