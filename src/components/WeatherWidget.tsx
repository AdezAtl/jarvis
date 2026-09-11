import React, { useState, useEffect } from 'react';
import { Cloud, Sun, Droplets, Wind, Zap, RefreshCw, MapPin } from 'lucide-react';

interface WeatherData {
  city: string;
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  icon: 'sun' | 'cloud' | 'rain' | 'storm' | 'wind';
}

export const WeatherWidget: React.FC = () => {
  const [weather, setWeather] = useState<WeatherData>({
    city: 'IBADAN, NG',
    temperature: 24,
    condition: 'OPTIMAL / CLEAR',
    humidity: 75,
    windSpeed: 8,
    icon: 'cloud',
  });
  const [loading, setLoading] = useState(false);

  const fetchWeather = async () => {
    setLoading(true);
    try {
      // Primary location: Ibadan, Oyo State, Nigeria
      const lat = 7.3775;
      const lon = 3.9470;
      const cityName = 'IBADAN, NG';

      // Fetch live weather from Open-Meteo
      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`
      );

      if (weatherRes.ok) {
        const data = await weatherRes.json();
        const current = data.current;
        const code = current.weather_code;

        let condition = 'CLEAR SKY';
        let icon: WeatherData['icon'] = 'sun';

        if (code === 0) {
          condition = 'CLEAR SKY';
          icon = 'sun';
        } else if (code >= 1 && code <= 3) {
          condition = 'PARTLY CLOUDY';
          icon = 'cloud';
        } else if (code >= 45 && code <= 48) {
          condition = 'FOG / HAZE';
          icon = 'wind';
        } else if (code >= 51 && code <= 67) {
          condition = 'PRECIPITATION';
          icon = 'rain';
        } else if (code >= 80 && code <= 82) {
          condition = 'SHOWERS';
          icon = 'rain';
        } else if (code >= 95) {
          condition = 'THUNDERSTORM';
          icon = 'storm';
        }

        setWeather({
          city: cityName,
          temperature: Math.round(current.temperature_2m),
          condition,
          humidity: current.relative_humidity_2m,
          windSpeed: Math.round(current.wind_speed_10m),
          icon,
        });
      }
    } catch (err) {
      console.warn('Weather fetch fallback active:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, 15 * 60 * 1000); // Poll every 15 mins
    return () => clearInterval(interval);
  }, []);

  const renderIcon = () => {
    switch (weather.icon) {
      case 'sun':
        return <Sun size={28} className="text-amber-400 animate-spin-slow" />;
      case 'cloud':
        return <Cloud size={28} className="text-cyan-300" />;
      case 'rain':
        return <Droplets size={28} className="text-cyan-400 animate-bounce" />;
      case 'storm':
        return <Zap size={28} className="text-amber-400 animate-pulse" />;
      case 'wind':
        return <Wind size={28} className="text-cyan-200" />;
    }
  };

  return (
    <div className="p-3.5 rounded-xl hud-panel border border-cyan-500/30 flex flex-col justify-between select-none">
      {/* Widget Header */}
      <div className="flex items-center justify-between text-xs text-cyan-400/90 font-mono mb-2">
        <div className="flex items-center gap-1.5 font-bold tracking-wider">
          <MapPin size={12} className="text-cyan-400" />
          <span className="truncate max-w-[140px]">{weather.city}</span>
        </div>
        <button
          onClick={fetchWeather}
          disabled={loading}
          className="text-cyan-400 hover:text-cyan-200 transition-colors p-1"
          title="Refresh Atmospheric Data"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Main Temperature & Condition Display */}
      <div className="flex items-center justify-between my-1">
        <div className="flex items-baseline gap-1">
          <span className="font-display text-4xl font-black text-cyan-300 text-glow">
            {weather.temperature}°
          </span>
          <span className="text-sm font-mono text-cyan-500 font-semibold">C</span>
        </div>
        <div className="flex flex-col items-end">
          {renderIcon()}
          <span className="text-[10px] font-mono text-cyan-300/90 tracking-wider font-semibold mt-1">
            {weather.condition}
          </span>
        </div>
      </div>

      {/* Humidity & Wind Telemetry */}
      <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-cyan-500/20 font-mono text-[10px]">
        <div className="flex items-center gap-1.5 text-cyan-400/80 bg-slate-950/50 p-1.5 rounded border border-cyan-500/10">
          <Droplets size={12} className="text-cyan-400" />
          <span>HUM: {weather.humidity}%</span>
        </div>
        <div className="flex items-center gap-1.5 text-cyan-400/80 bg-slate-950/50 p-1.5 rounded border border-cyan-500/10">
          <Wind size={12} className="text-cyan-400" />
          <span>WIND: {weather.windSpeed} km/h</span>
        </div>
      </div>
    </div>
  );
};
