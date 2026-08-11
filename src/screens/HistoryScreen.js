/**
 * 历史记录 Tab
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, Image, StyleSheet,
  RefreshControl, TouchableOpacity, Alert,
} from 'react-native';
import { Colors, FontSize, Spacing, BorderRadius } from '../Theme';
import * as api from '../api/api';

export default function HistoryScreen() {
  const [records, setRecords] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

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

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      {item.result_url && (
        <Image
          source={{ uri: api.getImageUrl(item.result_url) }}
          style={styles.image}
          resizeMode="cover"
        />
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
});
