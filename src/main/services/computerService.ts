import { ocrService } from './ocrService'
import screenshot from 'screenshot-desktop'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface TextLocation {
  x: number
  y: number
  width: number
  height: number
  confidence: number
}

class ComputerService {
  public async findTextOnScreen(text: string): Promise<TextLocation | null> {
    const displays = await screenshot.listDisplays()
    const primaryDisplay = displays[0]

    if (!primaryDisplay) {
      throw new Error('No primary display found')
    }

    const imgBuffer = await screenshot({ screen: primaryDisplay.id, format: 'png' })
    const ocrResult = await ocrService.recognizeWithWords(imgBuffer)

    console.log('[Computer] OCR result structure:', JSON.stringify(ocrResult, null, 2))

    // Extract all words from the hierarchical structure: blocks -> paragraphs -> lines -> words
    const allWords: any[] = []
    if (ocrResult.blocks) {
      for (const block of ocrResult.blocks) {
        for (const paragraph of block.paragraphs) {
          for (const line of paragraph.lines) {
            for (const word of line.words) {
              allWords.push(word)
            }
          }
        }
      }
    }

    console.log('[Computer] Total words found:', allWords.length)
    console.log('[Computer] First few words:', allWords.slice(0, 3).map(w => ({ text: w.text, bbox: w.bbox })))

    // Find words that contain the search text
    const matchingWords = allWords.filter((word: any) => 
      word.text?.toLowerCase().includes(text.toLowerCase())
    )

    if (matchingWords.length > 0) {
      const firstWord = matchingWords[0]
      console.log('[Computer] First matching word:', JSON.stringify(firstWord, null, 2))
      
      // Tesseract.js bbox structure is: { x0, y0, x1, y1 }
      const bbox = firstWord.bbox
      const x = Math.round((bbox.x0 + bbox.x1) / 2)
      const y = Math.round((bbox.y0 + bbox.y1) / 2)
      const width = bbox.x1 - bbox.x0
      const height = bbox.y1 - bbox.y0
      
      return {
        x,
        y,
        width,
        height,
        confidence: firstWord.confidence || 0
      }
    }

    return null
  }

  public async moveMouse(x: number, y: number): Promise<void> {
    try {
      if (process.platform === 'win32') {
        // Use PowerShell to move mouse on Windows
        await execAsync(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y})"`)
      } else if (process.platform === 'darwin') {
        // Use AppleScript on macOS
        await execAsync(`osascript -e "tell application \\"System Events\\" to set the position of the mouse to {${x}, ${y}}"`)
      } else {
        // Use xdotool on Linux
        await execAsync(`xdotool mousemove ${x} ${y}`)
      }
    } catch (error) {
      console.error('Failed to move mouse:', error)
      throw new Error('Failed to move mouse')
    }
  }

  public async click(x?: number, y?: number): Promise<void> {
    try {
      if (x !== undefined && y !== undefined) {
        await this.moveMouse(x, y)
        // Add small delay to ensure mouse has moved
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      if (process.platform === 'win32') {
        // Use PowerShell to click on Windows
        await execAsync(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('{CLICK}')"; Add-Type -AssemblyName System.Drawing; $signature = '[DllImport(\\"user32.dll\\",CharSet=CharSet.Auto, CallingConvention=CallingConvention.StdCall)] public static extern void mouse_event(long dwFlags, long dx, long dy, long cButtons, long dwExtraInfo);'; $SendMouseClick = Add-Type -memberDefinition $signature -name \\"Win32MouseEventNew\\" -namespace Win32Functions -passThru; $SendMouseClick::mouse_event(0x00000002, 0, 0, 0, 0); $SendMouseClick::mouse_event(0x00000004, 0, 0, 0, 0)"`)
      } else if (process.platform === 'darwin') {
        // Use AppleScript on macOS
        await execAsync(`osascript -e "tell application \\"System Events\\" to click mouse button 1"`)
      } else {
        // Use xdotool on Linux
        await execAsync(`xdotool click 1`)
      }
    } catch (error) {
      console.error('Failed to click:', error)
      throw new Error('Failed to click')
    }
  }

  public async type(text: string): Promise<void> {
    try {
      const escapedText = text.replace(/"/g, '\\"')
      
      if (process.platform === 'win32') {
        // Use PowerShell to type on Windows
        await execAsync(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${escapedText}')"`)
      } else if (process.platform === 'darwin') {
        // Use AppleScript on macOS
        await execAsync(`osascript -e "tell application \\"System Events\\" to keystroke \\"${escapedText}\\""`)
      } else {
        // Use xdotool on Linux
        await execAsync(`xdotool type "${escapedText}"`)
      }
    } catch (error) {
      console.error('Failed to type:', error)
      throw new Error('Failed to type')
    }
  }

  public async scroll(direction: 'up' | 'down' | 'left' | 'right', amount: number = 3): Promise<void> {
    try {
      if (process.platform === 'win32') {
        // Use PowerShell to scroll on Windows
        const scrollDirection = direction === 'up' ? '120' : direction === 'down' ? '-120' : '0'
        await execAsync(`powershell -Command "$signature = '[DllImport(\\"user32.dll\\")]public static extern void mouse_event(int flags, int dx, int dy, int data, int extraInfo);'; $mouse = Add-Type -memberDefinition $signature -name Win32MouseEvent -namespace Win32Functions -passThru; $mouse::mouse_event(0x800, 0, 0, ${scrollDirection}, 0)"`)
      } else if (process.platform === 'darwin') {
        // Use AppleScript on macOS
        const scrollDir = direction === 'up' ? 'up' : direction === 'down' ? 'down' : direction === 'left' ? 'left' : 'right'
        await execAsync(`osascript -e "tell application \\"System Events\\" to scroll ${scrollDir} ${amount}"`)
      } else {
        // Use xdotool on Linux
        const button = direction === 'up' ? '4' : direction === 'down' ? '5' : direction === 'left' ? '6' : '7'
        for (let i = 0; i < amount; i++) {
          await execAsync(`xdotool click ${button}`)
        }
      }
    } catch (error) {
      console.error('Failed to scroll:', error)
      throw new Error('Failed to scroll')
    }
  }

  public async pressKey(key: string): Promise<void> {
    try {
      if (process.platform === 'win32') {
        // Use PowerShell to press key on Windows
        await execAsync(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('{${key.toUpperCase()}}')"`)
      } else if (process.platform === 'darwin') {
        // Use AppleScript on macOS
        const keyMap: { [key: string]: string } = {
          'enter': 'return',
          'escape': 'escape',
          'tab': 'tab',
          'space': 'space',
          'backspace': 'delete',
          'delete': 'forward delete'
        }
        const macKey = keyMap[key.toLowerCase()] || key.toLowerCase()
        await execAsync(`osascript -e "tell application \\"System Events\\" to key code (ASCII number of \\"${macKey}\\")"`)
      } else {
        // Use xdotool on Linux
        await execAsync(`xdotool key ${key}`)
      }
    } catch (error) {
      console.error('Failed to press key:', error)
      throw new Error('Failed to press key')
    }
  }

  public async getScreenSize(): Promise<{ width: number; height: number }> {
    try {
      if (process.platform === 'win32') {
        const { stdout } = await execAsync(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width; [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Height"`)
        const lines = stdout.trim().split('\n')
        return {
          width: parseInt(lines[0]),
          height: parseInt(lines[1])
        }
      } else if (process.platform === 'darwin') {
        const { stdout } = await execAsync(`system_profiler SPDisplaysDataType | grep Resolution | awk '{print $2, $4}' | head -1`)
        const [width, height] = stdout.trim().split(' ').map(Number)
        return { width, height }
      } else {
        const { stdout } = await execAsync(`xdpyinfo | grep dimensions | awk '{print $2}'`)
        const [width, height] = stdout.trim().split('x').map(Number)
        return { width, height }
      }
    } catch (error) {
      console.error('Failed to get screen size:', error)
      throw new Error('Failed to get screen size')
    }
  }

  public async takeScreenshot(): Promise<Buffer> {
    const displays = await screenshot.listDisplays()
    const primaryDisplay = displays[0]

    if (!primaryDisplay) {
      throw new Error('No primary display found')
    }

    return await screenshot({ screen: primaryDisplay.id, format: 'png' })
  }
}

export const computerService = new ComputerService()
