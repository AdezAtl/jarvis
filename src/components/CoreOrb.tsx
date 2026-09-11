import React, { useRef } from 'react';

interface CoreOrbProps {
  onExpand: () => void;
  status: 'idle' | 'listening' | 'thinking' | 'speaking';
  metricsSummary?: { cpu: number; ram: number };
}

export const CoreOrb: React.FC<CoreOrbProps> = ({ onExpand, status }) => {
  const isThinking = status === 'thinking';
  const isListening = status === 'listening';

  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const winStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);

  let coreColor = 'bg-cyan-400 shadow-[0_0_12px_#00f0ff]';
  let ringBorder = 'border-cyan-400/60';

  if (isThinking) {
    coreColor = 'bg-amber-400 shadow-[0_0_12px_#ffaa00]';
    ringBorder = 'border-amber-400/80';
  } else if (isListening) {
    coreColor = 'bg-emerald-400 shadow-[0_0_12px_#10b981]';
    ringBorder = 'border-emerald-400/80';
  }

  const handleMouseDown = async (e: React.MouseEvent) => {
    // Only primary (left) mouse button
    if (e.button !== 0) return;

    dragStartPosRef.current = { x: e.screenX, y: e.screenY };
    isDraggingRef.current = false;

    if (window.electronAPI) {
      try {
        const pos = await window.electronAPI.getWindowPosition();
        winStartPosRef.current = pos;
      } catch {
        winStartPosRef.current = null;
      }
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragStartPosRef.current) return;
      const dx = moveEvent.screenX - dragStartPosRef.current.x;
      const dy = moveEvent.screenY - dragStartPosRef.current.y;

      // If moved more than 4px, treat as dragging window
      if (Math.hypot(dx, dy) > 4) {
        isDraggingRef.current = true;
        if (window.electronAPI && winStartPosRef.current) {
          window.electronAPI.setWindowPosition(
            winStartPosRef.current.x + dx,
            winStartPosRef.current.y + dy
          );
        }
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      // If user did not drag, treat as a clean click to expand HUD
      if (!isDraggingRef.current) {
        onExpand();
      }

      dragStartPosRef.current = null;
      winStartPosRef.current = null;
      isDraggingRef.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      className="relative w-5 h-5 flex items-center justify-center cursor-pointer group select-none"
      onMouseDown={handleMouseDown}
      title="J.A.R.V.I.S. Core (Click or Alt+J to expand, Drag to reposition)"
    >
      {/* Outer Rotating Micro Ring (20x20) */}
      <div
        className={`absolute inset-0 rounded-full border border-dashed ${ringBorder} animate-spin-slow group-hover:scale-110 transition-transform duration-300`}
      />

      {/* Central Pulsing Glowing Core (8x8) */}
      <div
        className={`w-2 h-2 rounded-full ${coreColor} transition-all duration-300 ${
          isThinking ? 'animate-ping' : 'animate-pulse'
        }`}
      />
    </div>
  );
};
