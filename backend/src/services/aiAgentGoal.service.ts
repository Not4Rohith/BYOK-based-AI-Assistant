import { AIAgentGoal } from '@ai-task-manager/shared-types';
import { dbConnection } from '../db/connection.js';
import { AIAgentGoalModel } from '../db/models/AIAgentGoal.model.js';

export class AIAgentGoalService {
  private inMemoryGoals: AIAgentGoal[] = [];

  public async createAgentGoal(data: Partial<AIAgentGoal>): Promise<AIAgentGoal> {
    const goalId = `agent_goal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const fullGoal: AIAgentGoal = {
      _id: goalId,
      userId: data.userId || 'usr_1',
      title: data.title || 'AI Internal Agent Goal',
      actionType: data.actionType || 'custom_system_action',
      targetExecutionTime: data.targetExecutionTime || new Date().toISOString(),
      payload: data.payload || {},
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (dbConnection.getStatus().connected) {
      const doc = await AIAgentGoalModel.create({
        ...fullGoal,
      });
      return this.mapDocToGoal(doc);
    }

    this.inMemoryGoals.push(fullGoal);
    return fullGoal;
  }

  public async getDueGoals(nowIso?: string): Promise<AIAgentGoal[]> {
    const targetTime = nowIso || new Date().toISOString();
    if (dbConnection.getStatus().connected) {
      const docs = await AIAgentGoalModel.find({
        status: 'pending',
        targetExecutionTime: { $lte: targetTime },
      }).sort({ targetExecutionTime: 1 });
      return docs.map(this.mapDocToGoal);
    }
    return this.inMemoryGoals.filter(
      (g) => g.status === 'pending' && g.targetExecutionTime <= targetTime
    );
  }

  public async markGoalExecuted(id: string, logMessage: string): Promise<boolean> {
    const executedAt = new Date().toISOString();
    if (dbConnection.getStatus().connected) {
      const doc = await AIAgentGoalModel.findByIdAndUpdate(id, {
        status: 'executed',
        executedAt,
        lastLogMessage: logMessage,
      });
      return doc !== null;
    }

    const target = this.inMemoryGoals.find((g) => g._id === id);
    if (target) {
      target.status = 'executed';
      target.executedAt = executedAt;
      target.lastLogMessage = logMessage;
      return true;
    }
    return false;
  }

  public async cancelAgentGoal(id: string): Promise<boolean> {
    const executedAt = new Date().toISOString();
    if (dbConnection.getStatus().connected) {
      const doc = await AIAgentGoalModel.findByIdAndUpdate(id, {
        status: 'cancelled',
        executedAt,
        lastLogMessage: 'Cancelled by user/AI request',
      });
      return doc !== null;
    }

    const target = this.inMemoryGoals.find((g) => g._id === id);
    if (target) {
      target.status = 'cancelled';
      target.executedAt = executedAt;
      target.lastLogMessage = 'Cancelled by user/AI request';
      return true;
    }
    return false;
  }

  public async getAllAgentGoals(): Promise<AIAgentGoal[]> {
    if (dbConnection.getStatus().connected) {
      const docs = await AIAgentGoalModel.find({}).sort({ createdAt: -1 });
      return docs.map(this.mapDocToGoal);
    }
    return this.inMemoryGoals;
  }

  private mapDocToGoal(doc: any): AIAgentGoal {
    return {
      _id: doc._id.toString(),
      userId: doc.userId,
      title: doc.title,
      actionType: doc.actionType,
      targetExecutionTime: doc.targetExecutionTime,
      payload: doc.payload,
      status: doc.status,
      executedAt: doc.executedAt,
      lastLogMessage: doc.lastLogMessage,
      createdAt: doc.createdAt ? doc.createdAt.toISOString() : undefined,
      updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : undefined,
    };
  }
}

export const aiAgentGoalService = new AIAgentGoalService();
