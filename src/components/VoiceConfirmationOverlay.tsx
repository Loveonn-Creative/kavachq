// Voice Confirmation Overlay - appears during moderate-confidence alerts
// Simple "Say OK or Help" prompt with visual feedback

import { motion, AnimatePresence } from 'framer-motion';
import { Mic, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { voiceConfirmation, type ConfirmationResult } from '@/lib/voiceConfirmation';

interface VoiceConfirmationOverlayProps {
  isVisible: boolean;
  eventType: string;
  confidence: number;
  onResult: (result: ConfirmationResult, responseTimeMs: number) => void;
  onCancel: () => void;
  timeoutMs?: number;
}

export function VoiceConfirmationOverlay({
  isVisible,
  eventType,
  confidence,
  onResult,
  onCancel,
  timeoutMs = 5000,
}: VoiceConfirmationOverlayProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [progress, setProgress] = useState(100);
  const [result, setResult] = useState<ConfirmationResult | null>(null);

  useEffect(() => {
    if (!isVisible) {
      setTranscript('');
      setProgress(100);
      setResult(null);
      return;
    }

    // Start voice confirmation
    voiceConfirmation.start({
      onResult: (res, responseTime) => {
        setResult(res);
        // Short delay to show result before closing
        setTimeout(() => {
          onResult(res, responseTime);
        }, 800);
      },
      onListening: setIsListening,
      onTranscript: setTranscript,
      timeoutMs,
    });

    // Progress bar countdown
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / timeoutMs) * 100);
      setProgress(remaining);
      
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 50);

    return () => {
      clearInterval(interval);
      voiceConfirmation.stop();
    };
  }, [isVisible, timeoutMs, onResult]);

  const handleCancel = () => {
    voiceConfirmation.stop();
    onCancel();
  };

  const getEventLabel = (type: string): string => {
    const labels: Record<string, string> = {
      'sudden_stop': 'Sudden Stop',
      'fall_detected': 'Fall Detected',
      'long_idle': 'No Movement',
      'speed_warning': 'High Speed',
    };
    return labels[type] || 'Alert';
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Close button */}
          <button
            onClick={handleCancel}
            className="absolute top-6 right-6 p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
            aria-label="Cancel"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>

          {result ? (
            // Result state
            <motion.div
              className="flex flex-col items-center gap-4"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              {result === 'ok' ? (
                <>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                  >
                    <CheckCircle className="w-20 h-20 text-safe" />
                  </motion.div>
                  <p className="text-xl font-semibold text-safe">All Good!</p>
                </>
              ) : result === 'danger' ? (
                <>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                  >
                    <AlertTriangle className="w-20 h-20 text-danger" />
                  </motion.div>
                  <p className="text-xl font-semibold text-danger">Getting Help...</p>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-20 h-20 text-orange-500" />
                  <p className="text-xl font-semibold text-orange-500">Checking...</p>
                </>
              )}
            </motion.div>
          ) : (
            // Listening state
            <motion.div
              className="flex flex-col items-center gap-6 max-w-sm"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
            >
              {/* Alert type badge */}
              <div className="px-4 py-2 rounded-full bg-orange-500/20 border border-orange-500/30">
                <span className="text-sm font-medium text-orange-500">
                  {getEventLabel(eventType)} • {confidence}% confidence
                </span>
              </div>

              {/* Microphone icon with pulse */}
              <motion.div
                className={`relative p-8 rounded-full ${isListening ? 'bg-primary/20' : 'bg-secondary'}`}
                animate={isListening ? { scale: [1, 1.05, 1] } : {}}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <Mic className={`w-12 h-12 ${isListening ? 'text-primary' : 'text-muted-foreground'}`} />
                
                {/* Listening rings */}
                {isListening && (
                  <>
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-primary/40"
                      initial={{ scale: 1, opacity: 0.5 }}
                      animate={{ scale: 1.5, opacity: 0 }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-primary/40"
                      initial={{ scale: 1, opacity: 0.5 }}
                      animate={{ scale: 1.5, opacity: 0 }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
                    />
                  </>
                )}
              </motion.div>

              {/* Prompt text */}
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-foreground">Are you okay?</h2>
                <p className="text-muted-foreground">
                  Say <span className="font-semibold text-safe">"OK"</span> or{' '}
                  <span className="font-semibold text-danger">"Help"</span>
                </p>
              </div>

              {/* Transcript display */}
              {transcript && (
                <motion.div
                  className="px-4 py-2 rounded-lg bg-card border border-border"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <p className="text-sm text-muted-foreground">
                    Heard: <span className="text-foreground font-medium">{transcript}</span>
                  </p>
                </motion.div>
              )}

              {/* Progress bar */}
              <div className="w-full h-1 bg-secondary rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary"
                  initial={{ width: '100%' }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>

              {/* Language hint */}
              <p className="text-xs text-muted-foreground/60">
                Supports English, हिंदी, தமிழ்
              </p>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
