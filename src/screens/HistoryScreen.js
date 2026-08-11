/**
 * 生成历史 Tab
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, Image, Alert, RefreshControl,
} from 'react-native';
import { Colors, FontSize, Spacing, BorderRadius } from '../Theme';
import * as api from '../api/api';

const TYPE_LABELS = { t2i: '文生图', i2i: '图生图', i2v: '图生视频' };
const STATUS_LABELS = {
  PENDING: '生成中', COMPLETED: '已完成', FAILED: '失败',
};
const STATUS_COLORS = {
  PENDING: Colors.warning, COMPLETED: Colors.success, FAILED: Colors.error,
};

export default function HistoryScreen() {
  const [history, setHistory] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const { data } = await api.getHistory();
      if (Array.isArray(data)) setHistory(data);
    } catch (e) { /* ignore */ }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  const handleDelete = (item) => {
    Alert.alert(
      '确认删除',
      `确定删除这条${TYPE_LABELS[item.type] || ''}记录吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteHistory(item.id);
              setHistory(prev => prev.filter(h => h.id !== item.id));
            } catch (e) {
              Alert.alert('错误', '删除失败');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => {
    const isImage = item.type === 't2i' || item.type === 'i2i';
    const imgUrl = isImage && item.result_url ? api.getImageUrl(item.result_url) : null;

    return (
      <View style={styles.item}>
        {/* 图片缩略图 */}
        {imgUrl && (
          <Image source={{ uri: imgUrl }} style={styles.thumb} resizeMode="cover" />
        )}
        {!imgUrl && (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Text style={styles.thumbIcon}>
              {item.type === 'i2v' ? '▶' : '✦'}
            </Text>
          </View>
        )}

        {/* 信息 */}
        <View style={styles.itemInfo}>
          <View style={styles.itemHeader}>
            <Text style={styles.typeBadge}>{TYPE_LABELS[item.type] || item.type}</Text>
            <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] || Colors.text3 }]}>
              <Text style={styles.statusText}>{STATUS_LABELS[item.status] || item.status}</Text>
            </View>
          </View>
          <Text style={styles.prompt} numberOfLines={2}>{item.prompt || '无描述'}</Text>
          <View style={styles.itemFooter}>
            <Text style={styles.cost}>{item.points_cost} 积分</Text>
            <Text style={styles.time}>{formatTime(item.created_at)}</Text>
          </View>
        </View>

        {/* 删除按钮 */}
        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
          <Text style={styles.deleteBtnText}>×</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={history}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>✦</Text>
            <Text style={styles.emptyText}>还没有生成记录</Text>
          </View>
        }
      />
    </View>
  );
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hour = d.getHours().toString().padStart(2, '0');
    const min = d.getMinutes().toString().padStart(2, '0');
    return `${month}/${day} ${hour}:${min}`;
  } catch {
    return dateStr;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  list: { padding: Spacing.md },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bg,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.md,
  },
  thumbPlaceholder: {
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbIcon: { fontSize: 24, color: Colors.text3 },
  itemInfo: { flex: 1 },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  typeBadge: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.text2,
    marginRight: Spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  prompt: {
    fontSize: FontSize.sm,
    color: Colors.text,
    marginBottom: 4,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cost: { fontSize: FontSize.xs, color: Colors.text3 },
  time: { fontSize: FontSize.xs, color: Colors.text3 },
  deleteBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.sm,
  },
  deleteBtnText: {
    fontSize: 22,
    color: Colors.text3,
    fontWeight: '300',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyIcon: { fontSize: 40, color: Colors.text3, marginBottom: Spacing.md },
  emptyText: { fontSize: FontSize.md, color: Colors.text3 },
});
