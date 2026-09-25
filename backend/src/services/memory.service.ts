import { Memory } from '@ai-task-manager/shared-types';
import { dbConnection } from '../db/connection.js';
import { MemoryModel } from '../db/models/Memory.model.js';
import { embeddingService } from '../ai/embeddings.service.js';

export class MemoryService {
  private inMemoryMemories: Memory[] = [
    {
      _id: 'mem_1',
      userId: 'usr_1',
      memoryTier: 'long_term',
      category: 'preferences',
      content: 'Prefers studying difficult technical subjects in the morning.',
      importance: 0.8,
      confidence: 0.95,
      source: 'explicit_user',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      _id: 'mem_2',
      userId: 'usr_1',
      memoryTier: 'long_term',
      category: 'constraints',
      content: 'Do not schedule demanding study sessions after 10:00 PM.',
      importance: 0.9,
      confidence: 0.98,
      source: 'explicit_user',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      _id: 'mem_3',
      userId: 'usr_1',
      memoryTier: 'long_term',
      category: 'routines',
      content: 'Attends Coders High meeting daily. Always reserve time for it.',
      tags: ['meeting', 'coders_high', 'recurring'],
      importance: 0.95,
      confidence: 0.98,
      source: 'conversation',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      _id: 'mem_4',
      userId: 'usr_1',
      memoryTier: 'long_term',
      category: 'relationships',
      content: 'Sensitive emotional support: If user is feeling down or mentions a breakup, suggest supportive movie recommendations and lighten schedule.',
      tags: ['relationship', 'support', 'movies'],
      importance: 0.9,
      confidence: 0.95,
      source: 'conversation',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      _id: 'mem_5',
      userId: 'usr_1',
      memoryTier: 'medium_term',
      category: 'exams',
      content: 'NPTEL Exam on Sunday. High priority: Remind user to prepare for NPTEL throughout this week!',
      validUntil: '2026-09-20',
      tags: ['nptel', 'exam', 'weekly_focus'],
      importance: 0.95,
      confidence: 0.95,
      source: 'conversation',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  public async getMemories(): Promise<Memory[]> {
    if (dbConnection.getStatus().connected) {
      // Ensure all default core memories (Long-term preferences, Coders High meeting, Medium-term NPTEL exam) exist in DB
      for (const defaultMem of this.inMemoryMemories) {
        const found = await MemoryModel.findOne({ content: defaultMem.content });
        if (!found) {
          await MemoryModel.create({
            ...defaultMem,
            _id: undefined, // Let Mongo generate _id
          }).catch(() => {});
        }
      }

      const docs = await MemoryModel.find({}).sort({ createdAt: -1 });
      return docs.map(this.mapDocToMemory);
    }
    return this.inMemoryMemories;
  }

  public async getActiveMemories(currentDateStr?: string): Promise<{ mediumTerm: Memory[]; longTerm: Memory[] }> {
    const today = currentDateStr || new Date().toISOString().substring(0, 10);
    const all = await this.getMemories();

    const longTerm: Memory[] = [];
    const mediumTerm: Memory[] = [];

    for (const mem of all) {
      if (mem.status === 'disabled' || mem.status === 'archived' || mem.status === 'expired') {
        continue;
      }

      if (mem.memoryTier === 'medium_term') {
        if (mem.validUntil && mem.validUntil < today) {
          // Auto-expire past medium-term context so it stops impacting long-term planning
          await this.updateMemoryStatus(mem._id, 'expired');
          continue;
        }
        mediumTerm.push(mem);
      } else {
        longTerm.push(mem);
      }
    }

    return { mediumTerm, longTerm };
  }

  public async updateMemoryStatus(id: string, newStatus: string): Promise<boolean> {
    if (dbConnection.getStatus().connected) {
      const res = await MemoryModel.findByIdAndUpdate(id, { status: newStatus });
      return res !== null;
    }
    const mem = this.inMemoryMemories.find((m) => m._id === id);
    if (mem) {
      mem.status = newStatus;
      return true;
    }
    return false;
  }

  public async createMemory(data: Partial<Memory>): Promise<Memory> {
    const vector = await embeddingService.generateEmbedding(data.content || '');
    const tier = data.memoryTier || (data.validUntil ? 'medium_term' : 'long_term');

    if (dbConnection.getStatus().connected) {
      const doc = await MemoryModel.create({
        userId: data.userId || 'usr_1',
        memoryTier: tier,
        category: data.category || 'preferences',
        content: data.content || '',
        embedding: vector,
        importance: data.importance || 0.8,
        confidence: data.confidence || 0.9,
        source: data.source || 'explicit_user',
        status: 'active',
        validFrom: data.validFrom || null,
        validUntil: data.validUntil || null,
        tags: data.tags || [],
        metadata: data.metadata || {},
      });
      return this.mapDocToMemory(doc);
    }

    const newMemory: Memory = {
      _id: `mem_${Date.now()}`,
      userId: data.userId || 'usr_1',
      memoryTier: tier,
      category: data.category || 'preferences',
      content: data.content || '',
      importance: data.importance || 0.8,
      confidence: data.confidence || 0.9,
      source: data.source || 'explicit_user',
      status: 'active',
      validFrom: data.validFrom || null,
      validUntil: data.validUntil || null,
      tags: data.tags || [],
      metadata: data.metadata || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    (newMemory as any).embedding = vector;
    this.inMemoryMemories.unshift(newMemory);
    return newMemory;
  }

  public async searchRelevantMemories(queryPrompt: string, limit: number = 10): Promise<Memory[]> {
    const all = await this.getMemories();
    const queryVector = await embeddingService.generateEmbedding(queryPrompt);

    const scored = await Promise.all(
      all.map(async (mem) => {
        const memVector = (mem as any).embedding || (await embeddingService.generateEmbedding(mem.content));
        const score = embeddingService.cosineSimilarity(queryVector, memVector);
        return { mem, score };
      })
    );

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => s.mem);
  }

  public async deleteMemory(id: string): Promise<boolean> {
    if (dbConnection.getStatus().connected) {
      const res = await MemoryModel.findByIdAndDelete(id);
      return res !== null;
    }

    const index = this.inMemoryMemories.findIndex((m) => m._id === id);
    if (index === -1) return false;
    this.inMemoryMemories.splice(index, 1);
    return true;
  }

  private mapDocToMemory(doc: any): Memory {
    return {
      _id: doc._id.toString(),
      userId: doc.userId,
      memoryTier: doc.memoryTier || 'long_term',
      category: doc.category,
      content: doc.content,
      importance: doc.importance,
      confidence: doc.confidence,
      source: doc.source,
      status: doc.status,
      validFrom: doc.validFrom,
      validUntil: doc.validUntil,
      tags: doc.tags,
      metadata: doc.metadata,
      createdAt: doc.createdAt ? doc.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : new Date().toISOString(),
      lastUsedAt: doc.lastUsedAt,
    };
  }
}
