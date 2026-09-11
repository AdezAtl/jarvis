import React from 'react';
import { Cpu, HardDrive, Battery, BatteryCharging, MemoryStick } from 'lucide-react';
import { SystemMetrics } from '../types/electron';

interface TelemetryRadarProps {
  metrics: SystemMetrics | null;
}

export const TelemetryRadar: React.FC<TelemetryRadarProps> = ({ metrics }) => {
  if (!metrics) {
    return (
      <div className="p-4 rounded-xl hud-panel border border-cyan-500/30 flex items-center justify-center text-xs font-mono text-cyan-400 animate-pulse">
        CALIBRATING HARDWARE TELEMETRY...
      </div>
    );
  }

  const items = [
    {
      label: 'CPU LOAD',
      value: `${metrics.cpuUsage}%`,
      percent: metrics.cpuUsage,
      icon: Cpu,
      sub: 'CORE FREQ NOMINAL',
      color: metrics.cpuUsage > 85 ? 'text-amber-400' : 'text-cyan-300',
      barColor: metrics.cpuUsage > 85 ? 'bg-amber-400' : 'bg-cyan-400',
    },
    {
      label: 'MEMORY ALLOC',
      value: `${metrics.memoryPercent}%`,
      percent: metrics.memoryPercent,
      icon: MemoryStick,
      sub: `${metrics.memoryUsedGb} / ${metrics.memoryTotalGb} GB`,
      color: metrics.memoryPercent > 88 ? 'text-amber-400' : 'text-cyan-300',
      barColor: metrics.memoryPercent > 88 ? 'bg-amber-400' : 'bg-cyan-400',
    },
    {
      label: 'SYSTEM DISK',
      value: `${metrics.diskPercent}%`,
      percent: metrics.diskPercent,
      icon: HardDrive,
      sub: `${metrics.diskUsedGb} / ${metrics.diskTotalGb} GB`,
      color: 'text-cyan-300',
      barColor: 'bg-cyan-400',
    },
    {
      label: 'POWER GRID',
      value: metrics.batteryPercent !== null ? `${metrics.batteryPercent}%` : 'AC MAINS',
      percent: metrics.batteryPercent ?? 100,
      icon: metrics.batteryCharging ? BatteryCharging : Battery,
      sub: metrics.batteryCharging ? 'CHARGING' : 'STABILIZED',
      color: 'text-cyan-300',
      barColor: 'bg-cyan-400',
    },
  ];

  return (
    <div className="p-3.5 rounded-xl hud-panel border border-cyan-500/30 flex flex-col gap-2.5 select-none">
      <div className="flex items-center justify-between text-xs font-mono text-cyan-400/90 font-bold tracking-wider">
        <span>HARDWARE DIAGNOSTICS</span>
        <span className="text-[10px] text-cyan-500 font-normal">REAL-TIME</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {items.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className="p-2 rounded bg-slate-950/60 border border-cyan-500/15 hover:border-cyan-400/40 transition-colors flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-[10px] text-cyan-400/80 mb-1">
                <span className="flex items-center gap-1 font-bold truncate">
                  <Icon size={12} className={item.color} />
                  {item.label}
                </span>
                <span className={`font-mono font-bold ${item.color}`}>{item.value}</span>
              </div>

              {/* Progress gauge bar */}
              <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden my-1">
                <div
                  className={`h-full ${item.barColor} transition-all duration-700 shadow-[0_0_8px_#00f0ff]`}
                  style={{ width: `${Math.min(100, Math.max(3, item.percent))}%` }}
                />
              </div>

              <span className="text-[9px] text-slate-400 font-mono truncate">{item.sub}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
