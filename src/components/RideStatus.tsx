import { motion, AnimatePresence } from 'framer-motion';
import { Shield, MapPin, Clock, Activity } from 'lucide-react';
import type { RiskEvent } from '@/lib/rideMonitor';

interface RideStatusProps {
  isActive: boolean;
  duration: number;
  lastEvent: RiskEvent | null;
  location: { lat: number; lng: number } | null;
}

export function RideStatus({ isActive, duration, lastEvent, location }: RideStatusProps) {
  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const getEventColor = (event: RiskEvent | null): string => {
    if (!event) return 'text-safe';
    switch (event.severity) {
      case 'critical': return 'text-danger';
      case 'high': return 'text-warning';
      case 'medium': return 'text-primary';
      default: return 'text-muted-foreground';
    }
  };
  
  const getEventLabel = (type: string): string => {
    const labels: Record<string, string> = {
      speed_warning: 'Speed Alert',
      heat_warning: 'Heat Alert',
      unsafe_zone: 'Unsafe Area',
      sudden_stop: 'Sudden Stop',
      fall_detected: 'Fall Detected',
      long_idle: 'Idle Warning',
      wellness_check: 'Check-in',
    };
    return labels[type] || type;
  };

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          className="w-full max-w-sm space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {/* Status Header */}
          <div className="flex items-center justify-center gap-2 text-safe">
            <Shield className="w-5 h-5" />
            <span className="text-sm font-medium tracking-wide uppercase">
              Watching Over You
            </span>
          </div>
          
          {/* Stats Row */}
          <div className="flex items-center justify-center gap-6">
            {/* Duration */}
            <div className="flex items-center gap-2 text-foreground">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-2xl font-bold tabular-nums">
                {formatDuration(duration)}
              </span>
            </div>
            
            {/* Location indicator */}
            {location && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span className="text-xs">GPS</span>
              </div>
            )}
          </div>
          
          {/* Last Event */}
          <AnimatePresence mode="wait">
            {lastEvent && (
              <motion.div
                key={lastEvent.timestamp}
                className={`
                  flex items-center justify-center gap-2 
                  px-4 py-2 rounded-full
                  bg-card border border-border
                  ${getEventColor(lastEvent)}
                `}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <Activity className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {getEventLabel(lastEvent.type)}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
