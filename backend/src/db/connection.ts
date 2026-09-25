import mongoose from 'mongoose';

export class DatabaseConnection {
  private isConnected: boolean = false;
  private uri: string | null = null;

  public async connect(connectionUri?: string): Promise<boolean> {
    let targetUri = connectionUri || this.uri;
    if (!targetUri) {
      console.log('[MongoDB] No MongoDB connection URI configured. Operating in memory fallback mode.');
      this.isConnected = false;
      return false;
    }

    // Ensure database name is appended if omitted
    if (targetUri.startsWith('mongodb+srv://') && !targetUri.includes('.net/')) {
      targetUri = targetUri.replace('.net', '.net/ai_task_manager');
    } else if (targetUri.endsWith('.net') || targetUri.endsWith('.net/')) {
      targetUri = targetUri.replace(/\/$/, '') + '/ai_task_manager';
    }

    try {
      if (this.isConnected && mongoose.connection.readyState === 1) {
        if (this.uri === targetUri) {
          return true; // Already connected to target URI
        }
        console.log('[MongoDB Atlas] Reconnecting to new MongoDB URI from app configuration...');
        await mongoose.disconnect();
      }

      // Attach resilient error listeners to prevent uncaught ECONNRESET crashes on network switches
      mongoose.connection.removeAllListeners('error');
      mongoose.connection.removeAllListeners('disconnected');

      mongoose.connection.on('error', (err) => {
        console.warn('[MongoDB Atlas] Connection socket network warning:', err.message);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        console.warn('[MongoDB Atlas] Disconnected from network. Waiting for auto-reconnect...');
        this.isConnected = false;
      });

      mongoose.connection.on('reconnected', () => {
        console.log('[MongoDB Atlas] Automatically reconnected to MongoDB Atlas!');
        this.isConnected = true;
      });

      await mongoose.connect(targetUri, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      this.isConnected = true;
      this.uri = targetUri;
      console.log(`[MongoDB Atlas] Connected successfully to database "${mongoose.connection.name}" via App Settings.`);
      return true;
    } catch (err) {
      console.warn('[MongoDB Atlas] Connection attempt failed. Using in-memory fallback.', (err as Error).message);
      this.isConnected = false;
      return false;
    }
  }

  public getStatus(): { connected: boolean; uri: string | null } {
    return {
      connected: this.isConnected && mongoose.connection.readyState === 1,
      uri: this.uri ? this.uri.replace(/:([^@]+)@/, ':***@') : null,
    };
  }

  public async disconnect(): Promise<void> {
    if (this.isConnected) {
      await mongoose.disconnect();
      this.isConnected = false;
    }
  }
}

export const dbConnection = new DatabaseConnection();

