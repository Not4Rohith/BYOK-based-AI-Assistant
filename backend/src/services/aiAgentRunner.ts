import { aiAgentGoalService } from './aiAgentGoal.service.js';
import { taskListService } from './taskList.service.js';
import { chatStorageService } from './chatStorage.service.js';
import { MemoryService } from './memory.service.js';
import { dbConnection } from '../db/connection.js';

const memoryService = new MemoryService();

export class AIAgentRunner {
  private timer: NodeJS.Timeout | null = null;
  private intervalMs: number = 15000; // Check every 15 seconds

  public startScheduler(): void {
    if (this.timer) return;
    console.log('[AIAgentRunner] Autonomous AI Agent Goal Runner started (interval: 15s)');

    // Run an initial check after 3 seconds
    setTimeout(() => {
      if (!dbConnection.getStatus().connected) return;
      this.checkAndRunDueGoals().catch((err) =>
        console.error('[AIAgentRunner] Initial check error:', err)
      );
    }, 3000);

    this.timer = setInterval(() => {
      if (!dbConnection.getStatus().connected) return;
      this.checkAndRunDueGoals().catch((err) =>
        console.error('[AIAgentRunner] Interval check error:', err)
      );

      // Hourly day summary and behavior analysis (checked every 15s but internally gated)
      this.runHourlyAnalysis().catch((err) =>
        console.error('[AIAgentRunner] Hourly analysis error:', err)
      );
    }, this.intervalMs);
  }

  public stopScheduler(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[AIAgentRunner] Autonomous AI Agent Goal Runner stopped.');
    }
  }

  public async checkAndRunDueGoals(): Promise<void> {
    if (!dbConnection.getStatus().connected) return;
    const nowIso = new Date().toISOString();
    const dueGoals = await aiAgentGoalService.getDueGoals(nowIso);

    if (dueGoals.length === 0) return;

    console.log(`[AIAgentRunner] Found ${dueGoals.length} due goal(s) to execute at ${nowIso}`);

    for (const goal of dueGoals) {
      try {
        let executionSummary = '';
        let chatNotificationContent = '';

        if (goal.actionType === 'delete_list_and_tasks') {
          const listTarget =
            goal.payload?.listTitle || goal.payload?.listId || goal.title.replace(/delete/i, '').trim();

          const result = await taskListService.deleteListAndTasks(listTarget);

          if (!result.success) {
            console.log(`[AIAgentRunner] Goal "${goal.title}" target "${listTarget}" was not found or already deleted. Skipping UI message pop.`);
            await aiAgentGoalService.markGoalExecuted(goal._id, `Skipped: Target list "${listTarget}" was not found or already deleted.`);
            continue;
          }

          executionSummary = `Deleted list "${result.deletedList}" and ${result.deletedTaskCount} associated task(s).`;
          chatNotificationContent = `🤖 **Autonomous AI System Action Executed**:\n` +
            `Successfully executed scheduled goal: **${goal.title}**.\n` +
            `The list **"${result.deletedList}"** and its ${result.deletedTaskCount} task(s) have been automatically deleted as requested.`;
        } else if (goal.actionType === 'check_in_reminder') {
          const reminderText = goal.payload?.reminderText || goal.payload?.note || goal.title;
          executionSummary = `Sent check-in reminder: "${reminderText}"`;
          chatNotificationContent = `🤖 **Autonomous AI System Check-In**:\n` +
            `Scheduled Goal: **${goal.title}**\n` +
            `📌 **Note**: ${reminderText}`;
        } else {
          executionSummary = `Executed system action for: "${goal.title}"`;
          chatNotificationContent = `🤖 **Autonomous AI System Action Executed**:\n` +
            `Completed agent goal: **${goal.title}**`;
        }

        // Post silent notification to current date's chat session
        await chatStorageService.saveMessage({
          role: 'assistant',
          content: chatNotificationContent,
          metadata: {
            isAutonomousAgentAction: true,
            goalId: goal._id,
            actionType: goal.actionType,
          },
        });

        // Add a short-term memory entry so the AI stays aware during subsequent interactions
        await memoryService.createMemory({
          memoryTier: 'medium_term',
          category: 'temporary_context',
          content: `AI System automatically executed goal "${goal.title}" on ${new Date().toLocaleString()}: ${executionSummary}`,
          importance: 0.8,
          confidence: 1.0,
          source: 'system_import',
          validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().substring(0, 10), // valid for 1 day
          tags: ['ai_agent_goal', 'autonomous_execution'],
        });

        // Mark goal as executed in MongoDB / memory
        await aiAgentGoalService.markGoalExecuted(goal._id, executionSummary);
        console.log(`[AIAgentRunner] Successfully executed goal "${goal.title}" (${goal._id})`);
      } catch (err: any) {
        console.error(`[AIAgentRunner] Failed to execute goal "${goal.title}" (${goal._id}):`, err);
        await aiAgentGoalService.markGoalExecuted(
          goal._id,
          `Failed with error: ${err?.message || String(err)}`
        );
      }
    }
  }

  private lastHourlyRun: number = 0;
  public latestDailySummary: string = "Analyzing your day...";

  public async runHourlyAnalysis(): Promise<void> {
    if (!dbConnection.getStatus().connected) return;
    const now = new Date();
    // Run exactly once per hour (check if we ran in the current hour)
    if (this.lastHourlyRun === now.getHours()) return;

    try {
      // 1. Behavior Analysis: Determine wake/sleep time based on chat history
      await this.analyzeUserBehavior();

      // 2. Fetch User Prefs to check if we are within wake/sleep times
      const { UserModel } = await import('../db/models/User.model.js');
      const user = await UserModel.findOne();
      if (user) {
        const currentHour = now.getHours();
        const wakeHour = parseInt(user.planningPreferences?.preferredStartTime?.split(':')[0] || '7', 10);
        const sleepHour = parseInt(user.planningPreferences?.preferredEndTime?.split(':')[0] || '22', 10);

        if (currentHour >= wakeHour && currentHour < sleepHour) {
          // It's daytime, generate summary
          this.latestDailySummary = await this.generateDailySummary();
        } else {
          this.latestDailySummary = "You're outside active hours. Resting...";
        }
      }

      this.lastHourlyRun = now.getHours();
    } catch (err) {
      console.error('[AIAgentRunner] Error in hourly analysis:', err);
    }
  }

  private async analyzeUserBehavior(): Promise<void> {
    const sessions = await chatStorageService.getSessions();
    if (!sessions || sessions.length === 0) return;

    // A simplified heuristic: looking at first and last message times
    // In a real app, this would use AI to process context and system prompts
    const activeSessionId = sessions[0]._id;
    const messages = await chatStorageService.getMessagesBySession(activeSessionId);
    if (messages && messages.length > 0) {
      // Analyze user behavior and update DB
      const { UserModel } = await import('../db/models/User.model.js');
      await UserModel.updateOne({}, {
        $set: {
          'planningPreferences.preferredStartTime': '08:00', // Example mocked heuristic
          'planningPreferences.preferredEndTime': '23:00'
        }
      });
    }
  }

  public async getOrGenerateDailySummary(force: boolean = false): Promise<string> {
    if (!force && this.latestDailySummary && this.latestDailySummary !== 'Analyzing your day...') {
      return this.latestDailySummary;
    }
    return await this.generateDailySummary();
  }

  private async generateDailySummary(): Promise<string> {
    try {
      const { TaskService } = await import('./task.service.js');
      const { taskListService } = await import('./taskList.service.js');
      const { AIService } = await import('./ai.service.js');
      const { ChatOpenAI } = await import('@langchain/openai');

      const svc = new TaskService();
      const allTasks = await svc.getAllTasks();
      const allLists = await taskListService.getAllLists();

      const completed = allTasks.filter((t: any) => t.status === 'completed');
      const pending = allTasks.filter((t: any) => t.status !== 'completed');

      const completedTitles = completed.slice(0, 5).map((t: any) => t.title).join(', ');
      const pendingTitles = pending.slice(0, 5).map((t: any) => t.title).join(', ');

      const aiService = new AIService(svc);
      const config = aiService.getConfig();

      const openrouterKey = (config.openrouter?.apiKey || '').trim();
      if (!openrouterKey) {
        const fallbackStr = `Cleared ${completed.length} task(s) today • ${pending.length} pending remaining`;
        this.latestDailySummary = fallbackStr;
        return fallbackStr;
      }

      const candidateModels = [
        config.openrouter?.defaultModel,
        ...(config.openrouter?.fallbackModels || []),
        'openai/gpt-4o-mini',
        'meta-llama/llama-3.3-70b-instruct',
        'google/gemini-2.0-flash-001',
      ]
        .filter(Boolean)
        .map((m) => (m as string).replace(/^~/, '').trim())
        .filter((m, i, arr) => m && arr.indexOf(m) === i);

      const promptText = `Analyze current task board:
- Completed today (${completed.length}): ${completedTitles || 'None yet'}
- Pending remaining (${pending.length}): ${pendingTitles || 'None'}
- Categories: ${allLists.map((l: any) => l.title).join(', ')}

Goal: Write a single, motivating, 1-sentence headline (max 18 words) for the user's desktop taskbar summarizing their daily progress or focus. Do NOT use quotation marks.`;

      for (const modelName of candidateModels) {
        try {
          console.log(`[AIAgentRunner] Generating dynamic AI summary using model "${modelName}"...`);
          const llm = new ChatOpenAI({
            model: modelName,
            modelName: modelName,
            apiKey: openrouterKey,
            openAIApiKey: openrouterKey,
            configuration: {
              apiKey: openrouterKey,
              baseURL: 'https://openrouter.ai/api/v1',
              defaultHeaders: {
                'HTTP-Referer': 'https://aitaskmanager.app',
                'X-Title': 'Personal AI Task Manager',
              },
            },
            temperature: 0.5,
            maxTokens: 2048,
          });

          const response = await llm.invoke(promptText);
          const rawText = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
          const cleanSummary = rawText.replace(/^["']|["']$/g, '').trim();

          if (cleanSummary && cleanSummary.length > 5) {
            console.log(`[AIAgentRunner] Generated dynamic AI summary with "${modelName}": "${cleanSummary}"`);
            this.latestDailySummary = cleanSummary;
            return cleanSummary;
          }
        } catch (err) {
          console.warn(`[AIAgentRunner] Model "${modelName}" failed for AI summary generation:`, (err as Error).message);
        }
      }
    } catch (err) {
      console.warn('[AIAgentRunner] Dynamic AI summary generation failed:', err);
    }

    const defaultFallback = `Ready to assist with your day.`;
    this.latestDailySummary = defaultFallback;
    return defaultFallback;
  }
}

export const aiAgentRunner = new AIAgentRunner();
