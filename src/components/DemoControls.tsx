import { motion, AnimatePresence } from 'framer-motion';
import { Thermometer, AlertTriangle, Activity, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DemoControlsProps {
  isVisible: boolean;
  onClose: () => void;
  onTriggerHeat: () => void;
  onTriggerUnsafeZone: () => void;
  onTriggerEmergency: () => void;
}

export function DemoControls({ 
  isVisible, 
  onClose, 
  onTriggerHeat, 
  onTriggerUnsafeZone, 
  onTriggerEmergency 
}: DemoControlsProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed bottom-0 left-0 right-0 p-4 pb-8 bg-card border-t border-border safe-area-bottom"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Demo Controls
            </h3>
            <button 
              onClick={onClose}
              className="p-2 rounded-full hover:bg-secondary"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            <Button
              variant="outline"
              onClick={onTriggerHeat}
              className="flex flex-col items-center gap-2 h-auto py-4 border-warning/30 text-warning hover:bg-warning/10"
            >
              <Thermometer className="w-6 h-6" />
              <span className="text-xs">Heat Alert</span>
            </Button>
            
            <Button
              variant="outline"
              onClick={onTriggerUnsafeZone}
              className="flex flex-col items-center gap-2 h-auto py-4 border-primary/30 text-primary hover:bg-primary/10"
            >
              <AlertTriangle className="w-6 h-6" />
              <span className="text-xs">Unsafe Zone</span>
            </Button>
            
            <Button
              variant="outline"
              onClick={onTriggerEmergency}
              className="flex flex-col items-center gap-2 h-auto py-4 border-danger/30 text-danger hover:bg-danger/10"
            >
              <Activity className="w-6 h-6" />
              <span className="text-xs">Fall Detect</span>
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
