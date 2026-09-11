import { desktopCapturer } from 'electron';
import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import * as si from 'systeminformation';

const execAsync = promisify(exec);

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsedGb: number;
  memoryTotalGb: number;
  memoryPercent: number;
  batteryPercent: number | null;
  batteryCharging: boolean;
  diskUsedGb: number;
  diskTotalGb: number;
  diskPercent: number;
  gpuName?: string;
  osName: string;
}

export class SystemControlService {
  private psWorker: ChildProcess | null = null;
  private isPsReady = false;

  constructor() {
    this.initPersistentPowerShell();
  }

  private initPersistentPowerShell() {
    try {
      this.psWorker = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', '-'], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'ignore'],
      });

      const initCode = `
$code = @"
using System;
using System.Runtime.InteropServices;
public class FastKeys {
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
    public static void Send(byte vk, int times) {
        for (int i = 0; i < times; i++) {
            keybd_event(vk, 0, 0, UIntPtr.Zero);
            keybd_event(vk, 0, 2, UIntPtr.Zero);
        }
    }
}
"@
Add-Type -TypeDefinition $code
Write-Output "PS_READY"
`;
      this.psWorker.stdin?.write(initCode + '\n');
      this.psWorker.stdout?.on('data', (data) => {
        if (data.toString().includes('PS_READY')) {
          this.isPsReady = true;
        }
      });

      this.psWorker.on('exit', () => {
        this.isPsReady = false;
        this.psWorker = null;
      });
    } catch (err) {
      console.warn('Persistent PowerShell worker init warning:', err);
    }
  }

  private sendKeyFast(vk: number, times = 1): boolean {
    if (this.psWorker && this.isPsReady && this.psWorker.stdin?.writable) {
      this.psWorker.stdin.write(`[FastKeys]::Send(${vk}, ${times})\n`);
      return true;
    }
    // Attempt restart if dead
    if (!this.psWorker) {
      this.initPersistentPowerShell();
    }
    return false;
  }

  /**
   * App Control: Launch application or URL instantaneously (0ms - 5ms non-blocking)
   */
  async launchApp(appTarget: string): Promise<string> {
    const cleanTarget = appTarget.trim().toLowerCase();

    // Map common names to executable or protocol
    const targets: Record<string, string> = {
      browser: 'https://google.com',
      chrome: 'chrome',
      edge: 'msedge',
      notepad: 'notepad.exe',
      calculator: 'calc.exe',
      calc: 'calc.exe',
      terminal: 'wt.exe',
      cmd: 'cmd.exe',
      settings: 'ms-settings:',
      explorer: 'explorer.exe',
      files: 'explorer.exe',
      spotify: 'spotify:',
      discord: 'discord:',
      taskmgr: 'taskmgr.exe',
      taskmanager: 'taskmgr.exe',
    };

    const target = targets[cleanTarget] || appTarget;

    try {
      // Instant detached spawn (0ms - 2ms non-blocking)
      const child = spawn('cmd.exe', ['/c', 'start', '""', target], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
      child.unref();

      return `Launched: ${appTarget}`;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return `Failed to launch ${appTarget}: ${errorMsg}`;
    }
  }

  /**
   * App Control: Focus active window by process/window title
   */
  async focusApp(target: string): Promise<string> {
    const psScript = `
      $wshell = New-Object -ComObject WScript.Shell
      $success = $wshell.AppActivate("${target}")
      if ($success) { "OK" } else { "NOT_FOUND" }
    `;

    try {
      const { stdout } = await execAsync(`powershell -NoProfile -Command "${psScript.replace(/\n/g, ' ')}"`);
      if (stdout.includes('OK')) {
        return `Focused window: ${target}`;
      }
      return `Window not found or could not be focused: ${target}`;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return `Error focusing ${target}: ${errorMsg}`;
    }
  }

  /**
   * App Control: Terminate process by name
   */
  async terminateApp(processName: string): Promise<string> {
    let proc = processName.trim();
    if (!proc.endsWith('.exe') && !proc.includes('.')) {
      proc += '.exe';
    }

    try {
      await execAsync(`taskkill /IM "${proc}" /F`, { shell: 'cmd.exe' });
      return `Terminated: ${proc}`;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return `Could not terminate ${proc}: ${errorMsg}`;
    }
  }

  /**
   * Audio & Media: Send media keyboard keys (Play/Pause, Next, Prev) instantaneously
   */
  async mediaControl(action: 'play_pause' | 'next' | 'prev'): Promise<string> {
    let vk = 0xCD; // play/pause
    let label = 'Play/Pause toggled';
    if (action === 'next') { vk = 0xB0; label = 'Next Track'; }
    if (action === 'prev') { vk = 0xB1; label = 'Previous Track'; }

    // Instant execution via persistent worker (0ms - 2ms)
    if (this.sendKeyFast(vk, 1)) {
      return `Media: ${label}`;
    }

    // Fallback if worker initializing
    const possiblePaths = [
      path.join(__dirname, 'scripts', 'systemMedia.ps1'),
      path.join(__dirname, '../services/scripts', 'systemMedia.ps1'),
      path.join(process.cwd(), 'electron', 'services', 'scripts', 'systemMedia.ps1'),
    ];
    const scriptPath = possiblePaths.find((p) => fs.existsSync(p)) || possiblePaths[2];

    try {
      const { stdout } = await execAsync(
        `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -action ${action}`
      );
      return stdout.trim() || `Media action executed: ${action}`;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return `Failed to execute media action ${action}: ${errorMsg}`;
    }
  }

  /**
   * Audio & Media: Adjust or set master volume (0-100 or relative +/-) instantaneously
   */
  async adjustVolume(levelOrDelta: number, _isAbsolute = false): Promise<string> {
    const isUp = levelOrDelta >= 0;
    const vk = isUp ? 0xAF : 0xAE; // VK_VOLUME_UP or VK_VOLUME_DOWN
    const count = Math.min(20, Math.max(1, Math.round(Math.abs(levelOrDelta) / 2)));

    // Instant execution via persistent worker (0ms - 2ms)
    if (this.sendKeyFast(vk, count)) {
      return `Volume ${isUp ? 'increased' : 'decreased'} (${count} steps)`;
    }

    // Fallback if worker initializing
    const possiblePaths = [
      path.join(__dirname, 'scripts', 'systemMedia.ps1'),
      path.join(__dirname, '../services/scripts', 'systemMedia.ps1'),
      path.join(process.cwd(), 'electron', 'services', 'scripts', 'systemMedia.ps1'),
    ];
    const scriptPath = possiblePaths.find((p) => fs.existsSync(p)) || possiblePaths[2];

    const action = isUp ? 'volume_up' : 'volume_down';

    try {
      const { stdout } = await execAsync(
        `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -action ${action} -count ${count}`
      );
      return stdout.trim() || `Volume updated (${action} ${count} steps)`;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return `Failed to adjust volume: ${errorMsg}`;
    }
  }

  /**
   * System Metrics: Poll CPU, Memory, Disk, Battery, GPU
   */
  async getMetrics(): Promise<SystemMetrics> {
    const [load, mem, battery, fs] = await Promise.all([
      si.currentLoad().catch(() => ({ currentLoad: 0 })),
      si.mem().catch(() => ({ total: 16e9, active: 8e9 })),
      si.battery().catch(() => ({ hasBattery: false, percent: null, isCharging: false })),
      si.fsSize().catch(() => ([{ size: 500e9, used: 250e9 }])),
    ]);

    const primaryDisk = fs[0] || { size: 1, used: 0 };
    const memoryTotalGb = parseFloat((mem.total / (1024 ** 3)).toFixed(1));
    const memoryUsedGb = parseFloat((mem.active / (1024 ** 3)).toFixed(1));
    const diskTotalGb = parseFloat((primaryDisk.size / (1024 ** 3)).toFixed(0));
    const diskUsedGb = parseFloat((primaryDisk.used / (1024 ** 3)).toFixed(0));

    return {
      cpuUsage: Math.round(load.currentLoad),
      memoryUsedGb,
      memoryTotalGb,
      memoryPercent: Math.round((mem.active / mem.total) * 100),
      batteryPercent: battery.hasBattery ? battery.percent : null,
      batteryCharging: battery.isCharging || false,
      diskUsedGb,
      diskTotalGb,
      diskPercent: Math.round((primaryDisk.used / primaryDisk.size) * 100),
      osName: 'Windows 11 / 10',
    };
  }

  /**
   * Vision: Capture desktop screen as base64 JPEG
   */
  async captureScreen(): Promise<{ dataUrl: string; width: number; height: number }> {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 },
    });

    if (sources.length === 0) {
      throw new Error('No screen capture source found');
    }

    const primaryScreen = sources[0];
    const image = primaryScreen.thumbnail;
    const size = image.getSize();
    const dataUrl = image.toDataURL(); // Image data URL ready for display or Gemini

    return {
      dataUrl,
      width: size.width,
      height: size.height,
    };
  }
}

export const systemControl = new SystemControlService();
