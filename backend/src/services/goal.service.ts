import { Goal } from '@ai-task-manager/shared-types';
import { dbConnection } from '../db/connection.js';
import { GoalModel } from '../db/models/Goal.model.js';

export class GoalService {
  private inMemoryGoals: Goal[] = [
    {
      _id: 'goal_1',
      userId: 'usr_1',
      title: 'Master Machine Learning Fundamentals',
      description: 'Build strong ML math & practical implementation projects',
      status: 'active',
      priority: 'high',
      targetDate: '2026-11-30',
      progress: 35,
      milestones: [
        { _id: 'm_1', title: 'Complete Linear Algebra & Matrix Calculus', status: 'completed' },
        { _id: 'm_2', title: 'Implement Regression Models from Scratch', status: 'pending' },
        { _id: 'm_3', title: 'Build Image Classification Pipeline', status: 'pending' },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  public async getGoals(): Promise<Goal[]> {
    if (dbConnection.getStatus().connected) {
      const docs = await GoalModel.find({}).sort({ createdAt: -1 });
      return docs.map(this.mapDocToGoal);
    }
    return this.inMemoryGoals;
  }

  public async createGoal(data: Partial<Goal>): Promise<Goal> {
    if (dbConnection.getStatus().connected) {
      const doc = await GoalModel.create({
        userId: data.userId || 'usr_1',
        title: data.title || 'Untitled Goal',
        description: data.description,
        priority: data.priority || 'medium',
        progress: 0,
        milestones: data.milestones || [],
      });
      return this.mapDocToGoal(doc);
    }

    const newGoal: Goal = {
      _id: `goal_${Date.now()}`,
      userId: data.userId || 'usr_1',
      title: data.title || 'Untitled Goal',
      description: data.description,
      status: 'active',
      priority: data.priority || 'medium',
      progress: 0,
      milestones: data.milestones || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.inMemoryGoals.push(newGoal);
    return newGoal;
  }

  public async toggleMilestone(goalId: string, milestoneId: string): Promise<Goal | null> {
    if (dbConnection.getStatus().connected) {
      const doc = await GoalModel.findById(goalId);
      if (!doc) return null;

      doc.milestones = doc.milestones.map((m: any) =>
        m._id.toString() === milestoneId || m._id === milestoneId
          ? { ...m, status: m.status === 'completed' ? 'pending' : 'completed' }
          : m
      );

      const completed = doc.milestones.filter((m: any) => m.status === 'completed').length;
      doc.progress = Math.round((completed / doc.milestones.length) * 100);
      await doc.save();
      return this.mapDocToGoal(doc);
    }

    const goal = this.inMemoryGoals.find((g) => g._id === goalId);
    if (!goal) return null;

    goal.milestones = goal.milestones.map((m) =>
      m._id === milestoneId ? { ...m, status: m.status === 'completed' ? 'pending' : 'completed' } : m
    );
    const completed = goal.milestones.filter((m) => m.status === 'completed').length;
    goal.progress = Math.round((completed / goal.milestones.length) * 100);
    return goal;
  }

  private mapDocToGoal(doc: any): Goal {
    return {
      _id: doc._id.toString(),
      userId: doc.userId,
      title: doc.title,
      description: doc.description,
      status: doc.status,
      priority: doc.priority,
      targetDate: doc.targetDate,
      progress: doc.progress,
      milestones: doc.milestones,
      createdAt: doc.createdAt ? doc.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : new Date().toISOString(),
    };
  }
}
