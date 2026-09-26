import express from 'express';
import cors from 'cors';
import { dbConnection } from './db/connection.js';
import { TaskService } from './services/task.service.js';
import { GoalService } from './services/goal.service.js';
import { MemoryService } from './services/memory.service.js';
import { AIService } from './services/ai.service.js';
import { PlanningService } from './services/planning.service.js';

import { createTasksRouter } from './routes/tasks.router.js';
import { createGoalsRouter } from './routes/goals.router.js';
import { createMemoryRouter } from './routes/memory.router.js';
import { createChatRouter } from './routes/chat.router.js';
import { createPlanningRouter } from './routes/planning.router.js';
import { createSettingsRouter } from './routes/settings.router.js';
import { createGoogleRouter } from './routes/google.router.js';
import { createSyncRouter } from './routes/sync.routes.js';
import { createAnalyticsRouter } from './routes/analytics.router.js';
import { createTaskListsRouter } from './routes/taskLists.router.js';
import { modelsRouter } from './routes/models.router.js';
import { aiAgentRunner } from './services/aiAgentRunner.js';
import { SyncConflictResolver } from './services/syncConflictResolver.js';
import { AnalyticsService } from './services/analytics.service.js';
import { migrationManager } from './db/migrationManager.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Terminal HTTP request logger
app.use((req, _res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[HTTP] ${req.method} ${req.path} - ${new Date().toLocaleTimeString()}`);
  }
  next();
});

// Initialize services
const taskService = new TaskService();
const goalService = new GoalService();
const memoryService = new MemoryService();
const planningService = new PlanningService();
const aiService = new AIService(taskService, memoryService, planningService);
const syncResolver = new SyncConflictResolver(taskService, goalService, memoryService);
const analyticsService = new AnalyticsService(taskService, goalService, memoryService);

// Start async initialization server boot sequence
async function startServer() {
  // 1. Connect to MongoDB Atlas
  const mongoUri = aiService.getConfig().mongoUri || process.env.MONGODB_URI || '';
  const connected = await dbConnection.connect(mongoUri);
  if (connected) {
    try {
      await migrationManager.runMigrations();
      console.log('[Server] Database connected and schema migrations completed successfully.');
    } catch (err) {
      console.error('[MigrationManager] Startup migration error:', err);
    }
  } else {
    console.warn('[Server] MongoDB Atlas connection failed. Operating in fallback mode.');
  }

  // 2. Start autonomous background runner for AI agent goals
  aiAgentRunner.startScheduler();

  // 3. Health Check with Database Status
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'AI Task Manager Local Backend',
      database: dbConnection.getStatus(),
      timestamp: new Date().toISOString(),
    });
  });

  // 4. Register Routers
  app.use('/api/tasks', createTasksRouter(taskService));
  app.use('/api/goals', createGoalsRouter(goalService));
  app.use('/api/memory', createMemoryRouter(memoryService));
  app.use('/api/chat', createChatRouter(aiService));
  app.use('/api/planning', createPlanningRouter(planningService, taskService));
  app.use('/api/settings', createSettingsRouter(aiService, taskService, goalService, memoryService));
  app.use('/api/settings/models', modelsRouter);
  app.use('/api/google', createGoogleRouter());
  app.use('/api/sync', createSyncRouter(syncResolver));
  app.use('/api/analytics', createAnalyticsRouter(analyticsService));
  app.use('/api/lists', createTaskListsRouter());

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[AI Task Manager Backend] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();



