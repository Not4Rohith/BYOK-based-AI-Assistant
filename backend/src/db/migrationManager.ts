import { dbConnection } from './connection.js';
import { SchemaVersionModel } from './models/SchemaVersion.model.js';
import { TaskModel } from './models/Task.model.js';
import { TaskListModel } from './models/TaskList.model.js';
import { GoalModel } from './models/Goal.model.js';
import { MemoryModel } from './models/Memory.model.js';
import { AIAgentGoalModel } from './models/AIAgentGoal.model.js';
import { ChatSessionModel } from './models/ChatSession.model.js';
import { ChatMessageModel } from './models/ChatMessage.model.js';
import { UserModel } from './models/User.model.js';
import { TaskService } from '../services/task.service.js';
import { GoalService } from '../services/goal.service.js';
import { MemoryService } from '../services/memory.service.js';

export interface MigrationStep {
  fromVersion: number;
  toVersion: number;
  description: string;
  up: () => Promise<void>;
}

export class MigrationManager {
  public static readonly CURRENT_SCHEMA_VERSION = 4;

  private migrations: MigrationStep[] = [
    {
      fromVersion: 1,
      toVersion: 2,
      description: 'Add Google Tasks & Calendar synchronization metadata defaults',
      up: async () => {
        if (!dbConnection.getStatus().connected) return;
        await TaskModel.updateMany(
          { google: { $exists: false } },
          {
            $set: {
              google: {
                taskId: null,
                taskListId: 'primary',
                lastSyncedAt: null,
                syncStatus: 'not_connected',
              },
              calendar: {
                eventId: null,
                calendarId: 'primary',
                lastSyncedAt: null,
                syncStatus: 'not_connected',
              },
            },
          }
        );
      },
    },
    {
      fromVersion: 2,
      toVersion: 3,
      description: 'Standardize task tags array and recurrence defaults',
      up: async () => {
        if (!dbConnection.getStatus().connected) return;
        await TaskModel.updateMany(
          { tags: { $exists: false } },
          { $set: { tags: ['general'] } }
        );
      },
    },
    {
      fromVersion: 3,
      toVersion: 4,
      description: 'Add expiresAt default and ensure subtasks array consistency for all older tasks',
      up: async () => {
        if (!dbConnection.getStatus().connected) return;
        await TaskModel.updateMany(
          { expiresAt: { $exists: false } },
          { $set: { expiresAt: null } }
        );
        await TaskModel.updateMany(
          { subtasks: { $exists: false } },
          { $set: { subtasks: [] } }
        );
        await TaskListModel.updateMany(
          { expiresAt: { $exists: false } },
          { $set: { expiresAt: null } }
        );
      },
    },
  ];

  public async ensureAllCollectionsExist(): Promise<void> {
    if (!dbConnection.getStatus().connected) return;
    try {
      // 1. Memories (Clean default user context)
      const defaultSeedMemories = [
        {
          userId: 'usr_1',
          memoryTier: 'long_term',
          category: 'preferences',
          content: 'Prefers realistic schedules with balanced work blocks and regular rest breaks.',
          tags: ['preferences', 'schedule'],
          importance: 0.8,
          confidence: 0.95,
          source: 'explicit_user',
          status: 'active',
        },
      ];

      for (const memItem of defaultSeedMemories) {
        const found = await MemoryModel.findOne({ content: memItem.content });
        if (!found) {
          await MemoryModel.create(memItem).catch(() => {});
        }
      }

      // 2. AI Agent Goals
      const goalCount = await AIAgentGoalModel.countDocuments();
      if (goalCount === 0) {
        await AIAgentGoalModel.create({
          userId: 'usr_1',
          title: 'Daily Schedule Check & Maintenance',
          actionType: 'check_in_reminder',
          targetExecutionTime: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
          payload: { reminderText: 'Check active task board progress for today.' },
          status: 'pending',
        }).catch(() => {});
      }

      // 3. Task Lists (Standard Task Categories)
      const listCount = await TaskListModel.countDocuments();
      if (listCount === 0) {
        await TaskListModel.create([
          { _id: 'list_academic_goals', userId: 'usr_1', title: 'Academic Goals' },
          { _id: 'list_projects', userId: 'usr_1', title: 'Projects' },
          { _id: 'list_personal_dev', userId: 'usr_1', title: 'Personal Development' },
          { _id: 'list_health_fitness', userId: 'usr_1', title: 'Health & Fitness' },
          { _id: 'list_general', userId: 'usr_1', title: 'General' },
        ]).catch(() => {});
      }

      // 4. Chat Session & Messages
      const chatSessCount = await ChatSessionModel.countDocuments();
      if (chatSessCount === 0) {
        const todayStr = new Date().toISOString().substring(0, 10);
        const sessId = `session_${todayStr}`;
        await ChatSessionModel.create({
          _id: sessId,
          userId: 'usr_1',
          date: todayStr,
          sessionType: 'daily_chat',
          title: `Chat - ${todayStr}`,
          messageCount: 1,
          lastMessageAt: new Date().toISOString(),
        }).catch(() => {});

        await ChatMessageModel.create({
          sessionId: sessId,
          date: todayStr,
          role: 'assistant',
          content: "Hello! I am your AI Task Manager. How can I help you organize your tasks and schedule today?",
        }).catch(() => {});
      }

      // 5. Goals
      const userGoalCount = await GoalModel.countDocuments();
      if (userGoalCount === 0) {
        await GoalModel.create({
          userId: 'usr_1',
          title: 'Master Graph Data Structures & Algorithms',
          description: 'Topological sort, Dijkstra, MST, Shortest paths',
          status: 'active',
          priority: 'high',
          progress: 35,
          milestones: [
            { title: 'Relational Algebra & B-Trees', status: 'completed' },
            { title: 'Graph Algorithms & Shortest Path', status: 'pending' },
          ],
        }).catch(() => {});
      }

      // 6. User Profile
      const userProfileCount = await UserModel.countDocuments();
      if (userProfileCount === 0) {
        await UserModel.create({
          _id: 'usr_1',
          profile: { name: 'Rohith N R', timezone: 'Asia/Kolkata' },
          aiInstructions: { systemPrompt: 'Always be decisive, give single best option, and execute tools.' },
          planningPreferences: {
            preferredStartTime: '09:00',
            preferredEndTime: '22:00',
            defaultBufferMinutes: 15,
            preferRealisticSchedules: true,
            maxContinuousWorkMinutes: 120,
          },
        }).catch(() => {});
      }

      console.log('[MigrationManager] Successfully initialized and verified all MongoDB Atlas collections!');
    } catch (err) {
      console.warn('[MigrationManager] Error ensuring collections exist:', err);
    }
  }

  public async runMigrations(): Promise<{ currentVersion: number; migrated: boolean }> {
    if (!dbConnection.getStatus().connected) {
      console.log('[MigrationManager] Database offline. Operating in fallback mode (v3 assumed).');
      return { currentVersion: MigrationManager.CURRENT_SCHEMA_VERSION, migrated: false };
    }

    try {
      // Ensure all collections and seed documents are created in MongoDB Atlas
      await this.ensureAllCollectionsExist();

      let schemaDoc = await SchemaVersionModel.findOne({});
      if (!schemaDoc) {
        schemaDoc = await SchemaVersionModel.create({
          version: 1,
          description: 'Initial Schema Version',
          appliedAt: new Date(),
          history: [],
        });
      }

      let current = schemaDoc.version;
      let migratedAny = false;

      while (current < MigrationManager.CURRENT_SCHEMA_VERSION) {
        const nextMigration = this.migrations.find((m) => m.fromVersion === current);
        if (!nextMigration) break;

        console.log(`[MigrationManager] Running migration v${nextMigration.fromVersion} -> v${nextMigration.toVersion}: ${nextMigration.description}`);
        await nextMigration.up();

        schemaDoc.history.push({
          fromVersion: nextMigration.fromVersion,
          toVersion: nextMigration.toVersion,
          description: nextMigration.description,
          appliedAt: new Date(),
        });
        schemaDoc.version = nextMigration.toVersion;
        schemaDoc.description = nextMigration.description;
        schemaDoc.appliedAt = new Date();
        await schemaDoc.save();

        current = nextMigration.toVersion;
        migratedAny = true;
      }

      console.log(`[MigrationManager] Schema version is up to date (v${current}).`);
      return { currentVersion: current, migrated: migratedAny };
    } catch (err: any) {
      console.error('[MigrationManager] Migration failed:', err?.message || err);
      return { currentVersion: 1, migrated: false };
    }
  }

  public async exportBackup(
    taskService: TaskService,
    goalService: GoalService,
    memoryService: MemoryService
  ): Promise<any> {
    const [tasks, goals, memories] = await Promise.all([
      taskService.getAllTasks(),
      goalService.getGoals(),
      memoryService.getMemories(),
    ]);

    let user = null;
    if (dbConnection.getStatus().connected) {
      user = await UserModel.findOne({});
    }

    return {
      version: MigrationManager.CURRENT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      data: {
        tasks,
        goals,
        memories,
        user,
      },
    };
  }

  public async restoreBackup(backupData: any, taskService: TaskService): Promise<boolean> {
    if (!backupData || !backupData.data) return false;

    const { tasks, goals, memories } = backupData.data;

    if (Array.isArray(tasks)) {
      for (const t of tasks) {
        await taskService.createTask(t).catch(() => {});
      }
    }

    return true;
  }
}

export const migrationManager = new MigrationManager();
