import screenshot from 'screenshot-desktop'
import Store from 'electron-store'
import { app } from 'electron'
import crypto from 'crypto'
import { ocrService } from './ocrService'
import { vectorDbService } from './vectorDbService'

const createKey = (): Buffer => {
  const secretKey = crypto.randomBytes(32)
  const keyStore = new Store({ name: 'snapshot-key' }) as any
  keyStore.set('secret', secretKey.toString('hex'))
  return secretKey
}

const getKey = (): Buffer => {
  const keyStore = new Store({ name: 'snapshot-key' }) as any
  const secret = keyStore.get('secret')

  if (secret) {
    return Buffer.from(secret, 'hex')
  }

  return createKey()
}

const ENCRYPTION_KEY = getKey()

class SnapshotService {
  private store: Store
  private intervalId: NodeJS.Timeout | null = null

  constructor() {
    this.store = new Store({
      cwd: app.getPath('userData'),
      name: 'snapshots',
      encryptionKey: ENCRYPTION_KEY
    })
  }

  start(minInterval: number, maxInterval: number) {
    if (this.intervalId) {
      this.stop()
    }
    this.scheduleNextSnapshot(minInterval, maxInterval)
  }

  stop() {
    if (this.intervalId) {
      clearTimeout(this.intervalId)
      this.intervalId = null
    }
  }

  private scheduleNextSnapshot(minInterval: number, maxInterval: number) {
    const interval = Math.random() * (maxInterval - minInterval) + minInterval
    this.intervalId = setTimeout(async () => {
      await this.takeSnapshot()
      this.scheduleNextSnapshot(minInterval, maxInterval)
    }, interval)
  }

  private async takeSnapshot() {
    try {
      const displays = await screenshot.listDisplays()
      const primaryDisplay = displays[0]

      if (primaryDisplay) {
        const imgBuffer = await screenshot({ screen: primaryDisplay.id, format: 'png' })
        const timestamp = new Date().toISOString()
        const snapshotId = `snapshot_${timestamp}`
        ;(this.store as any).set(snapshotId, imgBuffer.toString('base64'))

        // OCR the image and add to vector DB
        const text = await ocrService.recognize(imgBuffer)
        if (text && text.trim().length > 0) {
          await vectorDbService.addItem(text, snapshotId)
        }
      }
    } catch (error) {
      console.error('Failed to take snapshot:', error)
    }
  }
}

export const snapshotService = new SnapshotService() 