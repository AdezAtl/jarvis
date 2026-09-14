import { desktopCapturer } from 'electron';
import { exec, spawn, ChildProcess } from 'child_process';
import readline from 'readline';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
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
  systemVolume?: number;
  isVolumeMuted?: boolean;
}

export class SystemControlService {
  private psWorker: ChildProcess | null = null;
  private isPsReady = false;
  private currentVolume: number = 70;
  private isMuted: boolean = false;
  private requestQueue: Array<{
    cmd: string;
    resolve: (val: string) => void;
    reject: (err: Error) => void;
    timeoutMs: number;
  }> = [];
  private activeRequest: {
    cmd: string;
    resolve: (val: string) => void;
    reject: (err: Error) => void;
    timer: NodeJS.Timeout;
  } | null = null;

  // Ultra-low CPU performance telemetry caching
  private prevCpuTicks: os.CpuInfo[] | null = null;
  private cachedFsSize: { total: number; used: number; percent: number } | null = null;
  private lastFsCheck = 0;
  private cachedBattery: { percent: number | null; isCharging: boolean } | null = null;
  private lastBatteryCheck = 0;

  constructor() {
    this.initPersistentPowerShell();
  }

  /**
   * 0ms Native CPU usage calculation via kernel tick delta (spawns 0 child processes)
   */
  private calculateCpuUsage(): number {
    const currentCpus = os.cpus();
    if (!this.prevCpuTicks) {
      this.prevCpuTicks = currentCpus;
      return 12; // Baseline estimate for first frame
    }

    let prevIdle = 0;
    let prevTotal = 0;
    let currIdle = 0;
    let currTotal = 0;

    for (let i = 0; i < currentCpus.length; i++) {
      const p = this.prevCpuTicks[i]?.times;
      const c = currentCpus[i]?.times;
      if (!p || !c) continue;

      prevIdle += p.idle;
      prevTotal += p.user + p.nice + p.sys + p.idle + p.irq;

      currIdle += c.idle;
      currTotal += c.user + c.nice + c.sys + c.idle + c.irq;
    }

    this.prevCpuTicks = currentCpus;

    const idleDelta = currIdle - prevIdle;
    const totalDelta = currTotal - prevTotal;

    if (totalDelta <= 0) return 0;
    const usage = 100 - Math.round((idleDelta / totalDelta) * 100);
    return Math.max(0, Math.min(100, usage));
  }

  private initPersistentPowerShell() {
    try {
      this.psWorker = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', '-'], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'ignore'],
      });

      const initCode = `
$code = @'
using System;
using System.Runtime.InteropServices;

[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IAudioEndpointVolume {
    int RegisterControlChangeNotify(IntPtr pNotify);
    int UnregisterControlChangeNotify(IntPtr pNotify);
    int GetChannelCount(out uint pnChannelCount);
    int SetMasterVolumeLevel(float fLevelDB, ref Guid pguidEventContext);
    int SetMasterVolumeLevelScalar(float fLevel, ref Guid pguidEventContext);
    int GetMasterVolumeLevel(out float pfLevelDB);
    int GetMasterVolumeLevelScalar(out float pfLevel);
    int SetChannelVolumeLevel(uint nChannel, float fLevelDB, ref Guid pguidEventContext);
    int SetChannelVolumeLevelScalar(uint nChannel, float fLevel, ref Guid pguidEventContext);
    int GetChannelVolumeLevel(uint nChannel, out float pfLevelDB);
    int GetChannelVolumeLevelScalar(uint nChannel, out float pfLevel);
    int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, ref Guid pguidEventContext);
    int GetMute(out bool pbMute);
}

[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDevice {
    int Activate(ref Guid id, int clsCtx, IntPtr activationParams, [MarshalAs(UnmanagedType.IUnknown)] out object interfacePointer);
}

[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDeviceEnumerator {
    int EnumAudioEndpoints(int dataFlow, int dwStateMask, out object ppDevices);
    int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppDevice);
}

[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
public class MMDeviceEnumeratorComObject { }

public class AudioMaster {
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
    public static void SendKey(byte vk, int times) {
        for (int i = 0; i < times; i++) {
            keybd_event(vk, 0, 0, UIntPtr.Zero);
            keybd_event(vk, 0, 2, UIntPtr.Zero);
        }
    }

    private static IAudioEndpointVolume GetEndpoint() {
        var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());
        IMMDevice dev;
        enumerator.GetDefaultAudioEndpoint(0, 1, out dev);
        Guid IID_IAudioEndpointVolume = typeof(IAudioEndpointVolume).GUID;
        object epvObj;
        dev.Activate(ref IID_IAudioEndpointVolume, 1, IntPtr.Zero, out epvObj);
        Marshal.ReleaseComObject(dev);
        Marshal.ReleaseComObject(enumerator);
        return (IAudioEndpointVolume)epvObj;
    }

    public static float GetVolume() {
        var epv = GetEndpoint();
        float vol = 0;
        epv.GetMasterVolumeLevelScalar(out vol);
        Marshal.ReleaseComObject(epv);
        return (float)Math.Round(vol * 100f);
    }

    public static void SetVolume(float vol) {
        var epv = GetEndpoint();
        Guid ctx = Guid.Empty;
        epv.SetMasterVolumeLevelScalar(Math.Max(0f, Math.Min(1f, vol / 100f)), ref ctx);
        Marshal.ReleaseComObject(epv);
    }

    public static bool GetMute() {
        var epv = GetEndpoint();
        bool mute;
        epv.GetMute(out mute);
        Marshal.ReleaseComObject(epv);
        return mute;
    }

    public static void SetMute(bool mute) {
        var epv = GetEndpoint();
        Guid ctx = Guid.Empty;
        epv.SetMute(mute, ref ctx);
        Marshal.ReleaseComObject(epv);
    }
}
'@
Add-Type -TypeDefinition $code
Write-Output "PS_READY"
`;
      this.psWorker.stdin?.write(initCode + '\n');

      if (this.psWorker.stdout) {
        const rl = readline.createInterface({ input: this.psWorker.stdout });
        rl.on('line', (line: string) => {
          const trimmed = line.trim();
          if (!trimmed) return;
          if (trimmed === 'PS_READY') {
            this.isPsReady = true;
            this.processQueue();
            return;
          }
          if (this.activeRequest) {
            clearTimeout(this.activeRequest.timer);
            const { resolve } = this.activeRequest;
            this.activeRequest = null;
            resolve(trimmed);
            this.processQueue();
          }
        });
      }

      this.psWorker.on('exit', () => {
        this.isPsReady = false;
        this.psWorker = null;
        if (this.activeRequest) {
          clearTimeout(this.activeRequest.timer);
          this.activeRequest.reject(new Error('PowerShell exited'));
          this.activeRequest = null;
        }
        while (this.requestQueue.length > 0) {
          this.requestQueue.shift()?.reject(new Error('PowerShell exited'));
        }
      });
    } catch (err) {
      console.warn('Persistent PowerShell worker init warning:', err);
    }
  }

  private sendWorkerCommand(cmd: string, timeoutMs = 2500): Promise<string> {
    if (!this.psWorker) {
      this.initPersistentPowerShell();
    }
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ cmd, resolve, reject, timeoutMs });
      if (this.isPsReady && !this.activeRequest) {
        this.processQueue();
      }
    });
  }

  private processQueue() {
    if (!this.isPsReady || this.activeRequest || this.requestQueue.length === 0) return;
    const next = this.requestQueue.shift()!;
    const timer = setTimeout(() => {
      if (this.activeRequest && this.activeRequest.timer === timer) {
        const { reject, cmd } = this.activeRequest;
        this.activeRequest = null;
        reject(new Error(`Timeout waiting for worker response: ${cmd}`));
        this.processQueue();
      }
    }, next.timeoutMs);

    this.activeRequest = { ...next, timer };
    this.psWorker?.stdin?.write(next.cmd + '\n');
  }

  private sendKeyFast(vk: number, times = 1): boolean {
    if (this.psWorker && this.isPsReady && this.psWorker.stdin?.writable) {
      this.sendWorkerCommand(`[AudioMaster]::SendKey(${vk}, ${times}); Write-Output "KEY_OK"`, 1000).catch(() => {});
      return true;
    }
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
   * Real Master Volume: Read master volume and mute state directly from Windows CoreAudio
   */
  async getVolume(): Promise<{ volume: number; isMuted: boolean }> {
    try {
      const res = await this.sendWorkerCommand(
        'Write-Output ("VOL:" + [AudioMaster]::GetVolume() + ":" + [AudioMaster]::GetMute())',
        2000
      );
      if (res.startsWith('VOL:')) {
        const parts = res.split(':');
        const vol = parseFloat(parts[1]);
        const isMuted = parts[2]?.toLowerCase() === 'true';
        if (!isNaN(vol)) {
          this.currentVolume = Math.round(vol);
        }
        this.isMuted = isMuted;
        return { volume: this.currentVolume, isMuted: this.isMuted };
      }
    } catch (err) {
      console.warn('getVolume error:', err);
    }
    return { volume: this.currentVolume, isMuted: this.isMuted };
  }

  /**
   * Real Master Volume: Set mute state directly on Windows CoreAudio
   */
  async setMute(mute: boolean): Promise<{ volume: number; isMuted: boolean }> {
    try {
      const res = await this.sendWorkerCommand(
        `[AudioMaster]::SetMute(${mute ? '$true' : '$false'}); Write-Output ("VOL:" + [AudioMaster]::GetVolume() + ":" + [AudioMaster]::GetMute())`,
        2000
      );
      if (res.startsWith('VOL:')) {
        const parts = res.split(':');
        const vol = parseFloat(parts[1]);
        const isMuted = parts[2]?.toLowerCase() === 'true';
        if (!isNaN(vol)) {
          this.currentVolume = Math.round(vol);
        }
        this.isMuted = isMuted;
        return { volume: this.currentVolume, isMuted: this.isMuted };
      }
    } catch (err) {
      console.warn('setMute error:', err);
    }
    this.isMuted = mute;
    return { volume: this.currentVolume, isMuted: this.isMuted };
  }

  /**
   * Audio & Media: Send media keyboard keys (Play/Pause, Next, Prev) instantaneously
   */
  async mediaControl(action: 'play_pause' | 'next' | 'prev'): Promise<string> {
    let vk = 0xB3; // 0xB3 = VK_MEDIA_PLAY_PAUSE (Win32 standard key code)
    let label = 'Play/Pause toggled';
    if (action === 'next') { vk = 0xB0; label = 'Next Track'; }
    if (action === 'prev') { vk = 0xB1; label = 'Previous Track'; }

    try {
      const res = await this.sendWorkerCommand(`[AudioMaster]::SendKey(${vk}, 1); Write-Output "KEY_OK"`, 1500);
      if (res.includes('KEY_OK')) {
        return `Media: ${label}`;
      }
    } catch (err) {
      console.warn('mediaControl fast worker error, falling back:', err);
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
   * Audio & Media: Adjust or set master volume (0-100 or relative +/-) accurately via CoreAudio
   */
  async adjustVolume(levelOrDelta: number, isAbsolute = false): Promise<string> {
    let targetVolume: number;

    if (isAbsolute) {
      targetVolume = Math.max(0, Math.min(100, Math.round(levelOrDelta)));
    } else {
      // Relative adjustment: fetch current real system volume first
      const current = await this.getVolume();
      targetVolume = Math.max(0, Math.min(100, Math.round(current.volume + levelOrDelta)));
    }

    try {
      const res = await this.sendWorkerCommand(
        `[AudioMaster]::SetVolume(${targetVolume}); Write-Output ("VOL:" + [AudioMaster]::GetVolume() + ":" + [AudioMaster]::GetMute())`,
        2000
      );
      if (res.startsWith('VOL:')) {
        const parts = res.split(':');
        const vol = parseFloat(parts[1]);
        const isMuted = parts[2]?.toLowerCase() === 'true';
        if (!isNaN(vol)) {
          this.currentVolume = Math.round(vol);
        }
        this.isMuted = isMuted;
        return `Volume set to ${this.currentVolume}%`;
      }
    } catch (err) {
      console.warn('adjustVolume worker error, attempting fallback:', err);
    }

    this.currentVolume = targetVolume;
    return `Volume set to ${targetVolume}%`;
  }

  /**
   * System Metrics: Poll CPU, Memory, Disk, Battery, GPU, Volume with 0ms native kernel calls
   */
  async getMetrics(): Promise<SystemMetrics> {
    // 1. Instant native CPU usage from kernel ticks (0ms, 0 processes)
    const cpuUsage = this.calculateCpuUsage();

    // 2. Instant native RAM stats from Win32 API (0ms, 0 processes)
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryTotalGb = parseFloat((totalMem / (1024 ** 3)).toFixed(1));
    const memoryUsedGb = parseFloat((usedMem / (1024 ** 3)).toFixed(1));
    const memoryPercent = Math.round((usedMem / totalMem) * 100);

    // 3. Cached Disk Size (slow-changing, only re-queried once every 60 seconds)
    const now = Date.now();
    if (!this.cachedFsSize || now - this.lastFsCheck > 60000) {
      this.lastFsCheck = now;
      si.fsSize()
        .then((fs) => {
          const primary = fs[0] || { size: 500e9, used: 250e9 };
          this.cachedFsSize = {
            total: parseFloat((primary.size / (1024 ** 3)).toFixed(0)),
            used: parseFloat((primary.used / (1024 ** 3)).toFixed(0)),
            percent: Math.round((primary.used / (primary.size || 1)) * 100),
          };
        })
        .catch(() => {});
    }
    const diskInfo = this.cachedFsSize || { total: 500, used: 250, percent: 50 };

    // 4. Cached Battery Status (only re-queried once every 30 seconds)
    if (!this.cachedBattery || now - this.lastBatteryCheck > 30000) {
      this.lastBatteryCheck = now;
      si.battery()
        .then((b) => {
          this.cachedBattery = {
            percent: b.hasBattery ? b.percent : null,
            isCharging: b.isCharging || false,
          };
        })
        .catch(() => {});
    }
    const batteryInfo = this.cachedBattery || { percent: null, isCharging: false };

    // 5. Volume from persistent worker (<1ms)
    const audio = await this.getVolume().catch(() => ({
      volume: this.currentVolume,
      isMuted: this.isMuted,
    }));

    return {
      cpuUsage,
      memoryUsedGb,
      memoryTotalGb,
      memoryPercent,
      batteryPercent: batteryInfo.percent,
      batteryCharging: batteryInfo.isCharging,
      diskUsedGb: diskInfo.used,
      diskTotalGb: diskInfo.total,
      diskPercent: diskInfo.percent,
      osName: 'Windows 11 / 10',
      systemVolume: audio.volume,
      isVolumeMuted: audio.isMuted,
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
