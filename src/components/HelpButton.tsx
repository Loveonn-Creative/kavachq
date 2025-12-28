import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

interface HelpButtonProps {
  onTrigger: () => void;
  isEmergencyActive: boolean;
}

export function HelpButton({ onTrigger, isEmergencyActive }: HelpButtonProps) {
  return (
    <motion.button
      onClick={onTrigger}
      className={`
        fixed bottom-8 right-8
        w-20 h-20 rounded-full
        flex items-center justify-center
        text-danger-foreground font-bold
        transition-all duration-300
        touch-target z-50
        ${isEmergencyActive 
          ? 'bg-danger glow-danger pulse-danger scale-110' 
          : 'bg-danger/90 hover:bg-danger hover:glow-danger'
        }
        active:scale-95
        shadow-lg
      `}
      whileTap={{ scale: 0.9 }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', delay: 0.2 }}
    >
      <AlertTriangle className="w-10 h-10" strokeWidth={2.5} />
    </motion.button>
  );
}
