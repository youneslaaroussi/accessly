import { createWorker, Worker } from 'tesseract.js'
import { app } from 'electron'
import path from 'path'

class OcrService {
  private worker: Worker | null = null
  private initializing: Promise<void> | null = null

  constructor() {
    this.initializing = this.initialize()
  }

  private async initialize(): Promise<void> {
    try {
      console.log('[OCR] Initializing Tesseract worker...')

      // Use app data directory for Tesseract cache/downloads
      const tesseractCachePath = path.join(app.getPath('userData'), 'tesseract-cache')

      this.worker = await createWorker('eng', 1, {
        cachePath: tesseractCachePath,
        logger: (m) => {
          if (m.status === 'loading frugally-xhr') {
            console.log(`[OCR] Downloading: ${m.userJobId || 'training data'}`)
          } else if (m.status === 'loaded frugally-xhr') {
            console.log(`[OCR] Downloaded: ${m.userJobId || 'training data'}`)
          } else if (m.progress && m.progress > 0) {
            console.log(`[OCR] ${m.status}: ${Math.round(m.progress * 100)}%`)
          }
        }
      })

      console.log('[OCR] Tesseract worker initialized successfully')
    } catch (error) {
      console.error('[OCR] Failed to initialize Tesseract worker:', error)
    }
  }

  public async recognize(image: Buffer): Promise<string> {
    if (!this.worker || this.initializing) {
      await this.initializing
    }
    if (!this.worker) {
      throw new Error('Tesseract worker not initialized')
    }
    const {
      data: { text }
    } = await this.worker.recognize(image)
    return text
  }

  public async recognizeWithWords(image: Buffer) {
    if (!this.worker || this.initializing) {
      await this.initializing
    }
    if (!this.worker) {
      throw new Error('Tesseract worker not initialized')
    }
    // Request blocks data which includes the word hierarchy
    const { data } = await this.worker.recognize(image, {}, { blocks: true })
    return data
  }

  public async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate()
      this.worker = null
    }
  }
}

export const ocrService = new OcrService()
