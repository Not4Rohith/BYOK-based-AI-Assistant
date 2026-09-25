import React, { useState } from 'react';
import { Task, TaskList } from '@ai-task-manager/shared-types';
import { GoogleMoveCategorySheet } from './GoogleMoveCategorySheet';
import { GoogleDatePopover } from './GoogleDatePopover';
import {
  ArrowLeft,
  Star,
  MoreVertical,
  AlignLeft,
  Clock,
  CornerDownRight,
  ChevronDown,
  Trash2,
  CheckCircle2,
  Circle,
  Plus,
  Sparkles,
  Check,
  X,
} from 'lucide-react';

interface GoogleTaskDetailsMobileScreenProps {
  task: Task;
  taskLists: TaskList[];
  onBack: () => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
  onToggleStar: (id: string) => void;
  onToggleTask: (id: string) => void;
  onCreateList: (title: string) => void;
  onAskAI?: (prompt: string) => void;
}

export const GoogleTaskDetailsMobileScreen: React.FC<GoogleTaskDetailsMobileScreenProps> = ({
  task,
  taskLists,
  onBack,
  onUpdateTask,
  onDeleteTask,
  onToggleStar,
  onToggleTask,
  onCreateList,
  onAskAI,
}) => {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [showMoveCategorySheet, setShowMoveCategorySheet] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [newSubtaskText, setNewSubtaskText] = useState('');

  const currentList = taskLists.find((l) => l._id === task.listId) || taskLists[0];
  const isCompleted = task.status === 'completed';

  const handleTitleBlur = () => {
    if (title.trim() && title !== task.title) {
      onUpdateTask(task._id, { title: title.trim() });
    }
  };

  const handleDescriptionBlur = () => {
    if (description !== task.description) {
      onUpdateTask(task._id, { description });
    }
  };

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskText.trim()) return;

    const existingSubtasks = task.subtasks || [];
    const newSubtask = {
      _id: `st_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: newSubtaskText.trim(),
      completed: false,
    };

    onUpdateTask(task._id, { subtasks: [...existingSubtasks, newSubtask] });
    setNewSubtaskText('');
  };

  const handleToggleSubtask = (stId: string) => {
    const existingSubtasks = task.subtasks || [];
    const updated = existingSubtasks.map((st) =>
      st._id === stId ? { ...st, completed: !st.completed } : st
    );
    onUpdateTask(task._id, { subtasks: updated });
  };

  const handleDeleteSubtask = (stId: string) => {
    const existingSubtasks = task.subtasks || [];
    const updated = existingSubtasks.filter((st) => st._id !== stId);
    onUpdateTask(task._id, { subtasks: updated });
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#141218] text-[#E6E1E5] font-sans overflow-hidden">
      {/* Top Header Bar with safe area top clearance: 48px ~ 56px */}
      <div className="flex items-center justify-between px-4 pt-12 pb-3 border-b border-[#2B2930] bg-[#141218]">
        <button
          onClick={onBack}
          className="p-2 text-[#CAC4D0] hover:text-[#E6E1E5] rounded-full hover:bg-[#2B2930] transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Category Switcher Dropdown (Screenshot 9) */}
        <button
          onClick={() => setShowMoveCategorySheet(true)}
          className="flex items-center space-x-1 px-3 py-1.5 rounded-full text-xs font-semibold text-[#D0BCFF] bg-[#2B2930] hover:bg-[#36343B] transition-colors"
        >
          <span>{currentList ? currentList.title : 'Select List'}</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>

        {/* Action icons: Star & Overflow Menu */}
        <div className="flex items-center space-x-1 relative">
          <button
            onClick={() => onToggleStar(task._id)}
            className="p-2 text-[#CAC4D0] hover:text-[#E8DEF8] rounded-full hover:bg-[#2B2930] transition-colors"
          >
            <Star
              className={`w-5 h-5 ${
                task.starred ? 'fill-[#D0BCFF] text-[#D0BCFF]' : 'text-[#CAC4D0]'
              }`}
            />
          </button>

          <button
            onClick={() => setShowOverflowMenu(!showOverflowMenu)}
            className="p-2 text-[#CAC4D0] hover:text-[#E6E1E5] rounded-full hover:bg-[#2B2930] transition-colors"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {/* Overflow Menu */}
          {showOverflowMenu && (
            <div className="absolute right-0 top-12 w-44 bg-[#2B2930] rounded-xl border border-[#36343B] shadow-2xl z-50 py-1">
              <button
                onClick={() => {
                  setShowOverflowMenu(false);
                  onDeleteTask(task._id);
                  onBack();
                }}
                className="w-full flex items-center space-x-3 px-4 py-2.5 text-xs text-[#F2B8B5] hover:bg-[#36343B] text-left"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {/* Title Input */}
        <div className="space-y-1">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            placeholder="Task title"
            className="w-full text-xl font-normal bg-transparent text-[#E6E1E5] focus:outline-none placeholder-[#79747E]"
          />
        </div>

        {/* Task Details / Notes Field */}
        <div className="flex items-start space-x-4">
          <AlignLeft className="w-5 h-5 text-[#CAC4D0] mt-1 shrink-0" />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleDescriptionBlur}
            placeholder="Add details"
            rows={3}
            className="w-full text-sm bg-transparent text-[#E6E1E5] focus:outline-none placeholder-[#79747E] resize-none"
          />
        </div>

        {/* Date / Time Row */}
        <div className="flex items-center space-x-4">
          <Clock className="w-5 h-5 text-[#CAC4D0] shrink-0" />
          <button
            onClick={() => setShowDatePicker(true)}
            className="flex-1 text-left text-sm text-[#CAC4D0] hover:text-[#E6E1E5] transition-colors py-1"
          >
            {task.scheduledStart ? (
              <span className="text-[#D0BCFF] font-medium">
                {new Date(task.scheduledStart).toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            ) : (
              <span>Add date/time</span>
            )}
          </button>
        </div>

        {/* Subtasks Section (Screenshot 13: ↳ Subtasks, ◯ Enter title with ✕) */}
        <div className="space-y-3">
          <div className="flex items-center space-x-4 text-[#CAC4D0]">
            <CornerDownRight className="w-5 h-5 shrink-0" />
            <span className="text-sm">Subtasks</span>
          </div>

          <div className="pl-9 space-y-2">
            {task.subtasks && task.subtasks.map((st, idx) => {
              const stId = st._id || `st_${idx}`;
              return (
                <div key={stId} className="flex items-center justify-between group">
                  <button
                    onClick={() => handleToggleSubtask(stId)}
                    className="flex items-center space-x-3 text-sm text-left flex-1"
                  >
                    {st.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-[#D0BCFF] shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-[#CAC4D0] shrink-0" />
                    )}
                    <span className={st.completed ? 'line-through text-[#79747E]' : 'text-[#E6E1E5]'}>
                      {st.title}
                    </span>
                  </button>
                  <button
                    onClick={() => handleDeleteSubtask(stId)}
                    className="text-[#79747E] hover:text-[#F2B8B5] p-1 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}

            {/* Quick Add Subtask Form */}
            <form onSubmit={handleAddSubtask} className="flex items-center space-x-2 pt-1">
              <Circle className="w-4 h-4 text-[#CAC4D0] shrink-0" />
              <input
                type="text"
                value={newSubtaskText}
                onChange={(e) => setNewSubtaskText(e.target.value)}
                placeholder="Enter title"
                className="w-full text-sm bg-transparent text-[#E6E1E5] focus:outline-none placeholder-[#79747E]"
              />
              {newSubtaskText && (
                <button type="button" onClick={() => setNewSubtaskText('')} className="p-1 text-[#CAC4D0]">
                  <X className="w-4 h-4" />
                </button>
              )}
            </form>
          </div>
        </div>

        {/* Embedded AI Actions Box */}
        {onAskAI && (
          <div className="p-4 bg-[#2B2930] rounded-2xl border border-[#36343B] space-y-2.5">
            <div className="flex items-center space-x-2 text-xs font-semibold text-[#D0BCFF]">
              <Sparkles className="w-4 h-4" />
              <span>AI Assistant Quick Actions</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onAskAI(`Break down subtasks for "${task.title}"`)}
                className="px-3 py-1.5 rounded-xl bg-[#36343B] text-xs text-[#E6E1E5] hover:bg-[#49454F] transition-colors"
              >
                Break down subtasks
              </button>
              <button
                onClick={() => onAskAI(`Estimate time required for "${task.title}"`)}
                className="px-3 py-1.5 rounded-xl bg-[#36343B] text-xs text-[#E6E1E5] hover:bg-[#49454F] transition-colors"
              >
                Estimate time
              </button>
              <button
                onClick={() => onAskAI(`Schedule task "${task.title}" into my agenda`)}
                className="px-3 py-1.5 rounded-xl bg-[#36343B] text-xs text-[#E6E1E5] hover:bg-[#49454F] transition-colors"
              >
                Schedule task
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Bottom Action: Mark completed (Screenshot 9) */}
      <div className="p-4 bg-[#141218] border-t border-[#2B2930] flex justify-end">
        <button
          onClick={() => {
            onToggleTask(task._id);
            onBack();
          }}
          className="flex items-center space-x-2 px-6 py-3 rounded-full bg-[#E8DEF8] text-[#1D1B20] text-sm font-semibold hover:bg-[#D0BCFF] active:scale-98 transition-all shadow-md"
        >
          <Check className="w-4 h-4 text-[#1D1B20]" />
          <span>{isCompleted ? 'Mark incomplete' : 'Mark completed'}</span>
        </button>
      </div>

      {/* Category Move Sheet Modal */}
      {showMoveCategorySheet && (
        <GoogleMoveCategorySheet
          taskLists={taskLists}
          currentListId={task.listId || taskLists[0]?._id}
          onSelectList={(listId) => onUpdateTask(task._id, { listId })}
          onCreateNewList={() => {
            const name = prompt('New category name:');
            if (name) onCreateList(name);
          }}
          onClose={() => setShowMoveCategorySheet(false)}
        />
      )}

      {/* Date Picker Popover */}
      {showDatePicker && (
        <GoogleDatePopover
          isOpen={showDatePicker}
          initialDate={task.scheduledStart}
          position={{ top: 120, left: 20 }}
          onClose={() => setShowDatePicker(false)}
          onSave={(scheduledStart) => onUpdateTask(task._id, { scheduledStart })}
        />
      )}
    </div>
  );
};
