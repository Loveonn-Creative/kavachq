import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Settings } from 'lucide-react';
import { StartRideButton } from '@/components/StartRideButton';
import { HelpButton } from '@/components/HelpButton';
import { RideStatus } from '@/components/RideStatus';
import { EmergencyOverlay } from '@/components/EmergencyOverlay';
import { KavachLogo } from '@/components/KavachLogo';
import { DemoControls } from '@/components/DemoControls';
import { rideMonitor, type RiskEvent } from '@/lib/rideMonitor';
import { initVoice, speak, vibrateConfirm } from '@/lib/voiceOutput';
import { 
  startRideSession, 
  endRideSession, 
  saveRiskEvent, 
  saveEmergencyEvent,
  resolveEmergency 
} from '@/lib/offlineStorage';

const Index = () => {
  const [isRideActive, setIsRideActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [lastEvent, setLastEvent] = useState<RiskEvent | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);
  const [emergencyEventId, setEmergencyEventId] = useState<string | null>(null);
  const [showDemoControls, setShowDemoControls] = useState(false);
  
  // Initialize voice system
  useEffect(() => {
    initVoice();
  }, []);
  
  // Duration timer
  useEffect(() => {
    if (!isRideActive) {
      setDuration(0);
      return;
    }
    
    const timer = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
    
    return () => clearInterval(timer);
  }, [isRideActive]);
  
  // Update location periodically
  useEffect(() => {
    if (!isRideActive) return;
    
    const updateLocation = () => {
      const loc = rideMonitor.getCurrentLocation();
      if (loc) setLocation(loc);
    };
    
    const interval = setInterval(updateLocation, 5000);
    updateLocation();
    
    return () => clearInterval(interval);
  }, [isRideActive]);
  
  // Handle risk events
  const handleRiskEvent = useCallback((event: RiskEvent) => {
    setLastEvent(event);
    if (sessionId) {
      saveRiskEvent(sessionId, event);
    }
    
    // Auto-clear after 5 seconds
    setTimeout(() => {
      setLastEvent(prev => prev?.timestamp === event.timestamp ? null : prev);
    }, 5000);
  }, [sessionId]);
  
  // Handle emergency trigger
  const handleEmergency = useCallback(async () => {
    if (isEmergencyActive) return;
    
    setIsEmergencyActive(true);
    const loc = rideMonitor.getCurrentLocation();
    
    if (sessionId) {
      const eventId = await saveEmergencyEvent(
        sessionId,
        'manual',
        loc || undefined
      );
      setEmergencyEventId(eventId);
    }
  }, [sessionId, isEmergencyActive]);
  
  // Cancel emergency
  const handleCancelEmergency = useCallback(() => {
    setIsEmergencyActive(false);
    if (emergencyEventId) {
      resolveEmergency(emergencyEventId, 'false_alarm');
      setEmergencyEventId(null);
    }
  }, [emergencyEventId]);
  
  // Resolve emergency
  const handleResolveEmergency = useCallback(() => {
    setIsEmergencyActive(false);
    if (emergencyEventId) {
      resolveEmergency(emergencyEventId, 'resolved');
      setEmergencyEventId(null);
    }
  }, [emergencyEventId]);
  
  // Start ride
  const handleStartRide = async () => {
    setIsLoading(true);
    vibrateConfirm();
    
    try {
      const success = await rideMonitor.startMonitoring();
      
      if (success) {
        rideMonitor.setRiskEventHandler(handleRiskEvent);
        rideMonitor.setEmergencyHandler(handleEmergency);
        
        const loc = rideMonitor.getCurrentLocation();
        const newSessionId = await startRideSession(loc || undefined);
        
        setSessionId(newSessionId);
        setIsRideActive(true);
        setLocation(loc);
        
        speak('ride_started');
      }
    } catch (error) {
      console.error('Failed to start ride:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Stop ride
  const handleStopRide = async () => {
    vibrateConfirm();
    
    const finalState = rideMonitor.stopMonitoring();
    
    if (sessionId) {
      await endRideSession(sessionId, finalState);
    }
    
    setIsRideActive(false);
    setSessionId(null);
    setLastEvent(null);
    setLocation(null);
    
    speak('ride_ended');
  };
  
  // Demo triggers
  const handleTriggerHeat = () => {
    rideMonitor.triggerHeatWarning();
  };
  
  const handleTriggerUnsafeZone = () => {
    rideMonitor.triggerUnsafeZoneWarning();
  };

  return (
    <div className="min-h-screen min-h-dvh bg-background flex flex-col">
      {/* Header */}
      <motion.header 
        className="flex items-center justify-between px-6 py-4 safe-area-top"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <KavachLogo size="md" animated />
        
        <button
          onClick={() => setShowDemoControls(!showDemoControls)}
          className="p-2 rounded-full hover:bg-secondary transition-colors"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5 text-muted-foreground" />
        </button>
      </motion.header>
      
      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center gap-8 px-6 pb-32">
        {/* Status */}
        <RideStatus 
          isActive={isRideActive}
          duration={duration}
          lastEvent={lastEvent}
          location={location}
        />
        
        {/* Tagline (when not riding) */}
        {!isRideActive && (
          <motion.p 
            className="text-muted-foreground text-center text-lg max-w-xs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Your invisible guardian.
            <br />
            <span className="text-sm">Always watching. Never intrusive.</span>
          </motion.p>
        )}
        
        {/* Start/Stop Button */}
        <StartRideButton
          isActive={isRideActive}
          isLoading={isLoading}
          onStart={handleStartRide}
          onStop={handleStopRide}
        />
        
        {/* Hint */}
        {!isRideActive && (
          <motion.p
            className="text-xs text-muted-foreground/60 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            No login needed. No tracking when inactive.
          </motion.p>
        )}
      </main>
      
      {/* Help Button */}
      <HelpButton 
        onTrigger={handleEmergency}
        isEmergencyActive={isEmergencyActive}
      />
      
      {/* Emergency Overlay */}
      <EmergencyOverlay
        isActive={isEmergencyActive}
        location={location}
        onCancel={handleCancelEmergency}
        onResolve={handleResolveEmergency}
      />
      
      {/* Demo Controls */}
      <DemoControls
        isVisible={showDemoControls && isRideActive}
        onClose={() => setShowDemoControls(false)}
        onTriggerHeat={handleTriggerHeat}
        onTriggerUnsafeZone={handleTriggerUnsafeZone}
        onTriggerEmergency={handleEmergency}
      />
    </div>
  );
};

export default Index;
