import { motion } from 'framer-motion';
import { Play, Square } from 'lucide-react';

interface StartRideButtonProps {
  isActive: boolean;
  isLoading: boolean;
  onStart: () => void;
  onStop: () => void;
}

export function StartRideButton({ isActive, isLoading, onStart, onStop }: StartRideButtonProps) {
  return (
    <motion.button
      onClick={isActive ? onStop : onStart}
      disabled={isLoading}
      className={`
        relative w-48 h-48 rounded-full
        flex flex-col items-center justify-center gap-3
        text-2xl font-bold uppercase tracking-wider
        transition-all duration-300
        touch-target
        ${isActive 
          ? 'bg-safe text-safe-foreground glow-safe pulse-safe' 
          : 'bg-primary text-primary-foreground glow-primary'
        }
        ${isLoading ? 'opacity-70' : ''}
        active:scale-95
      `}
      whileTap={{ scale: 0.95 }}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      {/* Ripple effect ring */}
      {isActive && (
        <motion.div
          className="absolute inset-0 rounded-full border-4 border-safe"
          initial={{ scale: 1, opacity: 0.5 }}
          animate={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
      
      {/* Icon */}
      {isActive ? (
        <Square className="w-12 h-12" strokeWidth={2.5} />
      ) : (
        <Play className="w-12 h-12 ml-2" strokeWidth={2.5} />
      )}
      
      {/* Label */}
      <span className="text-lg tracking-widest">
        {isLoading ? '...' : isActive ? 'End' : 'Start'}
      </span>
    </motion.button>
  );
}
