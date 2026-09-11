import { systemControl } from './systemControl';

export interface ChatMessage {
  role: 'user' | 'model' | 'system';
  text: string;
  timestamp: number;
  toolCall?: {
    name: string;
    args: Record<string, unknown>;
    result?: string;
  };
}

export class GeminiService {
  private apiKey: string = process.env.GEMINI_API_KEY || '';
  private history: Array<{ role: 'user' | 'model'; parts: Array<Record<string, unknown>> }> = [];

  setApiKey(key: string) {
    this.apiKey = key.trim();
  }

  getApiKey(): string {
    if (!this.apiKey && process.env.GEMINI_API_KEY) {
      this.apiKey = process.env.GEMINI_API_KEY.trim();
    }
    return this.apiKey;
  }

  clearHistory() {
    this.history = [];
  }

  private getToolDeclarations() {
    return [
      {
        functionDeclarations: [
          {
            name: 'launch_application',
            description: 'Launch an installed Windows application, executable, or web URL.',
            parameters: {
              type: 'OBJECT',
              properties: {
                target: {
                  type: 'STRING',
                  description: 'Application name (e.g., spotify, chrome, notepad, calc, terminal) or file/url.',
                },
              },
              required: ['target'],
            },
          },
          {
            name: 'terminate_application',
            description: 'Close or force terminate a running application or process.',
            parameters: {
              type: 'OBJECT',
              properties: {
                processName: {
                  type: 'STRING',
                  description: 'Name of the process (e.g., notepad.exe, spotify.exe, chrome.exe).',
                },
              },
              required: ['processName'],
            },
          },
          {
            name: 'focus_application',
            description: 'Bring a running application window to the foreground.',
            parameters: {
              type: 'OBJECT',
              properties: {
                windowTitle: {
                  type: 'STRING',
                  description: 'Title or name of the application window to bring to the front.',
                },
              },
              required: ['windowTitle'],
            },
          },
          {
            name: 'adjust_volume',
            description: 'Change the master system audio volume.',
            parameters: {
              type: 'OBJECT',
              properties: {
                level: {
                  type: 'NUMBER',
                  description: 'Target volume level (0 to 100) or delta (-20 to +20).',
                },
                isAbsolute: {
                  type: 'BOOLEAN',
                  description: 'True if setting an absolute percentage (e.g. 50%), false if delta (+10, -15).',
                },
              },
              required: ['level'],
            },
          },
          {
            name: 'control_media',
            description: 'Control media playback (play/pause toggle, next track, previous track).',
            parameters: {
              type: 'OBJECT',
              properties: {
                action: {
                  type: 'STRING',
                  enum: ['play_pause', 'next', 'prev'],
                  description: 'The playback action to trigger.',
                },
              },
              required: ['action'],
            },
          },
          {
            name: 'get_system_telemetry',
            description: 'Read real-time CPU load, memory usage, disk space, and battery status.',
            parameters: {
              type: 'OBJECT',
              properties: {},
            },
          },
          {
            name: 'inspect_screen',
            description: 'Take a screenshot of the user desktop and analyze what is currently visible.',
            parameters: {
              type: 'OBJECT',
              properties: {
                query: {
                  type: 'STRING',
                  description: 'What specifically to look for or examine on the screen.',
                },
              },
            },
          },
        ],
      },
    ];
  }

  private async executeTool(name: string, args: Record<string, unknown>): Promise<string> {
    switch (name) {
      case 'launch_application':
        return await systemControl.launchApp(String(args.target || ''));
      case 'terminate_application':
        return await systemControl.terminateApp(String(args.processName || ''));
      case 'focus_application':
        return await systemControl.focusApp(String(args.windowTitle || ''));
      case 'adjust_volume':
        return await systemControl.adjustVolume(Number(args.level || 0), Boolean(args.isAbsolute ?? true));
      case 'control_media':
        return await systemControl.mediaControl((args.action as 'play_pause' | 'next' | 'prev') || 'play_pause');
      case 'get_system_telemetry': {
        const stats = await systemControl.getMetrics();
        return JSON.stringify(stats);
      }
      case 'inspect_screen': {
        return 'Screen capture initiated.';
      }
      default:
        return `Unknown tool: ${name}`;
    }
  }

  private checkFastCommand(prompt: string): { name: string; args: Record<string, unknown> } | null {
    const p = prompt.trim().toLowerCase().replace(/[.!?]/g, '');

    // Volume commands
    if (/^(volume up|vol up|increase volume|louder|turn up the volume|turn it up)$/.test(p)) {
      return { name: 'adjust_volume', args: { level: 10, isAbsolute: false } };
    }
    if (/^(volume down|vol down|decrease volume|quieter|turn down the volume|turn it down)$/.test(p)) {
      return { name: 'adjust_volume', args: { level: -10, isAbsolute: false } };
    }
    if (/^(mute|silence|turn off sound)$/.test(p)) {
      return { name: 'adjust_volume', args: { level: -100, isAbsolute: false } };
    }

    // Media commands
    if (/^(play|pause|play pause|resume|play music|pause music)$/.test(p)) {
      return { name: 'control_media', args: { action: 'play_pause' } };
    }
    if (/^(next track|next song|skip song|skip track|next)$/.test(p)) {
      return { name: 'control_media', args: { action: 'next' } };
    }
    if (/^(previous track|previous song|prev track|prev song|previous|prev)$/.test(p)) {
      return { name: 'control_media', args: { action: 'prev' } };
    }

    // App launch commands
    const launchMatch = p.match(/^(open|launch|start)\s+([a-zA-Z0-9_\-.:/]+)$/);
    if (launchMatch) {
      return { name: 'launch_application', args: { target: launchMatch[2] } };
    }

    // App terminate commands
    const killMatch = p.match(/^(close|kill|terminate|exit)\s+([a-zA-Z0-9_\-.]+)$/);
    if (killMatch) {
      return { name: 'terminate_application', args: { processName: killMatch[2] } };
    }

    return null;
  }

  async processPrompt(
    userPrompt: string,
    includeScreenCapture = false
  ): Promise<{ text: string; toolCall?: { name: string; args: Record<string, unknown>; result?: string } }> {
    // Fast path: direct system shortcuts (0ms - 5ms instant execution)
    if (!includeScreenCapture) {
      const fastCmd = this.checkFastCommand(userPrompt);
      if (fastCmd) {
        const result = await this.executeTool(fastCmd.name, fastCmd.args);
        const toolCallInfo = { name: fastCmd.name, args: fastCmd.args, result };
        const replyText = `Right away, sir. ${result}`;
        this.history.push({ role: 'user', parts: [{ text: userPrompt }] });
        this.history.push({ role: 'model', parts: [{ text: replyText }] });
        return { text: replyText, toolCall: toolCallInfo };
      }
    }

    const activeKey = this.getApiKey();
    if (!activeKey) {
      return {
        text: "Sir, I require an API key to access neural processing. Please configure your Google Gemini API key in the HUD settings.",
      };
    }

    const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${activeKey}`;

    const userParts: Array<Record<string, unknown>> = [];

    if (includeScreenCapture) {
      try {
        const screen = await systemControl.captureScreen();
        const base64Data = screen.dataUrl.replace(/^data:image\/\w+;base64,/, '');
        userParts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Data,
          },
        });
      } catch (err: unknown) {
        console.error('Screen capture error:', err);
      }
    }

    userParts.push({ text: userPrompt });

    this.history.push({
      role: 'user',
      parts: userParts,
    });

    if (this.history.length > 20) {
      this.history = this.history.slice(-20);
    }

    const systemInstruction = {
      parts: [
        {
          text: `You are J.A.R.V.I.S., a cybernetic AI assistant operating directly within the user's Windows operating system.
Your demeanor is calm, precise, British-tinted, highly capable, and efficient.
You have access to tools for system operations (launching apps, closing apps, volume control, media keys, telemetry, screen inspection).
When the user asks you to control their system, invoke the corresponding tool.
Keep verbal confirmations punchy, elegant, and definitive (e.g. "On it, sir.", "Adjusting volume now.", "Displaying telemetry.").`,
        },
      ],
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction,
          contents: this.history,
          tools: this.getToolDeclarations(),
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        let errorDetails = errText;
        try {
          const parsed = JSON.parse(errText);
          if (parsed.error?.message) {
            errorDetails = parsed.error.message;
          }
        } catch (_) {}
        return {
          text: `Neural link error (${response.status}): ${errorDetails}`,
        };
      }

      const data = await response.json();
      const candidate = data.candidates?.[0];
      if (!candidate) {
        return { text: 'I received an empty response from the neural engine, sir.' };
      }

      const content = candidate.content;
      const modelParts = content.parts || [];

      let toolCallInfo: { name: string; args: Record<string, unknown>; result?: string } | undefined;
      const functionCallPart = modelParts.find((p: Record<string, unknown>) => p.functionCall);

      if (functionCallPart && functionCallPart.functionCall) {
        const { name, args } = functionCallPart.functionCall;
        const result = await this.executeTool(name, args || {});
        toolCallInfo = { name, args, result };

        this.history.push({
          role: 'model',
          parts: modelParts,
        });

        // Fast path for operational tools: skip second 2-3s cloud roundtrip
        const operationalTools = ['adjust_volume', 'control_media', 'launch_application', 'terminate_application', 'focus_application'];
        if (operationalTools.includes(name)) {
          const quickAcks: Record<string, string> = {
            adjust_volume: `Volume updated, sir. ${result}`,
            control_media: `Media updated, sir. ${result}`,
            launch_application: `Right away, sir. ${result}`,
            terminate_application: `Understood, sir. ${result}`,
            focus_application: `Switched focus, sir. ${result}`,
          };
          const replyText = quickAcks[name] || `Executed ${name}: ${result}`;
          this.history.push({
            role: 'model',
            parts: [{ text: replyText }],
          });
          return {
            text: replyText,
            toolCall: toolCallInfo,
          };
        }

        const followUpPayload = {
          systemInstruction,
          contents: [
            ...this.history,
            {
              role: 'user',
              parts: [
                {
                  functionResponse: {
                    name,
                    response: { result },
                  },
                },
              ],
            },
          ],
        };

        const followUpRes = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(followUpPayload),
        });

        if (followUpRes.ok) {
          const followUpData = await followUpRes.json();
          const followUpText = followUpData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (followUpText) {
            this.history.push({
              role: 'model',
              parts: [{ text: followUpText }],
            });
            return {
              text: followUpText,
              toolCall: toolCallInfo,
            };
          }
        }

        return {
          text: `Executed ${name}: ${result}`,
          toolCall: toolCallInfo,
        };
      }

      const replyText = modelParts.map((p: Record<string, string>) => p.text || '').join('\n');
      this.history.push({
        role: 'model',
        parts: [{ text: replyText }],
      });

      return { text: replyText };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        text: `Error contacting Gemini API: ${errorMsg}`,
      };
    }
  }

  async processAudioPrompt(
    base64Audio: string,
    mimeType = 'audio/webm'
  ): Promise<{ text: string; toolCall?: { name: string; args: Record<string, unknown>; result?: string } }> {
    const activeKey = this.getApiKey();
    if (!activeKey) {
      return {
        text: "Sir, I require an API key to access neural processing. Please configure your Google Gemini API key in the HUD settings.",
      };
    }

    const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${activeKey}`;

    const userParts: Array<Record<string, unknown>> = [
      {
        inlineData: {
          mimeType,
          data: base64Audio,
        },
      },
      {
        text: 'Listen to this audio instruction from the user. If the user asks for a system action (launching apps, volume control, media control, telemetry, screen inspection), invoke the appropriate tool. Respond concisely and elegantly as J.A.R.V.I.S.',
      },
    ];

    this.history.push({
      role: 'user',
      parts: userParts,
    });

    if (this.history.length > 20) {
      this.history = this.history.slice(-20);
    }

    const systemInstruction = {
      parts: [
        {
          text: `You are J.A.R.V.I.S., a cybernetic AI assistant operating directly within the user's Windows operating system.
Your demeanor is calm, precise, British-tinted, highly capable, and efficient.
You have access to tools for system operations (launching apps, closing apps, volume control, media keys, telemetry, screen inspection).
When the user asks you to control their system, invoke the corresponding tool.
Keep verbal confirmations punchy, elegant, and definitive (e.g. "On it, sir.", "Adjusting volume now.", "Displaying telemetry.").`,
        },
      ],
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction,
          contents: this.history,
          tools: this.getToolDeclarations(),
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        let errorDetails = errText;
        try {
          const parsed = JSON.parse(errText);
          if (parsed.error?.message) {
            errorDetails = parsed.error.message;
          }
        } catch (_) {}
        return {
          text: `Neural audio link error (${response.status}): ${errorDetails}`,
        };
      }

      const data = await response.json();
      const candidate = data.candidates?.[0];
      if (!candidate) {
        return { text: 'I could not decipher the audio signal, sir.' };
      }

      const content = candidate.content;
      const modelParts = content.parts || [];

      let toolCallInfo: { name: string; args: Record<string, unknown>; result?: string } | undefined;
      const functionCallPart = modelParts.find((p: Record<string, unknown>) => p.functionCall);

      if (functionCallPart && functionCallPart.functionCall) {
        const { name, args } = functionCallPart.functionCall;
        const result = await this.executeTool(name, args || {});
        toolCallInfo = { name, args, result };

        this.history.push({
          role: 'model',
          parts: modelParts,
        });

        // Fast path for operational tools: skip second 2-3s cloud roundtrip
        const operationalTools = ['adjust_volume', 'control_media', 'launch_application', 'terminate_application', 'focus_application'];
        if (operationalTools.includes(name)) {
          const quickAcks: Record<string, string> = {
            adjust_volume: `Volume updated, sir. ${result}`,
            control_media: `Media updated, sir. ${result}`,
            launch_application: `Right away, sir. ${result}`,
            terminate_application: `Understood, sir. ${result}`,
            focus_application: `Switched focus, sir. ${result}`,
          };
          const replyText = quickAcks[name] || `Executed ${name}: ${result}`;
          this.history.push({
            role: 'model',
            parts: [{ text: replyText }],
          });
          return {
            text: replyText,
            toolCall: toolCallInfo,
          };
        }

        const followUpPayload = {
          systemInstruction,
          contents: [
            ...this.history,
            {
              role: 'user',
              parts: [
                {
                  functionResponse: {
                    name,
                    response: { result },
                  },
                },
              ],
            },
          ],
        };

        const followUpRes = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(followUpPayload),
        });

        if (followUpRes.ok) {
          const followUpData = await followUpRes.json();
          const followUpText = followUpData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (followUpText) {
            this.history.push({
              role: 'model',
              parts: [{ text: followUpText }],
            });
            return {
              text: followUpText,
              toolCall: toolCallInfo,
            };
          }
        }

        return {
          text: `Executed ${name}: ${result}`,
          toolCall: toolCallInfo,
        };
      }

      const replyText = modelParts.map((p: Record<string, string>) => p.text || '').join('\n');
      this.history.push({
        role: 'model',
        parts: [{ text: replyText }],
      });

      return { text: replyText };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        text: `Error processing audio with Gemini API: ${errorMsg}`,
      };
    }
  }
}

export const geminiService = new GeminiService();
