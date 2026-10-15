import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TextInput,
  RefreshControl,
  Alert,
} from 'react-native';
import { Task, TaskList } from '@ai-task-manager/shared-types';
import { mobileStorage } from './src/services/mobileStorage';

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskLists, setTaskLists] = useState<TaskList[]>([]);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [quickTitle, setQuickTitle] = useState('');
  const [showCompleted, setShowCompleted] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  const loadData = async () => {
    try {
      const [fetchedTasks, fetchedLists] = await Promise.all([
        mobileStorage.getTasks(),
        mobileStorage.getTaskLists(),
      ]);
      setTasks(fetchedTasks);
      setTaskLists(fetchedLists);
      setIsOnline(mobileStorage.getOnlineStatus());
    } catch {
      // offline fallback
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleToggle = (id: string) => {
    mobileStorage.toggleTask(id).then(setTasks);
  };

  const handleToggleStar = (id: string) => {
    mobileStorage.toggleStar(id).then(setTasks);
  };

  const handleDeleteTask = (id: string, title: string) => {
    Alert.alert(
      'Delete Task',
      `Delete "${title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => mobileStorage.deleteTask(id).then(setTasks),
        },
      ]
    );
  };

  const handleAddTask = () => {
    if (!quickTitle.trim()) return;
    const targetListId = activeTab !== 'all' && activeTab !== 'starred' && activeTab !== 'today'
      ? activeTab
      : undefined;

    mobileStorage.addTask(quickTitle.trim(), targetListId).then((updated) => {
      setTasks(updated);
      setQuickTitle('');
    });
  };

  const activeTasks = tasks.filter((t) => {
    if (t.status === 'completed') return false;
    if (activeTab === 'starred') return !!t.starred;
    if (activeTab === 'today') {
      if (!t.scheduledStart) return true;
      const today = new Date().toISOString().substring(0, 10);
      return t.scheduledStart.startsWith(today);
    }
    if (activeTab !== 'all') {
      if (t.listId === activeTab) return true;
      if ((!t.listId || !taskLists.some((tl) => tl._id === t.listId)) && activeTab === taskLists[0]?._id) {
        return true;
      }
      return false;
    }
    return true;
  });

  const completedTasks = tasks.filter((t) => {
    if (t.status !== 'completed') return false;
    if (activeTab === 'starred') return !!t.starred;
    if (activeTab !== 'all' && activeTab !== 'today') {
      if (t.listId === activeTab) return true;
      if ((!t.listId || !taskLists.some((tl) => tl._id === t.listId)) && activeTab === taskLists[0]?._id) {
        return true;
      }
      return false;
    }
    return true;
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f1117" />

      {/* Google Tasks Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>✓</Text>
          </View>
          <Text style={styles.headerTitle}>Google Tasks</Text>

          {/* Connectivity Pill */}
          <View style={[styles.statusBadge, isOnline ? styles.statusOnline : styles.statusOffline]}>
            <View style={[styles.statusDot, isOnline ? styles.dotOnline : styles.dotOffline]} />
            <Text style={styles.statusText}>{isOnline ? 'Synced' : 'Offline'}</Text>
          </View>
        </View>

        {/* Tab Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
          <TouchableOpacity
            style={[styles.tabChip, activeTab === 'all' && styles.activeTabChip]}
            onPress={() => setActiveTab('all')}
          >
            <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>My Tasks</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabChip, activeTab === 'starred' && styles.activeTabChip]}
            onPress={() => setActiveTab('starred')}
          >
            <Text style={[styles.tabText, activeTab === 'starred' && styles.activeTabText]}>Starred ★</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabChip, activeTab === 'today' && styles.activeTabChip]}
            onPress={() => setActiveTab('today')}
          >
            <Text style={[styles.tabText, activeTab === 'today' && styles.activeTabText]}>Today</Text>
          </TouchableOpacity>
          {taskLists.map((list) => (
            <TouchableOpacity
              key={list._id}
              style={[styles.tabChip, activeTab === list._id && styles.activeTabChip]}
              onPress={() => setActiveTab(list._id)}
            >
              <Text style={[styles.tabText, activeTab === list._id && styles.activeTabText]}>
                {list.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D0BCFF" />}
      >
        {/* Quick Inline Task Creator */}
        <View style={styles.inputRow}>
          <Text style={styles.plusIcon}>+</Text>
          <TextInput
            style={styles.input}
            placeholder="Add a task"
            placeholderTextColor="#64748b"
            value={quickTitle}
            onChangeText={setQuickTitle}
            onSubmitEditing={handleAddTask}
          />
          {quickTitle.trim().length > 0 && (
            <TouchableOpacity style={styles.saveBtn} onPress={handleAddTask}>
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Active Task Items */}
        <View style={styles.taskList}>
          {activeTasks.map((task) => (
            <TouchableOpacity
              key={task._id}
              style={styles.taskCard}
              onPress={() => handleToggle(task._id)}
              onLongPress={() => handleDeleteTask(task._id, task.title)}
            >
              <View style={styles.taskLeft}>
                <Text style={styles.checkboxIcon}>○</Text>
                <View style={styles.taskTextContainer}>
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  {task.scheduledStart && (
                    <Text style={styles.dateSubtext}>
                      {new Date(task.scheduledStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                  )}
                  {task.subtasks && task.subtasks.length > 0 && (
                    <Text style={styles.subtaskCounter}>
                      ↳ {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length} subtasks
                    </Text>
                  )}
                </View>
              </View>

              <TouchableOpacity
                onPress={() => handleToggleStar(task._id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={[styles.starIcon, task.starred && styles.starActive]}>
                  {task.starred ? '★' : '☆'}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}

          {activeTasks.length === 0 && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No tasks here yet. Tap "+" above to create one.</Text>
            </View>
          )}
        </View>

        {/* Collapsible Completed Tasks */}
        {completedTasks.length > 0 && (
          <View style={styles.completedSection}>
            <TouchableOpacity style={styles.completedHeader} onPress={() => setShowCompleted(!showCompleted)}>
              <Text style={styles.completedTitle}>
                {showCompleted ? '▼' : '▶'} Completed ({completedTasks.length})
              </Text>
            </TouchableOpacity>

            {showCompleted &&
              completedTasks.map((task) => (
                <TouchableOpacity
                  key={task._id}
                  style={styles.taskCardDone}
                  onPress={() => handleToggle(task._id)}
                  onLongPress={() => handleDeleteTask(task._id, task.title)}
                >
                  <Text style={styles.checkboxDone}>✓</Text>
                  <Text style={styles.taskDoneTitle}>{task.title}</Text>
                </TouchableOpacity>
              ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f1117' },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  logoBadge: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  logoText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  headerTitle: { color: '#f8fafc', fontSize: 20, fontWeight: 'bold', flex: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  statusOnline: { backgroundColor: 'rgba(16, 185, 129, 0.15)' },
  statusOffline: { backgroundColor: 'rgba(148, 163, 184, 0.15)' },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  dotOnline: { backgroundColor: '#10b981' },
  dotOffline: { backgroundColor: '#94a3b8' },
  statusText: { color: '#94a3b8', fontSize: 10, fontWeight: '600' },
  tabScroll: { flexDirection: 'row', marginTop: 4 },
  tabChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#1e293b', marginRight: 8 },
  activeTabChip: { backgroundColor: '#2563eb' },
  tabText: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  activeTabText: { color: '#ffffff' },
  content: { flex: 1, padding: 16 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 },
  plusIcon: { color: '#3b82f6', fontSize: 18, marginRight: 8, fontWeight: 'bold' },
  input: { flex: 1, color: '#f8fafc', fontSize: 14 },
  saveBtn: { backgroundColor: '#2563eb', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  saveBtnText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
  taskList: { gap: 8 },
  taskCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#181b24', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#262a36' },
  taskLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  checkboxIcon: { color: '#64748b', fontSize: 16 },
  taskTextContainer: { flex: 1 },
  taskTitle: { color: '#f8fafc', fontSize: 14, fontWeight: '500' },
  dateSubtext: { color: '#3b82f6', fontSize: 11, marginTop: 2 },
  subtaskCounter: { color: '#a78bfa', fontSize: 10, marginTop: 2 },
  starIcon: { color: '#64748b', fontSize: 18 },
  starActive: { color: '#f59e0b' },
  emptyContainer: { paddingVertical: 32, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#64748b', fontSize: 12, textAlign: 'center' },
  completedSection: { marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#1e293b' },
  completedHeader: { marginBottom: 10 },
  completedTitle: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  taskCardDone: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, opacity: 0.6 },
  checkboxDone: { color: '#10b981', fontSize: 14, fontWeight: 'bold' },
  taskDoneTitle: { color: '#94a3b8', fontSize: 14, textDecorationLine: 'line-through' },
});
