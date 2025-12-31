// Contextual Safety Actions - appear during rides based on risk level
// No buttons when safe, actions surface when needed

import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Users, Mic, Coffee, AlertTriangle } from 'lucide-react';

interface ContextualSafetyActionsProps {
  isVisible: boolean;
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  fatigueLevel: 'none' | 'mild' | 'moderate' | 'severe';
  onOpenMap: () => void;
  onOpenContacts: () => void;
  onOpenVoice: () => void;
}

export function ContextualSafetyActions({
  isVisible,
  riskLevel,
  fatigueLevel,
  onOpenMap,
  onOpenContacts,
  onOpenVoice,
}: ContextualSafetyActionsProps) {
  // Determine which actions to show based on context
  const showMap = riskLevel !== 'none' || fatigueLevel !== 'none';
  const showContacts = riskLevel === 'high' || riskLevel === 'critical';
  const showVoice = fatigueLevel === 'moderate' || fatigueLevel === 'severe' || riskLevel === 'medium';
  const showRestPrompt = fatigueLevel === 'moderate' || fatigueLevel === 'severe';
  
  // Don't render if no actions needed
  if (!isVisible || (!showMap && !showContacts && !showVoice && !showRestPrompt)) {
    return null;
  }
  
  const getBackgroundColor = () => {
    if (riskLevel === 'critical' || fatigueLevel === 'severe') {
      return 'bg-red-500/10 border-red-500/30';
    }
    if (riskLevel === 'high' || fatigueLevel === 'moderate') {
      return 'bg-orange-500/10 border-orange-500/30';
    }
    if (riskLevel === 'medium' || fatigueLevel === 'mild') {
      return 'bg-yellow-500/10 border-yellow-500/30';
    }
    return 'bg-muted/50 border-border';
  };
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className={`fixed bottom-32 left-4 right-4 mx-auto max-w-sm ${getBackgroundColor()} border rounded-2xl p-4 backdrop-blur-sm z-40`}
      >
        {/* Status indicator */}
        {(riskLevel !== 'none' || fatigueLevel !== 'none') && (
          <div className="flex items-center gap-2 mb-3 text-sm">
            <AlertTriangle className={`w-4 h-4 ${
              riskLevel === 'critical' || fatigueLevel === 'severe' ? 'text-red-500' :
              riskLevel === 'high' || fatigueLevel === 'moderate' ? 'text-orange-500' :
              'text-yellow-500'
            }`} />
            <span className="text-muted-foreground">
              {fatigueLevel !== 'none' && fatigueLevel !== 'mild' 
                ? `Fatigue: ${fatigueLevel}` 
                : riskLevel !== 'none' 
                  ? `Risk: ${riskLevel}`
                  : 'Stay alert'}
            </span>
          </div>
        )}
        
        {/* Contextual action buttons */}
        <div className="flex gap-3 justify-center">
          {showRestPrompt && (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex flex-col items-center gap-1 p-3 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 transition-colors"
              onClick={onOpenMap}
            >
              <Coffee className="w-6 h-6 text-orange-500" />
              <span className="text-xs font-medium text-orange-600">Rest Stop</span>
            </motion.button>
          )}
          
          {showMap && !showRestPrompt && (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex flex-col items-center gap-1 p-3 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
              onClick={onOpenMap}
            >
              <MapPin className="w-6 h-6 text-blue-500" />
              <span className="text-xs font-medium text-blue-600">Nearby</span>
            </motion.button>
          )}
          
          {showVoice && (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1 }}
              className="flex flex-col items-center gap-1 p-3 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
              onClick={onOpenVoice}
            >
              <Mic className="w-6 h-6 text-purple-500" />
              <span className="text-xs font-medium text-purple-600">Talk</span>
            </motion.button>
          )}
          
          {showContacts && (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col items-center gap-1 p-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 transition-colors"
              onClick={onOpenContacts}
            >
              <Users className="w-6 h-6 text-red-500" />
              <span className="text-xs font-medium text-red-600">Contacts</span>
            </motion.button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
