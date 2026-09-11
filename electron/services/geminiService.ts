import { systemControl } from './systemControl';

export interface ChatMessage {
  role: 'user' | 'model' | 'system' | 'assistant';
  text: string;
  timestamp: number;
  toolCall?: {
    name: string;
    args: Record<string, unknown>;
    result?: string;
  };
}

export type AIProvider = 'groq' | 'gemini';

export interface AIModelOption {
  id: string;
  name: string;
  provider: AIProvider;
  badge: string;
}

export const SUPPORTED_MODELS: AIModelOption[] = [
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', provider: 'groq', badge: '⚡ 70B Tools' },
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', provider: 'groq', badge: '🚀 8B Fast' },
  { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 70B', provider: 'groq', badge: '🧠 DeepSeek' },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', provider: 'gemini', badge: '✨ Gemini' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'gemini', badge: '⚡ Flash 2.0' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'gemini', badge: 'Standard' },
];

export class GeminiService {
  private geminiApiKey: string = process.env.GEMINI_API_KEY || '';
  private groqApiKey: string = process.env.GROQ_API_KEY || '';
  private provider: AIProvider = 'groq';
  private model: string = 'llama-3.3-70b-versatile';

  private geminiHistory: Array<{ role: 'user' | 'model'; parts: Array<Record<string, unknown>> }> = [];
  private openAIHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];

  constructor() {
    this.groqApiKey = this.sanitizeKey(process.env.GROQ_API_KEY || '');
    this.geminiApiKey = this.sanitizeKey(process.env.GEMINI_API_KEY || '');

    // Determine default provider from environment
    if (process.env.DEFAULT_AI_PROVIDER === 'gemini') {
      this.provider = 'gemini';
      this.model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
    } else if (this.groqApiKey) {
      this.provider = 'groq';
      this.model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    } else if (this.geminiApiKey) {
      this.provider = 'gemini';
      this.model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
    }
  }

  // ---------------- CONFIGURATION & STATE ----------------

  private sanitizeKey(key: string): string {
    return (key || '').replace(/^["']|["']$/g, '').trim();
  }

  setApiKey(key: string) {
    this.geminiApiKey = this.sanitizeKey(key);
  }

  getApiKey(): string {
    if (!this.geminiApiKey && process.env.GEMINI_API_KEY) {
      this.geminiApiKey = this.sanitizeKey(process.env.GEMINI_API_KEY);
    }
    return this.geminiApiKey;
  }

  setGroqApiKey(key: string) {
    this.groqApiKey = this.sanitizeKey(key);
  }

  getGroqApiKey(): string {
    if (!this.groqApiKey && process.env.GROQ_API_KEY) {
      this.groqApiKey = this.sanitizeKey(process.env.GROQ_API_KEY);
    }
    return this.groqApiKey;
  }

  setModel(modelId: string, customProvider?: AIProvider) {
    const found = SUPPORTED_MODELS.find((m) => m.id === modelId);
    if (found) {
      this.model = found.id;
      this.provider = customProvider || found.provider;
    } else {
      this.model = modelId;
      if (customProvider) {
        this.provider = customProvider;
      } else if (modelId.startsWith('gemini')) {
        this.provider = 'gemini';
      } else {
        this.provider = 'groq';
      }
    }
  }

  getConfig() {
    return {
      provider: this.provider,
      model: this.model,
      hasGeminiKey: Boolean(this.getApiKey()),
      hasGroqKey: Boolean(this.getGroqApiKey()),
      geminiApiKey: this.getApiKey(),
      groqApiKey: this.getGroqApiKey(),
    };
  }

  clearHistory() {
    this.geminiHistory = [];
    this.openAIHistory = [];
  }

  // ---------------- SYSTEM PROMPT & TOOLS ----------------

  private getSystemInstruction(): string {
    return `You are J.A.R.V.I.S., a cybernetic AI assistant operating directly within the user's Windows operating system.
Your demeanor is calm, precise, British-tinted, highly capable, and efficient.
You have access to tools for system operations (launching apps, closing apps, volume control, media keys, telemetry, screen inspection).
When the user asks you to control their system, invoke the corresponding tool.
Keep verbal confirmations punchy, elegant, and definitive (e.g. "On it, sir.", "Adjusting volume now.", "Displaying telemetry.").`;
  }

  // Tools in Gemini schema
  private getGeminiToolDeclarations() {
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

  // Tools in OpenAI/Groq schema
  private getOpenAIToolDeclarations() {
    return [
      {
        type: 'function',
        function: {
          name: 'launch_application',
          description: 'Launch an installed Windows application, executable, or web URL.',
          parameters: {
            type: 'object',
            properties: {
              target: {
                type: 'string',
                description: 'Application name (e.g., spotify, chrome, notepad, calc, terminal) or file/url.',
              },
            },
            required: ['target'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'terminate_application',
          description: 'Close or force terminate a running application or process.',
          parameters: {
            type: 'object',
            properties: {
              processName: {
                type: 'string',
                description: 'Name of the process (e.g., notepad.exe, spotify.exe, chrome.exe).',
              },
            },
            required: ['processName'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'focus_application',
          description: 'Bring a running application window to the foreground.',
          parameters: {
            type: 'object',
            properties: {
              windowTitle: {
                type: 'string',
                description: 'Title or name of the application window to bring to the front.',
              },
            },
            required: ['windowTitle'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'adjust_volume',
          description: 'Change the master system audio volume.',
          parameters: {
            type: 'object',
            properties: {
              level: {
                type: 'number',
                description: 'Target volume level (0 to 100) or delta (-20 to +20).',
              },
              isAbsolute: {
                type: 'boolean',
                description: 'True if setting an absolute percentage (e.g. 50%), false if delta (+10, -15).',
              },
            },
            required: ['level'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'control_media',
          description: 'Control media playback (play/pause toggle, next track, previous track).',
          parameters: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                enum: ['play_pause', 'next', 'prev'],
                description: 'The playback action to trigger.',
              },
            },
            required: ['action'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_system_telemetry',
          description: 'Read real-time CPU load, memory usage, disk space, and battery status.',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'inspect_screen',
          description: 'Take a screenshot of the user desktop and analyze what is currently visible.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'What specifically to look for or examine on the screen.',
              },
            },
          },
        },
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
    if (/^(previous track|prev track|previous song|prev song|prev)$/.test(p)) {
      return { name: 'control_media', args: { action: 'prev' } };
    }

    // Quick App Launches
    if (/^(open|launch|start)\s+(chrome|browser|google chrome)$/.test(p)) {
      return { name: 'launch_application', args: { target: 'chrome' } };
    }
    if (/^(open|launch|start)\s+(spotify|music)$/.test(p)) {
      return { name: 'launch_application', args: { target: 'spotify' } };
    }
    if (/^(open|launch|start)\s+(terminal|cmd|powershell|bash)$/.test(p)) {
      return { name: 'launch_application', args: { target: 'wt' } };
    }
    if (/^(open|launch|start)\s+(calc|calculator)$/.test(p)) {
      return { name: 'launch_application', args: { target: 'calc' } };
    }
    if (/^(open|launch|start)\s+(notepad|editor|notes)$/.test(p)) {
      return { name: 'launch_application', args: { target: 'notepad' } };
    }
    if (/^(open|launch|start)\s+(task manager|taskmgr|tasks)$/.test(p)) {
      return { name: 'launch_application', args: { target: 'taskmgr' } };
    }

    // Telemetry & Hardware inspection
    if (/^(system status|system telemetry|hardware stats|pc stats|diagnostics|telemetry)$/.test(p)) {
      return { name: 'get_system_telemetry', args: {} };
    }

    return null;
  }

  // ---------------- MAIN PROMPT DISPATCHER ----------------

  async sendPrompt(
    userPrompt: string,
    includeScreenCapture = false
  ): Promise<{ text: string; toolCall?: { name: string; args: Record<string, unknown>; result?: string } }> {
    // 1. Check client-side regex fast-path for instantaneous response (<2ms)
    const fastCmd = this.checkFastCommand(userPrompt);
    if (fastCmd) {
      const result = await this.executeTool(fastCmd.name, fastCmd.args);
      const toolCallInfo = { name: fastCmd.name, args: fastCmd.args, result };
      const fastAcks: Record<string, string> = {
        adjust_volume: `Volume updated, sir. ${result}`,
        control_media: `Media state toggled, sir. ${result}`,
        launch_application: `Launching ${fastCmd.args.target}, sir. ${result}`,
        get_system_telemetry: `Displaying active hardware telemetry, sir.`,
      };
      const replyText = fastAcks[fastCmd.name] || `On it, sir. ${result}`;
      return { text: replyText, toolCall: toolCallInfo };
    }

    // 2. Dispatch to active provider
    if (this.provider === 'groq') {
      return await this.callGroq(userPrompt, includeScreenCapture);
    } else {
      return await this.callGemini(userPrompt, includeScreenCapture);
    }
  }

  async processPrompt(
    userPrompt: string,
    includeScreenCapture = false
  ): Promise<{ text: string; toolCall?: { name: string; args: Record<string, unknown>; result?: string } }> {
    return await this.sendPrompt(userPrompt, includeScreenCapture);
  }

  // ---------------- GROQ IMPLEMENTATION ----------------

  private async callGroq(
    userPrompt: string,
    includeScreenCapture = false
  ): Promise<{ text: string; toolCall?: { name: string; args: Record<string, unknown>; result?: string } }> {
    const key = this.getGroqApiKey();
    if (!key) {
      return {
        text: "Sir, I require a Groq API key to access neural processing. Please configure your key in the HUD settings, or switch to Gemini.",
      };
    }

    const endpoint = 'https://api.groq.com/openai/v1/chat/completions';

    let promptContent = userPrompt;
    if (includeScreenCapture) {
      try {
        const screen = await systemControl.captureScreen();
        promptContent += `\n[Screen Context: Screenshot captured at ${screen.width}x${screen.height}]`;
      } catch (err) {
        console.error('Screen capture error:', err);
      }
    }

    this.openAIHistory.push({
      role: 'user',
      content: promptContent,
    });

    if (this.openAIHistory.length > 20) {
      this.openAIHistory = this.openAIHistory.slice(-20);
    }

    const messages = [
      {
        role: 'system',
        content: this.getSystemInstruction(),
      },
      ...this.openAIHistory,
    ];

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: this.model || 'llama-3.3-70b-versatile',
          messages,
          tools: this.getOpenAIToolDeclarations(),
          tool_choice: 'auto',
          temperature: 0.3,
          max_tokens: 1024,
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
          text: `Groq link error (${response.status}): ${errorDetails}`,
        };
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      if (!choice || !choice.message) {
        return { text: 'I received an empty response from the Groq neural matrix, sir.' };
      }

      const message = choice.message;

      // Check for tool calls
      if (message.tool_calls && message.tool_calls.length > 0) {
        const toolCall = message.tool_calls[0];
        const fnName = toolCall.function.name;
        let fnArgs: Record<string, unknown> = {};
        try {
          fnArgs = JSON.parse(toolCall.function.arguments || '{}');
        } catch (_) {}

        const result = await this.executeTool(fnName, fnArgs);
        const toolCallInfo = { name: fnName, args: fnArgs, result };

        const quickAcks: Record<string, string> = {
          adjust_volume: `Volume updated, sir. ${result}`,
          control_media: `Media updated, sir. ${result}`,
          launch_application: `Right away, sir. ${result}`,
          terminate_application: `Understood, sir. ${result}`,
          focus_application: `Switched focus, sir. ${result}`,
          get_system_telemetry: `Displaying system telemetry on your HUD, sir.`,
        };

        const replyText = message.content || quickAcks[fnName] || `Executed ${fnName}: ${result}`;
        this.openAIHistory.push({
          role: 'assistant',
          content: replyText,
        });

        return {
          text: replyText,
          toolCall: toolCallInfo,
        };
      }

      const replyText = message.content || 'Standing by, sir.';
      this.openAIHistory.push({
        role: 'assistant',
        content: replyText,
      });

      return { text: replyText };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        text: `Error contacting Groq API: ${errorMsg}`,
      };
    }
  }

  // ---------------- GEMINI IMPLEMENTATION ----------------

  private async callGemini(
    userPrompt: string,
    includeScreenCapture = false
  ): Promise<{ text: string; toolCall?: { name: string; args: Record<string, unknown>; result?: string } }> {
    const activeKey = this.getApiKey();
    if (!activeKey) {
      return {
        text: "Sir, I require a Google Gemini API key to access neural processing. Please configure your key in the HUD settings, or switch to Groq.",
      };
    }

    const modelName = this.model || 'gemini-3.6-flash';
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

    this.geminiHistory.push({
      role: 'user',
      parts: userParts,
    });

    if (this.geminiHistory.length > 20) {
      this.geminiHistory = this.geminiHistory.slice(-20);
    }

    const systemInstruction = {
      parts: [{ text: this.getSystemInstruction() }],
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction,
          contents: this.geminiHistory,
          tools: this.getGeminiToolDeclarations(),
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
          text: `Gemini link error (${response.status}): ${errorDetails}`,
        };
      }

      const data = await response.json();
      const candidate = data.candidates?.[0];
      if (!candidate) {
        return { text: 'I received an empty response from the Gemini neural engine, sir.' };
      }

      const content = candidate.content;
      const modelParts = content.parts || [];

      // Check for function call
      const functionCallPart = modelParts.find((p: Record<string, unknown>) => p.functionCall);
      if (functionCallPart && functionCallPart.functionCall) {
        const { name, args } = functionCallPart.functionCall;
        const result = await this.executeTool(name, args);
        const toolCallInfo = { name, args, result };

        this.geminiHistory.push({
          role: 'model',
          parts: modelParts,
        });

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
          this.geminiHistory.push({
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
            ...this.geminiHistory,
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
            this.geminiHistory.push({
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
      this.geminiHistory.push({
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

  // ---------------- AUDIO TRANSCRIPTION & PROCESSING ----------------

  async processAudioPrompt(
    base64Audio: string,
    mimeType = 'audio/webm'
  ): Promise<{ text: string; toolCall?: { name: string; args: Record<string, unknown>; result?: string } }> {
    // If using Groq, transcribe via Groq Whisper then execute with active model
    if (this.provider === 'groq') {
      const groqKey = this.getGroqApiKey();
      if (!groqKey) {
        return {
          text: "Sir, I require a Groq API key for voice transcription. Please configure your key in HUD settings.",
        };
      }

      try {
        const audioBuffer = Buffer.from(base64Audio, 'base64');
        const formData = new FormData();
        const blob = new Blob([audioBuffer], { type: mimeType });
        formData.append('file', blob, 'recording.webm');
        formData.append('model', 'whisper-large-v3-turbo');
        formData.append('response_format', 'json');

        const transcribeRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${groqKey}`,
          },
          body: formData,
        });

        if (!transcribeRes.ok) {
          const errText = await transcribeRes.text();
          return { text: `Whisper transcription error (${transcribeRes.status}): ${errText}` };
        }

        const data = (await transcribeRes.json()) as { text?: string };
        const spokenText = (data.text || '').trim();

        if (!spokenText) {
          return { text: 'I did not catch that, sir. Please repeat your instruction.' };
        }

        return await this.sendPrompt(spokenText);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return { text: `Audio processing error via Groq Whisper: ${errorMsg}` };
      }
    }

    // Default to Gemini native multimodal audio
    const activeKey = this.getApiKey();
    if (!activeKey) {
      return {
        text: "Sir, I require an API key to access neural processing. Please configure your key in HUD settings.",
      };
    }

    const modelName = this.model || 'gemini-3.6-flash';
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

    this.geminiHistory.push({
      role: 'user',
      parts: userParts,
    });

    if (this.geminiHistory.length > 20) {
      this.geminiHistory = this.geminiHistory.slice(-20);
    }

    const systemInstruction = {
      parts: [{ text: this.getSystemInstruction() }],
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction,
          contents: this.geminiHistory,
          tools: this.getGeminiToolDeclarations(),
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        return { text: `Gemini audio link error (${response.status}): ${errText}` };
      }

      const data = await response.json();
      const candidate = data.candidates?.[0];
      if (!candidate) {
        return { text: 'I received an empty response from the Gemini neural audio link, sir.' };
      }

      const content = candidate.content;
      const modelParts = content.parts || [];

      const functionCallPart = modelParts.find((p: Record<string, unknown>) => p.functionCall);
      if (functionCallPart && functionCallPart.functionCall) {
        const { name, args } = functionCallPart.functionCall;
        const result = await this.executeTool(name, args);
        const toolCallInfo = { name, args, result };

        const quickAcks: Record<string, string> = {
          adjust_volume: `Volume updated, sir. ${result}`,
          control_media: `Media updated, sir. ${result}`,
          launch_application: `Right away, sir. ${result}`,
          terminate_application: `Understood, sir. ${result}`,
          focus_application: `Switched focus, sir. ${result}`,
        };

        const replyText = quickAcks[name] || `Executed ${name}: ${result}`;
        this.geminiHistory.push({
          role: 'model',
          parts: [{ text: replyText }],
        });

        return {
          text: replyText,
          toolCall: toolCallInfo,
        };
      }

      const replyText = modelParts.map((p: Record<string, string>) => p.text || '').join('\n');
      this.geminiHistory.push({
        role: 'model',
        parts: [{ text: replyText }],
      });

      return { text: replyText };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return { text: `Error processing audio: ${errorMsg}` };
    }
  }
}

export const geminiService = new GeminiService();
