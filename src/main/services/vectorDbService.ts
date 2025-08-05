import { LocalIndex, ItemSelector } from 'vectra'
import { app } from 'electron'
import path from 'path'

class VectorDbService {
  private index: LocalIndex
  private ready: Promise<void>

  constructor() {
    const indexPath = path.join(app.getPath('userData'), 'vector-index')
    this.index = new LocalIndex(indexPath)

    console.log('[VectorDB] Starting initialization...')
    this.ready = this.initialize()
  }

  isReady() {
    return this.ready
  }

  private async initialize(): Promise<void> {
    try {
      console.log('[VectorDB] Checking if index exists...')
      if (!(await this.index.isIndexCreated())) {
        console.log('[VectorDB] Creating new index...')
        await this.index.createIndex()
        console.log('[VectorDB] Index created successfully')
      } else {
        console.log('[VectorDB] Using existing index')
      }
      
      console.log('[VectorDB] Vector database initialized (using simple hash-based embeddings)')
    } catch (error) {
      console.error('[VectorDB] Failed to initialize:', error)
      throw error
    }
  }

  private async getEmbedding(text: string): Promise<number[]> {
    // Simple hash-based embedding for development
    // This creates a basic vector representation of the text
    const words = text.toLowerCase().split(/\s+/)
    const vector = new Array(128).fill(0)
    
    for (const word of words) {
      let hash = 0
      for (let i = 0; i < word.length; i++) {
        const char = word.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // Convert to 32bit integer
      }
      const index = Math.abs(hash) % vector.length
      vector[index] += 1
    }
    
    // Normalize the vector
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
    if (magnitude > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= magnitude
      }
    }
    
    return vector
  }

  async addItem(text: string, snapshotId: string) {
    await this.ready
    await this.index.insertItem({
      vector: await this.getEmbedding(text),
      metadata: { snapshotId, text }
    })
  }

  async query(text: string, count: number = 5): Promise<ItemSelector[]> {
    await this.ready
    const vector = await this.getEmbedding(text)
    const results = await (this.index as any).queryItems(vector, count)
    return results
  }
}

export const vectorDbService = new VectorDbService() 