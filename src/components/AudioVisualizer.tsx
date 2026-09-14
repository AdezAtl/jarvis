import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  analyserNode: AnalyserNode | null;
  isActive: boolean;
  size?: number;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ analyserNode, isActive, size = 180 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;
    let lastRenderTime = 0;
    const bufferLength = analyserNode ? analyserNode.frequencyBinCount : 64;
    const dataArray = new Uint8Array(bufferLength);

    const render = (timestamp: number) => {
      // Throttle idle animation to ~20fps (50ms interval) to drop CPU load by 80%
      // When audio is actively listening, render at full 60fps
      const minInterval = isActive ? 16 : 50;
      if (timestamp - lastRenderTime < minInterval) {
        animationFrameRef.current = requestAnimationFrame(render);
        return;
      }
      lastRenderTime = timestamp;

      ctx.clearRect(0, 0, size, size);

      const centerX = size / 2;
      const centerY = size / 2;
      const baseRadius = size * 0.36;

      if (analyserNode && isActive) {
        analyserNode.getByteFrequencyData(dataArray);
      }

      const barCount = 48;
      const angleStep = (Math.PI * 2) / barCount;

      ctx.save();
      ctx.translate(centerX, centerY);

      // Disable expensive raster shadow blur when idling to avoid continuous GPU/CPU filter passes
      if (isActive) {
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 4;
      } else {
        ctx.shadowBlur = 0;
      }

      for (let i = 0; i < barCount; i++) {
        const angle = i * angleStep;

        let val = 0;
        if (analyserNode && isActive) {
          const dataIndex = Math.floor((i / barCount) * (dataArray.length / 2));
          val = (dataArray[dataIndex] / 255) * 35;
        } else {
          val = Math.sin(phase + i * 0.3) * 3 + 3;
        }

        const r1 = baseRadius;
        const r2 = baseRadius + Math.max(2, val);

        const x1 = Math.cos(angle) * r1;
        const y1 = Math.sin(angle) * r1;
        const x2 = Math.cos(angle) * r2;
        const y2 = Math.sin(angle) * r2;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = isActive ? 'rgba(0, 240, 255, 0.85)' : 'rgba(0, 240, 255, 0.3)';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.stroke();

        if (val > 10) {
          const dotX = Math.cos(angle) * (r2 + 4);
          const dotY = Math.sin(angle) * (r2 + 4);
          ctx.beginPath();
          ctx.arc(dotX, dotY, 1.2, 0, Math.PI * 2);
          ctx.fillStyle = '#00f0ff';
          ctx.fill();
        }
      }

      ctx.restore();

      phase += isActive ? 0.08 : 0.04;
      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [analyserNode, isActive, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="pointer-events-none"
    />
  );
};
