import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Phone, MapPin, CheckCircle } from 'lucide-react';
import { speak, vibrateEmergency } from '@/lib/voiceOutput';
import { useEffect, useState } from 'react';

interface EmergencyOverlayProps {
  isActive: boolean;
  location: { lat: number; lng: number } | null;
  onCancel: () => void;
  onResolve: () => void;
}

export function EmergencyOverlay({ isActive, location, onCancel, onResolve }: EmergencyOverlayProps) {
  const [countdown, setCountdown] = useState(10);
  const [phase, setPhase] = useState<'countdown' | 'active' | 'resolved'>('countdown');
  
  useEffect(() => {
    if (!isActive) {
      setCountdown(10);
      setPhase('countdown');
      return;
    }
    
    vibrateEmergency();
    speak('emergency_triggered');
    
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setPhase('active');
          clearInterval(timer);
          speak('help_coming');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [isActive]);
  
  const handleCancel = () => {
    speak('emergency_cancelled');
    onCancel();
  };
  
  const handleImOkay = () => {
    setPhase('resolved');
    setTimeout(() => {
      onResolve();
    }, 1500);
  };

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          className="fixed inset-0 z-50 bg-background/95 flex flex-col items-center justify-center p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Pulsing danger circle */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="w-[300px] h-[300px] rounded-full bg-danger/20 pulse-danger" />
          </motion.div>
          
          {phase === 'countdown' && (
            <motion.div
              className="relative z-10 flex flex-col items-center gap-8 text-center"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
            >
              <AlertTriangle className="w-24 h-24 text-danger" strokeWidth={2} />
              
              <div className="space-y-2">
                <h1 className="text-3xl font-bold text-foreground">
                  Emergency Alert
                </h1>
                <p className="text-muted-foreground text-lg">
                  Sending help in
                </p>
              </div>
              
              <motion.div
                className="text-7xl font-bold text-danger tabular-nums"
                key={countdown}
                initial={{ scale: 1.2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
              >
                {countdown}
              </motion.div>
              
              {/* Location */}
              {location && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <MapPin className="w-4 h-4" />
                  <span>Location will be shared</span>
                </div>
              )}
              
              {/* Cancel Button */}
              <motion.button
                onClick={handleCancel}
                className="
                  mt-8 px-8 py-4 rounded-full
                  bg-secondary text-foreground
                  text-xl font-semibold
                  flex items-center gap-3
                  active:scale-95
                "
                whileTap={{ scale: 0.95 }}
              >
                <X className="w-6 h-6" />
                I'm Okay
              </motion.button>
            </motion.div>
          )}
          
          {phase === 'active' && (
            <motion.div
              className="relative z-10 flex flex-col items-center gap-8 text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
              >
                <Phone className="w-20 h-20 text-safe" strokeWidth={2} />
              </motion.div>
              
              <div className="space-y-2">
                <h1 className="text-3xl font-bold text-safe">
                  Help Coming
                </h1>
                <p className="text-muted-foreground text-lg">
                  Stay where you are
                </p>
              </div>
              
              {/* Location shared */}
              {location && (
                <div className="px-4 py-3 rounded-xl bg-card border border-safe/30">
                  <div className="flex items-center gap-2 text-safe text-sm">
                    <MapPin className="w-4 h-4" />
                    <span>Location Shared</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                  </div>
                </div>
              )}
              
              {/* I'm Okay Button */}
              <motion.button
                onClick={handleImOkay}
                className="
                  mt-8 px-8 py-4 rounded-full
                  bg-safe text-safe-foreground
                  text-xl font-semibold
                  flex items-center gap-3
                  glow-safe
                  active:scale-95
                "
                whileTap={{ scale: 0.95 }}
              >
                <CheckCircle className="w-6 h-6" />
                I'm Okay Now
              </motion.button>
            </motion.div>
          )}
          
          {phase === 'resolved' && (
            <motion.div
              className="relative z-10 flex flex-col items-center gap-4 text-center"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <CheckCircle className="w-24 h-24 text-safe" strokeWidth={2} />
              </motion.div>
              <h1 className="text-2xl font-bold text-safe">
                Stay Safe
              </h1>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
