export class TransientScratchpad {
  private content: string | null = null;
  private updatedAt: string | null = null;

  public write(summary: string): void {
    this.content = summary;
    this.updatedAt = new Date().toISOString();
    console.log(`[TransientScratchpad] 📝 Scratchpad written (${summary.length} chars).`);
  }

  public readAndClear(): { content: string | null; empty: boolean; updatedAt: string | null } {
    if (!this.content) {
      console.log('[TransientScratchpad] 🧹 Scratchpad read attempted, but is empty.');
      return { content: null, empty: true, updatedAt: null };
    }
    const data = { content: this.content, empty: false, updatedAt: this.updatedAt };
    console.log('[TransientScratchpad] 🧼 Scratchpad read successfully. Auto-clearing transient memory...');
    // ONE-TIME USE: Wipe immediately after reading!
    this.content = null;
    this.updatedAt = null;
    return data;
  }

  public peek(): string | null {
    return this.content;
  }

  public clear(): void {
    this.content = null;
    this.updatedAt = null;
  }
}

export const transientScratchpad = new TransientScratchpad();
