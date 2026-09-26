import React, { useState, useRef, useEffect } from 'react';
import { Task, TaskList } from '@ai-task-manager/shared-types';
import { GoogleRepeatModal } from './GoogleRepeatModal';
import { GoogleDatePopover } from './GoogleDatePopover';
import {
  Plus,
  MoreVertical,
  Star,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Circle,
  Calendar,
  Clock,
  Repeat,
  Paperclip,
  Trash2,
  AlignLeft,
  Check,
  FolderPlus,
} from 'lucide-react';

interface GoogleBoardViewProps {
  taskLists: TaskList[];
  tasks: Task[];
  activeView: string;
  tickedListIds: string[];
  onToggleTask: (id: string) => void;
  onAddTask: (listId: string, title: string) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
  onToggleStar: (id: string) => void;
  onCreateList: (title: string) => void;
  onDeleteList: (listId: string) => void;
  onRenameList: (listId: string, newTitle: string) => void;
}

export const GoogleBoardView: React.FC<GoogleBoardViewProps> = ({
  taskLists,
  tasks,
  activeView,
  tickedListIds,
  onToggleTask,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onToggleStar,
  onCreateList,
  onDeleteList,
  onRenameList,
}) => {
  const [addingListId, setAddingListId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [expandedCompleted, setExpandedCompleted] = useState<Record<string, boolean>>({});

  // List header options menu state
  const [listMenuId, setListMenuId] = useState<string | null>(null);
  const [listMenuPos, setListMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingListTitle, setEditingListTitle] = useState('');
  
  // Repeat modal state
  const [repeatModalTaskId, setRepeatModalTaskId] = useState<string | null>(null);
  
  // Date popover state
  const [datePopoverTaskId, setDatePopoverTaskId] = useState<string | null>(null);
  const [datePopoverPos, setDatePopoverPos] = useState<{ top: number; left: number } | null>(null);

  // Popover menu state
  const [menuTaskId, setMenuTaskId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  
  // Inline subtask input state
  const [newSubtaskTitle, setNewSubtaskTitle] = useState<Record<string, string>>({});
  const [showDatePickerTaskId, setShowDatePickerTaskId] = useState<string | null>(null);
  const [isCreatingListInMenu, setIsCreatingListInMenu] = useState(false);
  const [menuNewListTitle, setMenuNewListTitle] = useState('');

  const menuRef = useRef<HTMLDivElement>(null);
  const listMenuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuTaskId(null);
        setMenuPosition(null);
        setIsCreatingListInMenu(false);
      }
      if (listMenuRef.current && !listMenuRef.current.contains(e.target as Node)) {
        setListMenuId(null);
        setListMenuPos(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const listsToDisplay = taskLists.filter((l) => {
    // 1. Check if list is checked/ticked in sidebar
    const isTicked = tickedListIds.includes(l._id);
    if (!isTicked) return false;

    // 2. Check active view filter
    if (activeView === 'all-tasks' || activeView === 'starred') return true;
    return l._id === activeView;
  });

  const toggleCompleted = (listId: string) => {
    setExpandedCompleted((prev) => ({ ...prev, [listId]: !prev[listId] }));
  };

  const handleTaskSubmit = (listId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    onAddTask(listId, newTaskTitle.trim());
    setNewTaskTitle('');
    setAddingListId(null);
  };

  const openMenu = (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuTaskId(taskId);
    setMenuPosition({
      top: rect.bottom + 4,
      left: Math.min(rect.left - 120, window.innerWidth - 240),
    });
  };

  const openDatePopover = (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDatePopoverTaskId(taskId);
    setDatePopoverPos({
      top: rect.bottom + 4,
      left: Math.min(rect.left, window.innerWidth - 300),
    });
  };

  const handleAddSubtask = (taskId: string, e: React.FormEvent) => {
    e.preventDefault();
    const title = (newSubtaskTitle[taskId] || '').trim();
    if (!title) return;
    const task = tasks.find((t) => t._id === taskId);
    if (!task) return;

    const subtasks = [
      ...(task.subtasks || []),
      { _id: `st_${Date.now()}`, title, completed: false },
    ];
    onUpdateTask(taskId, { subtasks });
    setNewSubtaskTitle((prev) => ({ ...prev, [taskId]: '' }));
  };

  const handleToggleSubtask = (taskId: string, subtaskId: string) => {
    const task = tasks.find((t) => t._id === taskId);
    if (!task) return;
    const subtasks = (task.subtasks || []).map((st) =>
      st._id === subtaskId ? { ...st, completed: !st.completed } : st
    );
    onUpdateTask(taskId, { subtasks });
  };

  const openListMenu = (e: React.MouseEvent, listId: string) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setListMenuId(listId);
    setListMenuPos({
      top: rect.bottom + 4,
      left: Math.min(rect.left, window.innerWidth - 220),
    });
  };

  const activeMenuTask = tasks.find((t) => t._id === menuTaskId);

  const firstListId = taskLists[0]?._id;
  const knownListIds = new Set(taskLists.map((l) => l._id));

  return (
    <div className="h-full w-full overflow-x-auto p-6 flex items-start space-x-6 select-none relative transition-all duration-300">
      {listsToDisplay.map((list) => {
        let listTasks = tasks.filter((t) => {
          if (t.listId === list._id || t.tags?.includes(list._id)) return true;
          // Fallback: If this is the primary column, capture tasks with missing/unlisted listId so they are never lost
          if (list._id === firstListId && (!t.listId || !knownListIds.has(t.listId))) return true;
          return false;
        });
        if (activeView === 'starred') {
          listTasks = listTasks.filter((t) => t.starred);
        }

        const activeListTasks = listTasks.filter((t) => t.status !== 'completed');
        const completedListTasks = listTasks.filter((t) => t.status === 'completed');
        const isAdding = addingListId === list._id;
        const showCompleted = !!expandedCompleted[list._id];

        return (
          <div
            key={list._id}
            className="w-[320px] min-w-[320px] google-card border border-white/[0.06] p-5 flex flex-col justify-between shrink-0 shadow-lg max-h-[calc(100vh-6rem)] overflow-y-auto transition-all duration-300 ease-in-out transform animate-fadeIn"
          >
            <div>
              {/* Card Header with List 3-Dots Menu & Rename Support */}
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-2">
                {editingListId === list._id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (editingListTitle.trim()) {
                        onRenameList(list._id, editingListTitle.trim());
                      }
                      setEditingListId(null);
                    }}
                    className="flex-1 mr-2"
                  >
                    <input
                      type="text"
                      autoFocus
                      value={editingListTitle}
                      onChange={(e) => setEditingListTitle(e.target.value)}
                      onBlur={() => {
                        if (editingListTitle.trim() && editingListTitle.trim() !== list.title) {
                          onRenameList(list._id, editingListTitle.trim());
                        }
                        setEditingListId(null);
                      }}
                      className="w-full bg-[#1b1b1b] border border-blue-500 rounded px-2 py-1 text-sm text-[#e3e3e3] focus:outline-none"
                    />
                  </form>
                ) : (
                  <h3
                    onDoubleClick={() => {
                      setEditingListId(list._id);
                      setEditingListTitle(list.title);
                    }}
                    className="text-base font-semibold text-[#e3e3e3] truncate tracking-tight cursor-pointer hover:text-blue-300 transition-colors"
                    title="Double click to rename list"
                  >
                    {list.title}
                  </h3>
                )}
                <button
                  onClick={(e) => openListMenu(e, list._id)}
                  className="p-1.5 rounded-full hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors"
                  title="List options"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>

              {/* Add a Task Button */}
              {isAdding ? (
                <form onSubmit={(e) => handleTaskSubmit(list._id, e)} className="my-2">
                  <div className="flex items-center space-x-2 bg-[#1f1f1f] border border-blue-500 rounded-xl px-3 py-2">
                    <Circle className="w-4 h-4 text-slate-500 shrink-0" />
                    <input
                      type="text"
                      autoFocus
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onBlur={() => {
                        if (!newTaskTitle.trim()) setAddingListId(null);
                      }}
                      placeholder="Title"
                      className="w-full bg-transparent text-xs text-[#e3e3e3] placeholder-slate-500 focus:outline-none"
                    />
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setAddingListId(list._id)}
                  className="w-full flex items-center space-x-2.5 my-2 text-xs font-medium text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 p-2 rounded-xl transition-all"
                >
                  <div className="w-5 h-5 rounded-full border border-blue-400/40 flex items-center justify-center">
                    <Plus className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <span>Add a task</span>
                </button>
              )}

              {/* Active Tasks List */}
              <div className="space-y-2 mt-2">
                {activeListTasks.map((task, idx) => {
                  const taskIdKey = String(task._id || (task as any).id || `task_${list._id}_${idx}`);
                  const isExpanded = expandedTaskId === taskIdKey;

                  return (
                    <div
                      key={taskIdKey}
                      className={`group rounded-xl border transition-all ${
                        isExpanded
                          ? 'bg-[#242424] border-blue-500/50 p-3 shadow-md'
                          : 'bg-[#1b1b1b]/50 border-white/[0.04] hover:bg-white/[0.06] p-2.5 cursor-pointer'
                      }`}
                      onClick={() => {
                        if (!isExpanded) setExpandedTaskId(taskIdKey);
                      }}
                    >
                      {/* Main Task Header Row */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 min-w-0 flex-1 pr-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleTask(task._id);
                            }}
                            className="mt-0.5 text-slate-400 hover:text-blue-400 transition-colors shrink-0"
                          >
                            <Circle className="w-4.5 h-4.5 text-slate-400 hover:stroke-blue-400" />
                          </button>

                          <div className="min-w-0 flex-1">
                            {isExpanded ? (
                              <input
                                type="text"
                                value={task.title}
                                onChange={(e) => onUpdateTask(task._id, { title: e.target.value })}
                                className="w-full bg-transparent text-xs text-[#e3e3e3] font-medium focus:outline-none border-b border-transparent focus:border-blue-400 py-0.5"
                                autoFocus
                              />
                            ) : (
                              <p className="text-xs text-[#e3e3e3] leading-relaxed break-words">
                                {task.title}
                              </p>
                            )}

                            {/* Details snippet when collapsed */}
                            {!isExpanded && task.description && (
                              <p className="text-[11px] text-slate-400 truncate mt-0.5 flex items-center space-x-1">
                                <AlignLeft className="w-3 h-3 text-slate-500 shrink-0" />
                                <span>{task.description}</span>
                              </p>
                            )}

                            {/* Subtasks count snippet when collapsed */}
                            {!isExpanded && task.subtasks && task.subtasks.length > 0 && (
                              <div className="mt-1 flex items-center space-x-1 text-[11px] text-slate-400 font-medium">
                                <CheckCircle2 className="w-3 h-3 text-blue-400 shrink-0" />
                                <span>
                                  {task.subtasks.filter((st) => st.completed).length}/{task.subtasks.length} subtasks
                                </span>
                              </div>
                            )}

                            {/* Date, Time & Repeat chip when collapsed (matching Google Tasks Tasks 5.html) */}
                            {!isExpanded && (task.scheduledStart || task.dueAt || task.recurrence?.rule || task.recurrence?.enabled) && (
                              <div className="mt-1.5 flex items-center space-x-1.5 flex-wrap gap-y-1">
                                {(() => {
                                  const isRepeating = !!(task.recurrence?.enabled || task.recurrence?.rule);
                                  const dateIso = task.scheduledStart || task.dueAt;
                                  let label = '';

                                  if (dateIso) {
                                    const d = new Date(dateIso);
                                    const now = new Date();
                                    const isToday = d.toDateString() === now.toDateString();

                                    const tomorrow = new Date(now);
                                    tomorrow.setDate(now.getDate() + 1);
                                    const isTomorrow = d.toDateString() === tomorrow.toDateString();

                                    const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
                                    const timeStr = hasTime
                                      ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                                      : '';

                                    let datePrefix = '';
                                    if (isToday) datePrefix = 'Today';
                                    else if (isTomorrow) datePrefix = 'Tomorrow';
                                    else datePrefix = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                                    label = timeStr ? `${datePrefix}, ${timeStr}` : datePrefix;
                                  } else if (isRepeating) {
                                    label = 'Repeating';
                                  }

                                  if (!label && !isRepeating) return null;

                                  return (
                                    <button
                                      onClick={(e) => openDatePopover(e, task._id)}
                                      className="inline-flex items-center space-x-1.5 text-[11px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 rounded-full font-medium hover:bg-blue-500/20 transition-colors"
                                    >
                                      <Calendar className="w-3 h-3 text-blue-400 shrink-0" />
                                      <span>{label}</span>
                                      {isRepeating && (
                                        <Repeat className="w-3 h-3 text-purple-400 shrink-0 ml-0.5" />
                                      )}
                                    </button>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action buttons on task card */}
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleStar(task._id);
                            }}
                            className={`p-1 rounded transition-colors ${
                              task.starred
                                ? 'text-amber-400'
                                : 'text-transparent group-hover:text-slate-500 hover:text-amber-400'
                            }`}
                          >
                            <Star className={`w-3.5 h-3.5 ${task.starred ? 'fill-amber-400' : ''}`} />
                          </button>

                          {/* 3-dots Context Menu Button */}
                          <button
                            onClick={(e) => openMenu(e, task._id)}
                            className="p-1 rounded text-transparent group-hover:text-slate-400 hover:text-white transition-colors"
                            title="Task options"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Expanded Inline Editor Body */}
                      {isExpanded && (
                        <div className="mt-3 pt-2 border-t border-white/[0.06] space-y-3">
                          {/* Details Textarea */}
                          <div className="flex items-start space-x-2">
                            <AlignLeft className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
                            <textarea
                              value={task.description || ''}
                              onChange={(e) => onUpdateTask(task._id, { description: e.target.value })}
                              placeholder="Details"
                              rows={2}
                              className="w-full bg-[#1b1b1b] border border-white/[0.08] rounded-lg p-2 text-xs text-[#e3e3e3] placeholder-slate-500 focus:outline-none focus:border-blue-500/50 resize-none"
                            />
                          </div>

                          {/* Interactive Pill Buttons: Date & Time */}
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1.5 pl-6">
                            <button
                              onClick={(e) => openDatePopover(e, task._id)}
                              className="flex items-center space-x-1.5 px-2.5 py-1 bg-[#1b1b1b] hover:bg-white/[0.08] border border-white/10 rounded-full text-[11px] text-blue-400 font-medium transition-colors"
                            >
                              <Calendar className="w-3 h-3 text-blue-400" />
                              <span>
                                {task.scheduledStart
                                  ? new Date(task.scheduledStart).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                    })
                                  : 'Date/time'}
                              </span>
                            </button>

                            <button
                              onClick={() => setRepeatModalTaskId(task._id)}
                              className={`flex items-center space-x-1.5 px-2.5 py-1 border rounded-full text-[11px] font-medium transition-colors ${
                                task.recurrence?.enabled || task.recurrence?.rule
                                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                                  : 'bg-[#1b1b1b] hover:bg-white/[0.08] text-slate-400 border-white/10'
                              }`}
                            >
                              <Repeat className="w-3 h-3" />
                              <span>{task.recurrence?.rule ? 'Repeating' : 'Repeat'}</span>
                            </button>
                          </div>

                          {/* Inline Date Picker Input when expanded */}
                          {showDatePickerTaskId === task._id && (
                            <div className="pl-6 flex items-center space-x-2 pt-1">
                              <input
                                type="date"
                                value={
                                  task.scheduledStart
                                    ? new Date(task.scheduledStart).toISOString().substring(0, 10)
                                    : ''
                                }
                                onChange={(e) => {
                                  if (!e.target.value) {
                                    onUpdateTask(task._id, { scheduledStart: undefined });
                                  } else {
                                    onUpdateTask(task._id, {
                                      scheduledStart: new Date(`${e.target.value}T09:00:00`).toISOString(),
                                    });
                                  }
                                }}
                                className="bg-[#1b1b1b] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-[#e3e3e3] focus:outline-none"
                              />
                            </div>
                          )}

                          {/* Subtasks Section */}
                          <div className="pl-6 pt-1 space-y-1.5">
                            {(task.subtasks || []).map((st) => (
                              <div
                                key={st._id}
                                className="flex items-center space-x-2 text-xs text-[#e3e3e3]"
                              >
                                <button
                                  onClick={() => handleToggleSubtask(task._id, st._id || '')}
                                  className="text-slate-400 hover:text-blue-400"
                                >
                                  {st.completed ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                                  ) : (
                                    <Circle className="w-3.5 h-3.5 text-slate-500" />
                                  )}
                                </button>
                                <span className={st.completed ? 'line-through text-slate-500' : ''}>
                                  {st.title}
                                </span>
                              </div>
                            ))}

                            <form onSubmit={(e) => handleAddSubtask(task._id, e)} className="pt-1">
                              <div className="flex items-center space-x-2">
                                <Plus className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                <input
                                  type="text"
                                  value={newSubtaskTitle[task._id] || ''}
                                  onChange={(e) =>
                                    setNewSubtaskTitle({ ...newSubtaskTitle, [task._id]: e.target.value })
                                  }
                                  placeholder="Add subtasks"
                                  className="w-full bg-transparent text-xs text-[#e3e3e3] placeholder-slate-500 focus:outline-none border-b border-transparent focus:border-blue-400 py-0.5"
                                />
                              </div>
                            </form>
                          </div>

                          {/* Collapse button */}
                          <div className="flex justify-end pt-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedTaskId(null);
                              }}
                              className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Empty State Illustration */}
                {activeListTasks.length === 0 && !isAdding && (
                  <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 mb-3 border border-blue-500/20">
                      <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
                        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
                      </svg>
                    </div>
                    <h4 className="text-xs font-semibold text-[#e3e3e3]">No tasks yet</h4>
                    <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                      Add your to-dos and keep track of them across Google Workspace
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Completed Tasks Accordion */}
            {completedListTasks.length > 0 && (
              <div className="pt-3 border-t border-white/[0.06] mt-4">
                <button
                  onClick={() => toggleCompleted(list._id)}
                  className="flex items-center space-x-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showCompleted ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                  <span>Completed ({completedListTasks.length})</span>
                </button>

                {showCompleted && (
                  <div className="space-y-1 mt-2 pl-2">
                    {completedListTasks.map((task) => (
                      <div
                        key={task._id}
                        className="flex items-center space-x-3 py-1 text-xs text-slate-500 line-through cursor-pointer"
                        onClick={() => onToggleTask(task._id)}
                      >
                        <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                        <span className="truncate">{task.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Floating Popover Context Menu matching user screenshot 1 & 2 */}
      {menuTaskId && menuPosition && activeMenuTask && (
        <div
          ref={menuRef}
          style={{ top: menuPosition.top, left: menuPosition.left }}
          className="fixed w-64 bg-[#282828] border border-white/10 rounded-2xl shadow-2xl py-2 z-50 text-xs select-none"
        >
          {/* Star Option */}
          <button
            onClick={() => {
              onToggleStar(activeMenuTask._id);
              setMenuTaskId(null);
            }}
            className="w-full flex items-center space-x-3 px-4 py-2 hover:bg-white/[0.08] text-[#e3e3e3] transition-colors"
          >
            <Star className={`w-4 h-4 ${activeMenuTask.starred ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`} />
            <span>{activeMenuTask.starred ? 'Remove from starred' : 'Add to starred'}</span>
          </button>

          {/* Add Deadline */}
          <button
            onClick={() => {
              setExpandedTaskId(activeMenuTask._id);
              setShowDatePickerTaskId(activeMenuTask._id);
              setMenuTaskId(null);
            }}
            className="w-full flex items-center space-x-3 px-4 py-2 hover:bg-white/[0.08] text-[#e3e3e3] transition-colors"
          >
            <Clock className="w-4 h-4 text-slate-400" />
            <span>Add deadline</span>
          </button>

          {/* Add Attachment */}
          <button
            onClick={() => {
              alert('Attachment feature ready - select file to attach');
              setMenuTaskId(null);
            }}
            className="w-full flex items-center space-x-3 px-4 py-2 hover:bg-white/[0.08] text-[#e3e3e3] transition-colors"
          >
            <Paperclip className="w-4 h-4 text-slate-400" />
            <span>Add attachment</span>
          </button>

          {/* Delete Option */}
          <button
            onClick={() => {
              onDeleteTask(activeMenuTask._id);
              setMenuTaskId(null);
            }}
            className="w-full flex items-center space-x-3 px-4 py-2 hover:bg-white/[0.08] text-rose-400 transition-colors"
          >
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span>Delete</span>
          </button>

          <div className="my-1.5 border-t border-white/[0.08]" />

          {/* List Migration Section with Checkmarks */}
          <div className="max-h-48 overflow-y-auto">
            {taskLists.map((l) => {
              const isCurrentList = activeMenuTask.listId === l._id;
              return (
                <button
                  key={l._id}
                  onClick={() => {
                    onUpdateTask(activeMenuTask._id, { listId: l._id });
                    setMenuTaskId(null);
                  }}
                  className={`w-full flex items-center space-x-3 px-4 py-2 transition-colors ${
                    isCurrentList ? 'text-white font-medium bg-white/[0.06]' : 'text-[#c4c7c5] hover:bg-white/[0.08]'
                  }`}
                >
                  <div className="w-4 h-4 flex items-center justify-center shrink-0">
                    {isCurrentList && <Check className="w-4 h-4 text-blue-400" />}
                  </div>
                  <span className="truncate">{l.title}</span>
                </button>
              );
            })}
          </div>

          {/* Inline List Creation in Context Menu */}
          {isCreatingListInMenu ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (menuNewListTitle.trim()) {
                  onCreateList(menuNewListTitle.trim());
                  setMenuNewListTitle('');
                  setIsCreatingListInMenu(false);
                }
              }}
              className="px-3 pt-2"
            >
              <input
                type="text"
                autoFocus
                placeholder="New list title..."
                value={menuNewListTitle}
                onChange={(e) => setMenuNewListTitle(e.target.value)}
                className="w-full bg-[#1b1b1b] border border-blue-500 rounded-lg px-2.5 py-1 text-xs text-[#e3e3e3] focus:outline-none"
              />
            </form>
          ) : (
            <button
              onClick={() => setIsCreatingListInMenu(true)}
              className="w-full flex items-center space-x-3 px-4 py-2 hover:bg-white/[0.08] text-[#c4c7c5] transition-colors mt-1"
            >
              <FolderPlus className="w-4 h-4 text-slate-400" />
              <span>New list</span>
            </button>
          )}
        </div>
      )}

      {/* List Header Options Popover Menu (Rename & Delete List) */}
      {listMenuId && listMenuPos && (
        <div
          ref={listMenuRef}
          style={{ top: listMenuPos.top, left: listMenuPos.left }}
          className="fixed w-52 bg-[#282828] border border-white/10 rounded-2xl shadow-2xl py-2 z-50 text-xs select-none"
        >
          <button
            onClick={() => {
              const target = taskLists.find((l) => l._id === listMenuId);
              if (target) {
                setEditingListId(target._id);
                setEditingListTitle(target.title);
              }
              setListMenuId(null);
            }}
            className="w-full flex items-center space-x-3 px-4 py-2 hover:bg-white/[0.08] text-[#e3e3e3] transition-colors"
          >
            <span>Rename list</span>
          </button>

          <button
            onClick={() => {
              const target = taskLists.find((l) => l._id === listMenuId);
              if (target) {
                if (window.confirm(`Are you sure you want to delete list "${target.title}" and all its tasks?`)) {
                  onDeleteList(target._id);
                }
              }
              setListMenuId(null);
            }}
            className="w-full flex items-center space-x-3 px-4 py-2 hover:bg-white/[0.08] text-rose-400 transition-colors"
          >
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span>Delete list</span>
          </button>
        </div>
      )}

      {/* 1:1 Google Tasks Repeat Modal */}
      {repeatModalTaskId && (
        <GoogleRepeatModal
          isOpen={!!repeatModalTaskId}
          initialRule={tasks.find((t) => t._id === repeatModalTaskId)?.recurrence?.rule}
          onClose={() => setRepeatModalTaskId(null)}
          onSave={(ruleStr, timeStr) => {
            const task = tasks.find((t) => t._id === repeatModalTaskId);
            if (!task) return;

            let newStart = task.scheduledStart;
            if (timeStr) {
              const baseDate = task.scheduledStart
                ? new Date(task.scheduledStart).toISOString().substring(0, 10)
                : new Date().toISOString().substring(0, 10);
              newStart = new Date(`${baseDate}T${timeStr}:00`).toISOString();
            }

            onUpdateTask(repeatModalTaskId, {
              recurrence: {
                enabled: true,
                rule: ruleStr,
                timezone: 'Asia/Kolkata',
              },
              ...(newStart ? { scheduledStart: newStart } : {}),
            });
          }}
        />
      )}

      {/* 1:1 Google Tasks Date Popover */}
      {datePopoverTaskId && datePopoverPos && (
        <GoogleDatePopover
          isOpen={!!datePopoverTaskId}
          position={datePopoverPos}
          initialDate={tasks.find((t) => t._id === datePopoverTaskId)?.scheduledStart}
          onClose={() => setDatePopoverTaskId(null)}
          onSave={(isoDate) => {
            onUpdateTask(datePopoverTaskId, { scheduledStart: isoDate || undefined });
          }}
        />
      )}
    </div>
  );
};

