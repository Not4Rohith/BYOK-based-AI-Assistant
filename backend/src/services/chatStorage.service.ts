import { ChatMessage, ChatSession } from '@ai-task-manager/shared-types';
import { dbConnection } from '../db/connection.js';
import { ChatSessionModel } from '../db/models/ChatSession.model.js';
import { ChatMessageModel } from '../db/models/ChatMessage.model.js';

export class ChatStorageService {
  private inMemorySessions: ChatSession[] = [];
  private inMemoryMessages: ChatMessage[] = [];

  public getTodayDateStr(): string {
    return new Date().toISOString().substring(0, 10);
  }

  public async getOrCreateDailySession(dateStr?: string, userId: string = 'usr_1'): Promise<ChatSession> {
    const targetDate = dateStr || this.getTodayDateStr();
    const sessionId = `session_${targetDate}`;

    if (dbConnection.getStatus().connected) {
      let doc = await ChatSessionModel.findById(sessionId);
      if (!doc) {
        const formattedDateTitle = `Chat - ${new Date(targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        doc = await ChatSessionModel.create({
          _id: sessionId,
          userId,
          date: targetDate,
          sessionType: 'daily_chat',
          title: formattedDateTitle,
          messageCount: 0,
          lastMessageAt: new Date().toISOString(),
        });
      }
      return this.mapSessionDoc(doc);
    }

    let session = this.inMemorySessions.find((s) => s._id === sessionId);
    if (!session) {
      session = {
        _id: sessionId,
        userId,
        date: targetDate,
        sessionType: 'daily_chat',
        title: `Chat - ${targetDate}`,
        messageCount: 0,
        lastMessageAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      this.inMemorySessions.unshift(session);
    }
    return session;
  }

  public async saveMessage(msg: Partial<ChatMessage>, userId: string = 'usr_1'): Promise<ChatMessage> {
    const targetDate = msg.date || this.getTodayDateStr();
    const session = await this.getOrCreateDailySession(msg.sessionId ? (msg.sessionId.replace('session_', '')) : targetDate, userId);
    const sessionId = session._id;

    const fullMessage: ChatMessage = {
      _id: msg._id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sessionId,
      date: targetDate,
      role: msg.role || 'user',
      content: msg.content || '',
      toolCalls: msg.toolCalls || [],
      tokenUsage: msg.tokenUsage || msg.metadata?.tokenUsage,
      metadata: msg.metadata || {},
      createdAt: msg.createdAt || new Date().toISOString(),
    };

    if (dbConnection.getStatus().connected) {
      await ChatMessageModel.create({
        ...fullMessage,
        _id: undefined, // Let Mongo create internal ObjectId
      });
      await ChatSessionModel.findByIdAndUpdate(sessionId, {
        $inc: { messageCount: 1 },
        $set: { lastMessageAt: new Date().toISOString() },
      });
      return fullMessage;
    }

    this.inMemoryMessages.push(fullMessage);
    const inMemSess = this.inMemorySessions.find((s) => s._id === sessionId);
    if (inMemSess) {
      inMemSess.messageCount = (inMemSess.messageCount || 0) + 1;
      inMemSess.lastMessageAt = new Date().toISOString();
    }

    return fullMessage;
  }

  public async getSessions(userId: string = 'usr_1'): Promise<ChatSession[]> {
    if (dbConnection.getStatus().connected) {
      const docs = await ChatSessionModel.find({ userId }).sort({ date: -1 });
      return docs.map(this.mapSessionDoc);
    }
    return this.inMemorySessions;
  }

  public async getMessagesBySession(sessionId: string): Promise<ChatMessage[]> {
    if (dbConnection.getStatus().connected) {
      const docs = await ChatMessageModel.find({ sessionId }).sort({ createdAt: 1 });
      return docs.map(this.mapMessageDoc);
    }
    return this.inMemoryMessages.filter((m) => m.sessionId === sessionId);
  }

  private mapSessionDoc(doc: any): ChatSession {
    return {
      _id: doc._id.toString(),
      userId: doc.userId,
      date: doc.date,
      sessionType: doc.sessionType,
      title: doc.title,
      summary: doc.summary,
      messageCount: doc.messageCount,
      lastMessageAt: doc.lastMessageAt,
      tags: doc.tags,
      metadata: doc.metadata,
      createdAt: doc.createdAt ? doc.createdAt.toISOString() : undefined,
      updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : undefined,
    };
  }

  private mapMessageDoc(doc: any): ChatMessage {
    return {
      _id: doc._id.toString(),
      sessionId: doc.sessionId,
      date: doc.date,
      role: doc.role,
      content: doc.content,
      toolCalls: doc.toolCalls,
      tokenUsage: doc.tokenUsage || doc.metadata?.tokenUsage,
      metadata: doc.metadata,
      createdAt: doc.createdAt ? doc.createdAt.toISOString() : new Date().toISOString(),
    };
  }
}

export const chatStorageService = new ChatStorageService();
