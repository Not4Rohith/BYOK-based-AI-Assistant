export class EmbeddingService {
  /**
   * Generates vector embedding array representation for memory text / query strings
   */
  public async generateEmbedding(text: string): Promise<number[]> {
    const cleanText = text.toLowerCase().trim();
    const vectorLength = 16;
    const vector: number[] = new Array(vectorLength).fill(0);

    for (let i = 0; i < cleanText.length; i++) {
      const charCode = cleanText.charCodeAt(i);
      const index = i % vectorLength;
      vector[index] += Math.sin(charCode * (i + 1));
    }

    // Normalize vector
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0)) || 1;
    return vector.map((val) => Number((val / magnitude).toFixed(4)));
  }

  /**
   * Calculates cosine similarity between two embedding vectors
   */
  public cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

export const embeddingService = new EmbeddingService();
