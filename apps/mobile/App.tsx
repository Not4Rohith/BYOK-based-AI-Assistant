import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, SafeAreaView, StatusBar, TextInput } from 'react-native';
import { Task } from '@ai-task-manager/shared-types';
import { mobileStorage } from './src/services/mobileStorage';

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'starred' | 'today'>('all');
  const [quickTitle, setQuickTitle] = useState('');
  const [showCompleted, setShowCompleted] = useState(true);

  useEffect(() => {
    mobileStorage.getTasks().then(setTasks);
  }, []);

  const handleToggle = (id: string) => {
    mobileStorage.toggleTask(id).then(setTasks);
  };

  const handleAddTask = () => {
    if (!quickTitle.trim()) return;
    mobileStorage.addTask(quickTitle.trim()).then((updated) => {
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
    return true;
  });

  const completedTasks = tasks.filter((t) => t.status === 'completed');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f1117" />

      {/* Google Tasks Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>✓</Text>
          </View>
          <Text style={styles.headerTitle}>Tasks</Text>
        </View>

        {/* Tab Filters */}
        <View style={styles.tabRow}>
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
        </View>
      </View>

      <ScrollView style={styles.content}>
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
                </View>
              </View>

              <TouchableOpacity
                onPress={() => {
                  const updated = tasks.map((t) => (t._id === task._id ? { ...t, starred: !t.starred } : t));
                  setTasks(updated);
                }}
              >
                <Text style={[styles.starIcon, task.starred && styles.starActive]}>
                  {task.starred ? '★' : '☆'}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}

          {activeTasks.length === 0 && (
            <Text style={styles.emptyText}>No tasks yet. Enter "Add a task" above.</Text>
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
                <TouchableOpacity key={task._id} style={styles.taskCardDone} onPress={() => handleToggle(task._id)}>
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
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  logoBadge: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  headerTitle: { color: '#f8fafc', fontSize: 20, fontWeight: 'bold' },
  tabRow: { flexDirection: 'row', gap: 8 },
  tabChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#1e293b' },
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
  taskCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#181b24', padding: 14, borderRadius: 12, borderLineWidth: 1, borderColor: '#262a36' },
  taskLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  checkboxIcon: { color: '#64748b', fontSize: 16 },
  taskTextContainer: { flex: 1 },
  taskTitle: { color: '#f8fafc', fontSize: 14, fontWeight: '500' },
  dateSubtext: { color: '#3b82f6', fontSize: 11, marginTop: 2 },
  starIcon: { color: '#64748b', fontSize: 18 },
  starActive: { color: '#f59e0b' },
  emptyText: { color: '#64748b', fontSize: 12, textAlign: 'center', marginVertical: 20 },
  completedSection: { marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#1e293b' },
  completedHeader: { marginBottom: 10 },
  completedTitle: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  taskCardDone: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, opacity: 0.6 },
  checkboxDone: { color: '#10b981', fontSize: 14, fontWeight: 'bold' },
  taskDoneTitle: { color: '#94a3b8', fontSize: 14, textDecorationLine: 'line-through' },
});
