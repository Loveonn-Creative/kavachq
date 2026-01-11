import { motion, AnimatePresence } from 'framer-motion';
import { Thermometer, AlertTriangle, Activity, X, Moon, Zap, Brain, Coffee } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DemoControlsProps {
  isVisible: boolean;
  onClose: () => void;
  onTriggerHeat: () => void;
  onTriggerUnsafeZone: () => void;
  onTriggerEmergency: () => void;
  onSimulateFatigue?: (level: 'mild' | 'moderate' | 'severe') => void;
  onSimulatePanic?: () => void;
  onResetFatigue?: () => void;
}

export function DemoControls({ 
  isVisible, 
  onClose, 
  onTriggerHeat, 
  onTriggerUnsafeZone, 
  onTriggerEmergency,
  onSimulateFatigue,
  onSimulatePanic,
  onResetFatigue,
}: DemoControlsProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed bottom-0 left-0 right-0 p-4 pb-8 bg-card border-t border-border safe-area-bottom z-50"
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
          
          {/* Risk Events */}
          <p className="text-xs text-muted-foreground mb-2">Risk Events</p>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Button
              variant="outline"
              onClick={onTriggerHeat}
              className="flex flex-col items-center gap-2 h-auto py-3 border-warning/30 text-warning hover:bg-warning/10"
            >
              <Thermometer className="w-5 h-5" />
              <span className="text-xs">Heat</span>
            </Button>
            
            <Button
              variant="outline"
              onClick={onTriggerUnsafeZone}
              className="flex flex-col items-center gap-2 h-auto py-3 border-primary/30 text-primary hover:bg-primary/10"
            >
              <AlertTriangle className="w-5 h-5" />
              <span className="text-xs">Unsafe</span>
            </Button>
            
            <Button
              variant="outline"
              onClick={onTriggerEmergency}
              className="flex flex-col items-center gap-2 h-auto py-3 border-danger/30 text-danger hover:bg-danger/10"
            >
              <Activity className="w-5 h-5" />
              <span className="text-xs">Fall</span>
            </Button>
          </div>
          
          {/* Fatigue Simulation */}
          {onSimulateFatigue && (
            <>
              <p className="text-xs text-muted-foreground mb-2">Fatigue Simulation</p>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <Button
                  variant="outline"
                  onClick={() => onSimulateFatigue('mild')}
                  className="flex flex-col items-center gap-1 h-auto py-3 border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10"
                >
                  <Coffee className="w-5 h-5" />
                  <span className="text-xs">Mild</span>
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => onSimulateFatigue('moderate')}
                  className="flex flex-col items-center gap-1 h-auto py-3 border-orange-500/30 text-orange-500 hover:bg-orange-500/10"
                >
                  <Moon className="w-5 h-5" />
                  <span className="text-xs">Moderate</span>
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => onSimulateFatigue('severe')}
                  className="flex flex-col items-center gap-1 h-auto py-3 border-red-500/30 text-red-500 hover:bg-red-500/10"
                >
                  <Brain className="w-5 h-5" />
                  <span className="text-xs">Severe</span>
                </Button>
                
                <Button
                  variant="outline"
                  onClick={onSimulatePanic}
                  className="flex flex-col items-center gap-1 h-auto py-3 border-purple-500/30 text-purple-500 hover:bg-purple-500/10"
                >
                  <Zap className="w-5 h-5" />
                  <span className="text-xs">Panic</span>
                </Button>
              </div>
              
              {onResetFatigue && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onResetFatigue}
                  className="w-full text-muted-foreground"
                >
                  Reset Fatigue State
                </Button>
              )}
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}