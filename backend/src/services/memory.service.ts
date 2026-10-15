import { Memory } from '@ai-task-manager/shared-types';
import { dbConnection } from '../db/connection.js';
import { MemoryModel } from '../db/models/Memory.model.js';
import { embeddingService } from '../ai/embeddings.service.js';

export class MemoryService {
  private inMemoryMemories: Memory[] = [];
  private hasCleanedLegacySeeds = false;

  public async getMemories(): Promise<Memory[]> {
    if (dbConnection.getStatus().connected) {
      // Purge legacy hardcoded seed memories if present in DB
      if (!this.hasCleanedLegacySeeds) {
        this.hasCleanedLegacySeeds = true;
        await MemoryModel.deleteMany({
          $or: [
            { content: /NPTEL/i },
            { content: /Coders High/i },
            { content: /Prefers studying difficult technical subjects/i },
            { content: /Do not schedule demanding study sessions after 10:00 PM/i },
            { content: /Sensitive emotional support: If user is feeling down/i },
          ],
        }).catch((err) => console.warn('[MemoryService] Cleanup legacy seeds notice:', err));
      }

      const docs = await MemoryModel.find({}).sort({ createdAt: -1 });
      return docs.map(this.mapDocToMemory);
    }
    return this.inMemoryMemories;
  }

  public async getActiveMemories(currentDateStr?: string): Promise<{ shortTerm: Memory[]; mediumTerm: Memory[]; longTerm: Memory[] }> {
    const today = currentDateStr || new Date().toISOString().substring(0, 10);
    const all = await this.getMemories();

    const shortTerm: Memory[] = [];
    const mediumTerm: Memory[] = [];
    const longTerm: Memory[] = [];

    for (const mem of all) {
      if (mem.status === 'disabled' || mem.status === 'archived' || mem.status === 'expired') {
        continue;
      }

      if (mem.memoryTier === 'short_term') {
        if (mem.validUntil && mem.validUntil < today) {
          await this.updateMemoryStatus(mem._id, 'expired');
          continue;
        }
        shortTerm.push(mem);
      } else if (mem.memoryTier === 'medium_term') {
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

    return { shortTerm, mediumTerm, longTerm };
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
