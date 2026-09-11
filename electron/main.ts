import { app, BrowserWindow, ipcMain, globalShortcut, screen } from 'electron';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables (.env)
dotenv.config();
if (app.isPackaged) {
  dotenv.config({ path: path.join(process.resourcesPath, '.env') });
  dotenv.config({ path: path.join(path.dirname(process.execPath), '.env') });
}

import { systemControl } from './services/systemControl';
import { geminiService } from './services/geminiService';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let isExpanded = true;

const COLLAPSED_SIZE = 36;
const EXPANDED_WIDTH = 1040;
const EXPANDED_HEIGHT = 680;

let lastOrbPosition = { x: 100, y: 100 };

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  // Default initial position in bottom-right corner
  lastOrbPosition = {
    x: screenWidth - COLLAPSED_SIZE - 20,
    y: screenHeight - COLLAPSED_SIZE - 40,
  };

  const initialWidth = isExpanded ? EXPANDED_WIDTH : COLLAPSED_SIZE;
  const initialHeight = isExpanded ? EXPANDED_HEIGHT : COLLAPSED_SIZE;
  const initialX = isExpanded
    ? Math.round((screenWidth - EXPANDED_WIDTH) / 2)
    : lastOrbPosition.x;
  const initialY = isExpanded
    ? Math.round((screenHeight - EXPANDED_HEIGHT) / 2)
    : lastOrbPosition.y;

  mainWindow = new BrowserWindow({
    width: initialWidth,
    height: initialHeight,
    x: initialX,
    y: initialY,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    hasShadow: false,
    skipTaskbar: false,
    icon: path.join(__dirname, '../build/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
    },
  });

  // Keep always on top even over full-screen apps
  mainWindow.setAlwaysOnTop(true, 'screen-saver');

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load:', errorCode, errorDescription, validatedURL);
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Automatically collapse expanded HUD when clicking outside the window
  mainWindow.on('blur', () => {
    if (isExpanded) {
      toggleWindowExpand(false);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function toggleWindowExpand(expand?: boolean) {
  if (!mainWindow) return;

  const targetState = expand !== undefined ? expand : !isExpanded;
  isExpanded = targetState;

  const currentDisplay = screen.getDisplayNearestPoint({
    x: lastOrbPosition.x,
    y: lastOrbPosition.y,
  });
  const { x: workX, y: workY, width: workWidth, height: workHeight } = currentDisplay.workArea;

  if (isExpanded) {
    // Save current orb position only if currently in small/collapsed mode
    const currentBounds = mainWindow.getBounds();
    if (currentBounds.width <= COLLAPSED_SIZE + 20) {
      lastOrbPosition = { x: currentBounds.x, y: currentBounds.y };
    }

    // Center the expanded HUD on the display
    let targetX = Math.round(workX + (workWidth - EXPANDED_WIDTH) / 2);
    let targetY = Math.round(workY + (workHeight - EXPANDED_HEIGHT) / 2);

    // Clamp inside work area
    targetX = Math.max(workX + 10, Math.min(workX + workWidth - EXPANDED_WIDTH - 10, targetX));
    targetY = Math.max(workY + 10, Math.min(workY + workHeight - EXPANDED_HEIGHT - 10, targetY));

    mainWindow.setBounds({
      x: targetX,
      y: targetY,
      width: EXPANDED_WIDTH,
      height: EXPANDED_HEIGHT,
    });
    mainWindow.focus();
  } else {
    // Restore collapsed orb bounds
    mainWindow.setBounds({
      x: lastOrbPosition.x,
      y: lastOrbPosition.y,
      width: COLLAPSED_SIZE,
      height: COLLAPSED_SIZE,
    });
  }

  // Notify renderer of synchronized window state
  mainWindow.webContents.send('window:state-changed', isExpanded);

  return { expanded: isExpanded };
}

app.whenReady().then(() => {
  createWindow();

  // Register Global Hotkeys: Alt+J and Ctrl+Shift+J to toggle J.A.R.V.I.S.
  globalShortcut.register('Alt+J', () => {
    toggleWindowExpand();
  });

  globalShortcut.register('CommandOrControl+Shift+J', () => {
    toggleWindowExpand();
  });

  // Register Shift+F9 voice listening combo
  globalShortcut.register('Shift+F9', () => {
    mainWindow?.webContents.send('voice:hotkey-listening');
  });

  if (isDev) {
    // Ctrl+Shift+I toggles detached developer tools for debugging
    globalShortcut.register('CommandOrControl+Shift+I', () => {
      if (mainWindow) {
        if (mainWindow.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools();
        } else {
          mainWindow.webContents.openDevTools({ mode: 'detach' });
        }
      }
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// ---------------- IPC Handlers ----------------

ipcMain.handle('window:toggle-expand', (_event, expand: boolean) => {
  return toggleWindowExpand(expand);
});

ipcMain.handle('window:set-position', (_event, { x, y }: { x: number; y: number }) => {
  if (mainWindow && !isExpanded) {
    mainWindow.setPosition(Math.round(x), Math.round(y));
    lastOrbPosition = { x: Math.round(x), y: Math.round(y) };
  }
});

ipcMain.handle('window:get-position', () => {
  if (mainWindow) {
    const bounds = mainWindow.getBounds();
    return { x: bounds.x, y: bounds.y };
  }
  return lastOrbPosition;
});

// System Operations
ipcMain.handle('system:get-metrics', async () => {
  return await systemControl.getMetrics();
});

ipcMain.handle('system:adjust-volume', async (_event, { level, isAbsolute }: { level: number; isAbsolute?: boolean }) => {
  return await systemControl.adjustVolume(level, isAbsolute);
});

ipcMain.handle('system:control-media', async (_event, action: 'play_pause' | 'next' | 'prev') => {
  return await systemControl.mediaControl(action);
});

ipcMain.handle('system:launch-app', async (_event, target: string) => {
  return await systemControl.launchApp(target);
});

ipcMain.handle('system:focus-app', async (_event, target: string) => {
  return await systemControl.focusApp(target);
});

ipcMain.handle('system:terminate-app', async (_event, target: string) => {
  return await systemControl.terminateApp(target);
});

ipcMain.handle('system:capture-screen', async () => {
  return await systemControl.captureScreen();
});

// Gemini Intelligence
ipcMain.handle('gemini:send-prompt', async (_event, { prompt, useVision }: { prompt: string; useVision?: boolean }) => {
  return await geminiService.processPrompt(prompt, useVision);
});

ipcMain.handle('gemini:send-audio-prompt', async (_event, { base64Audio, mimeType }: { base64Audio: string; mimeType?: string }) => {
  return await geminiService.processAudioPrompt(base64Audio, mimeType);
});

ipcMain.handle('gemini:set-key', (_event, key: string) => {
  geminiService.setApiKey(key);
});

ipcMain.handle('gemini:get-key', () => {
  return geminiService.getApiKey();
});

// Multi-Model & Groq Intelligence
ipcMain.handle('ai:set-model', (_event, { model, provider }: { model: string; provider?: 'groq' | 'gemini' }) => {
  geminiService.setModel(model, provider);
  return geminiService.getConfig();
});

ipcMain.handle('ai:get-config', () => {
  return geminiService.getConfig();
});

ipcMain.handle('ai:set-groq-key', (_event, key: string) => {
  geminiService.setGroqApiKey(key);
});

ipcMain.handle('ai:get-groq-key', () => {
  return geminiService.getGroqApiKey();
});
