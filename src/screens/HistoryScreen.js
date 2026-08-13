/**
 * 历史记录 Tab - 支持查看大图和下载
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, Image, StyleSheet,
  RefreshControl, TouchableOpacity, Alert, Modal, Share, Platform,
} from 'react-native';
import { Colors, FontSize, Spacing, BorderRadius } from '../Theme';
import * as api from '../api/api';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

export default function HistoryScreen() {
  const [records, setRecords] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setRefreshing(true);
    try {
      const { data } = await api.getHistory();
      setRecords(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Load history failed:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDelete = (id) => {
    Alert.alert('删除确认', '确定删除此记录？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          await api.deleteHistory(id);
          setRecords(prev => prev.filter(r => r.id !== id));
        },
      },
    ]);
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
      
      // 先下载图片到本地缓存
      const localUri = FileSystem.cacheDirectory + `pixelforge_${Date.now()}.jpg`;
      const downloadRes = await FileSystem.downloadAsync(imageUrl, localUri);
      
      if (!downloadRes.uri || downloadRes.status !== 200) {
        Alert.alert('错误', '图片下载失败');
        return;
      }

      // iOS: 保存到相册
      if (Platform.OS === 'ios') {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('权限不足', '需要相册权限才能保存图片');
          return;
        }
        await MediaLibrary.saveToLibraryAsync(downloadRes.uri);
        Alert.alert('已保存', '图片已保存到相册');
      } else {
        // Android: 用 Share
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
        <TouchableOpacity 
          onPress={() => handleViewImage(item)}
          style={styles.imageContainer}
        >
          <Image
            source={{ uri: api.getImageUrl(item.result_url) }}
            style={styles.image}
            resizeMode="cover"
          />
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
      <FlatList
        data={records}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadHistory} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>暂无生成记录</Text>
          </View>
        }
        contentContainerStyle={records.length === 0 ? styles.emptyContainer : null}
      />

      {/* 全屏图片预览 Modal */}
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

          {selectedImage?.result_url && (
            <Image
              source={{ uri: api.getImageUrl(selectedImage.result_url) }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          )}

          <View style={styles.modalInfo}>
            <Text style={styles.modalPrompt} numberOfLines={3}>
              {selectedImage?.prompt}
            </Text>
            <TouchableOpacity 
              style={styles.saveBtn}
              onPress={handleSaveImage}
            >
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
  imageContainer: {
    width: 80,
    height: 80,
  },
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
  
  // Modal 样式
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
  fullImage: {
    width: '90%',
    height: '60%',
    borderRadius: BorderRadius.md,
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
    marginBottom: Spacing.md,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: '600',
  },
});
