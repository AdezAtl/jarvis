# J.A.R.V.I.S. Floating System Overlay

A sci-fi cybernetic desktop HUD and floating system overlay for Windows, powered by **Electron**, **React 19**, **TypeScript**, and **Google Gemini AI**.

---

## ✨ Features

- **Cybernetic Floating Overlay**:
  - Always-on-top floating HUD with glassmorphism and holographic sci-fi UI.
  - Collapses into a minimal, draggable glowing **Core Orb** or expands into the full diagnostic dashboard.
- **Neural Intelligence (Google Gemini)**:
  - Voice and text query processing via Google Gemini models.
  - Multimodal capabilities with live desktop screen capture analysis.
  - Real-time tool execution to control Windows apps and system settings.
- **Hardware Telemetry & System Monitoring**:
  - Real-time CPU, RAM, disk, and network monitoring via `systeminformation`.
  - Visual telemetry graphs and responsive audio wave visualizers.
- **Desktop Automation & Media Controls**:
  - Launch, focus, and close Windows applications.
  - Control master system volume and media playback directly from voice or chat.
- **Global Hotkeys**:
  - `Alt + J` or `Ctrl + Shift + J`: Instant expand / collapse toggle anywhere in Windows.
  - `Esc`: Quick collapse to orb.

---

## 🛠️ Tech Stack

- **Desktop Framework**: [Electron](https://www.electronjs.org/) (Main & Preload in TypeScript)
- **Frontend**: [React 19](https://react.dev/), [Vite](https://vitejs.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/), Custom HUD animations & fonts (`Orbitron`, `Rajdhani`, `Share Tech Mono`)
- **System Metrics**: `systeminformation`
- **Icons**: [Lucide React](https://lucide.dev/)
- **AI Backend**: Google Gemini API via REST endpoint integration

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- Windows 10/11
- A [Google Gemini API Key](https://aistudio.google.com/app/apikey)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/AdezAtl/jarvis.git
   cd jarvis
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and add your Gemini API key:
   ```env
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   GEMINI_MODEL=gemini-3.6-flash
   ```
   *(Note: You can also update the key at any time inside the app via the HUD Settings modal).*

---

## 💻 Development

Run the Vite development server and Electron together concurrently:

```bash
npm run dev
```

---

## 📦 Building the Windows Application

To compile J.A.R.V.I.S. into a standalone Windows `.exe`:

```bash
npm run package:win
```

This compiles TypeScript, builds the Vite production assets, injects the custom application icon and metadata, and outputs the standalone executable to:
```
release/win-unpacked/JARVIS.exe
```

Double-click `JARVIS.exe` to run the application without needing Node.js or npm.

---

## ⌨️ Shortcuts & Controls

| Shortcut | Description |
| :--- | :--- |
| `Alt + J` | Toggle HUD expand / collapse |
| `Ctrl + Shift + J` | Secondary expand / collapse toggle |
| `Esc` | Collapse HUD to floating orb |
| **Drag Orb** | Hold left click and move cursor to reposition the floating orb anywhere on screen |

---

## 🔒 Security Note

Keep your `.env` file private and never commit your secret API keys to public repositories. Add `.env` and compiled binaries to `.gitignore`.
