import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon } from 'lucide-react';
import { StartRideButton } from '@/components/StartRideButton';
import { HelpButton } from '@/components/HelpButton';
import { RideStatus } from '@/components/RideStatus';
import { EmergencyOverlay } from '@/components/EmergencyOverlay';
import { KavachLogo } from '@/components/KavachLogo';
import { DemoControls } from '@/components/DemoControls';
import { EmergencyContactsSheet } from '@/components/EmergencyContactsSheet';
import { VoiceChat } from '@/components/VoiceChat';
import { SafetyMap } from '@/components/SafetyMap';
import { ContextualSafetyActions } from '@/components/ContextualSafetyActions';
import { rideMonitor, type RiskEvent } from '@/lib/rideMonitor';
import { fatigueDetector } from '@/lib/fatigueDetection';
import { weatherService, type WeatherData } from '@/lib/weatherService';
import { calculateRideScore } from '@/lib/safetyCredits';
import { initVoice, speak, vibrateConfirm } from '@/lib/voiceOutput';
import { toast } from 'sonner';
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
  const [showContacts, setShowContacts] = useState(false);
  const [showVoiceChat, setShowVoiceChat] = useState(false);
  const [showMap, setShowMap] = useState(false);
  
  // Risk and fatigue tracking
  const [riskLevel, setRiskLevel] = useState<'none' | 'low' | 'medium' | 'high' | 'critical'>('none');
  const [fatigueLevel, setFatigueLevel] = useState<'none' | 'mild' | 'moderate' | 'severe'>('none');
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  
  // Metrics tracking for safety score
  const metricsRef = useRef({
    speedViolations: 0,
    heatExposureMinutes: 0,
    warningsAcknowledged: 0,
    totalWarnings: 0,
    harshWeatherMinutes: 0,
    weatherAlertsHeeded: 0,
  });
  
  // Last weather alert time to avoid spam
  const lastWeatherAlertRef = useRef<number>(0);
  const hydrationReminderRef = useRef<number>(0);
  
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
  
  // Update location, fatigue, and weather periodically
  useEffect(() => {
    if (!isRideActive) return;
    
    const updateStatus = () => {
      // Update location
      const loc = rideMonitor.getCurrentLocation();
      if (loc) setLocation(loc);
      
      // Update fatigue level
      const newFatigueLevel = fatigueDetector.getFatigueLevel();
      setFatigueLevel(newFatigueLevel);
      
      // Get current speed for fatigue detector
      const state = rideMonitor.getState();
      fatigueDetector.updateGPSData(state.lastSpeed);
      
      // Check weather and update fatigue with temperature
      const weather = weatherService.getCachedWeather();
      if (weather) {
        setWeatherData(weather);
        fatigueDetector.updateWeatherData({
          temperature: weather.temperature,
          feelsLike: weather.feelsLike,
          humidity: weather.humidity,
        });
        
        // Track harsh weather exposure
        if (weather.feelsLike >= 35 || weather.isRaining || weather.windSpeed >= 30) {
          metricsRef.current.harshWeatherMinutes += 5 / 60; // 5 seconds increment
        }
        
        // Weather-based alerts (with debounce)
        const now = Date.now();
        const weatherRisk = weatherService.getWeatherRisk(weather);
        
        if (weatherRisk.level !== 'none' && now - lastWeatherAlertRef.current > 10 * 60 * 1000) {
          // 10 minute debounce between weather alerts
          if (weatherRisk.type === 'aqi') {
            // AQI-specific alerts
            const aqi = weather.aqi ?? 0;
            if (aqi > 300) {
              speak('aqi_hazardous');
            } else if (aqi > 200) {
              speak('aqi_very_unhealthy');
            } else if (aqi > 150) {
              speak('aqi_unhealthy');
            } else if (aqi > 100) {
              speak('aqi_sensitive');
            }
            metricsRef.current.weatherAlertsHeeded++;
            lastWeatherAlertRef.current = now;
          } else if (weatherRisk.level === 'extreme') {
            speak('extreme_heat');
            rideMonitor.triggerExtremeWeather({
              temperature: weather.temperature,
              feelsLike: weather.feelsLike,
              humidity: weather.humidity,
              windSpeed: weather.windSpeed,
              isRaining: weather.isRaining,
            });
            lastWeatherAlertRef.current = now;
          } else if (weatherRisk.type === 'rain') {
            speak('rain_warning');
            rideMonitor.triggerRainWarning({
              temperature: weather.temperature,
              feelsLike: weather.feelsLike,
              humidity: weather.humidity,
              windSpeed: weather.windSpeed,
              isRaining: weather.isRaining,
            });
            lastWeatherAlertRef.current = now;
          } else if (weatherRisk.type === 'wind') {
            speak('high_wind');
            rideMonitor.triggerWindWarning({
              temperature: weather.temperature,
              feelsLike: weather.feelsLike,
              humidity: weather.humidity,
              windSpeed: weather.windSpeed,
              isRaining: weather.isRaining,
            });
            lastWeatherAlertRef.current = now;
          } else if (weatherRisk.level === 'danger' || weatherRisk.level === 'warning') {
            speak('heat_warning');
            rideMonitor.triggerHeatWarning({
              temperature: weather.temperature,
              feelsLike: weather.feelsLike,
              humidity: weather.humidity,
              windSpeed: weather.windSpeed,
              isRaining: weather.isRaining,
            });
            lastWeatherAlertRef.current = now;
          }
        }
        
        // Hydration reminder every 30 min in heat
        if (weather.feelsLike >= 32 && now - hydrationReminderRef.current > 30 * 60 * 1000) {
          speak('hydration_reminder');
          hydrationReminderRef.current = now;
        }
      }
    };
    
    const interval = setInterval(updateStatus, 5000);
    updateStatus();
    
    return () => clearInterval(interval);
  }, [isRideActive]);
  
  // Handle risk events
  const handleRiskEvent = useCallback((event: RiskEvent) => {
    setLastEvent(event);
    if (sessionId) {
      saveRiskEvent(sessionId, event);
    }
    
    // Update metrics
    metricsRef.current.totalWarnings++;
    if (event.type === 'speed_warning') {
      metricsRef.current.speedViolations++;
    }
    if (event.type === 'heat_warning') {
      metricsRef.current.heatExposureMinutes += 5; // Approximate exposure
    }
    
    // Set risk level based on severity
    setRiskLevel(event.severity === 'critical' ? 'critical' : 
                 event.severity === 'high' ? 'high' : 
                 event.severity === 'medium' ? 'medium' : 'low');
    
    // Auto-clear risk level after 30 seconds
    setTimeout(() => {
      setRiskLevel('none');
    }, 30000);
    
    // Auto-clear event after 5 seconds
    setTimeout(() => {
      setLastEvent(prev => prev?.timestamp === event.timestamp ? null : prev);
    }, 5000);
  }, [sessionId]);
  
  // Handle emergency trigger
  const handleEmergency = useCallback(async () => {
    if (isEmergencyActive) return;
    
    setIsEmergencyActive(true);
    setRiskLevel('critical');
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
    setRiskLevel('none');
    if (emergencyEventId) {
      resolveEmergency(emergencyEventId, 'false_alarm');
      setEmergencyEventId(null);
    }
    // Count as acknowledged warning
    metricsRef.current.warningsAcknowledged++;
  }, [emergencyEventId]);
  
  // Resolve emergency
  const handleResolveEmergency = useCallback(() => {
    setIsEmergencyActive(false);
    setRiskLevel('none');
    if (emergencyEventId) {
      resolveEmergency(emergencyEventId, 'resolved');
      setEmergencyEventId(null);
    }
  }, [emergencyEventId]);
  
  // Start ride
  const handleStartRide = async () => {
    setIsLoading(true);
    vibrateConfirm();
    
    // Reset metrics
    metricsRef.current = {
      speedViolations: 0,
      heatExposureMinutes: 0,
      warningsAcknowledged: 0,
      totalWarnings: 0,
      harshWeatherMinutes: 0,
      weatherAlertsHeeded: 0,
    };
    lastWeatherAlertRef.current = 0;
    hydrationReminderRef.current = 0;
    
    try {
      const success = await rideMonitor.startMonitoring();
      
      if (success) {
        rideMonitor.setRiskEventHandler(handleRiskEvent);
        rideMonitor.setEmergencyHandler(handleEmergency);
        
        // Start fatigue detection
        fatigueDetector.startMonitoring();
        
        // Start weather monitoring
        weatherService.startMonitoring(() => rideMonitor.getCurrentLocation());
        weatherService.setWeatherUpdateHandler((data) => {
          setWeatherData(data);
          fatigueDetector.updateWeatherData({
            temperature: data.temperature,
            feelsLike: data.feelsLike,
            humidity: data.humidity,
          });
        });
        
        const loc = rideMonitor.getCurrentLocation();
        const newSessionId = await startRideSession(loc || undefined);
        
        setSessionId(newSessionId);
        setIsRideActive(true);
        setLocation(loc);
        setRiskLevel('none');
        setFatigueLevel('none');
        
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
    const fatigueState = fatigueDetector.stopMonitoring();
    const fatigueMetrics = fatigueDetector.getMetrics();
    
    // Stop weather monitoring
    weatherService.stopMonitoring();
    
    if (sessionId) {
      await endRideSession(sessionId, finalState);
      
      // Calculate and save safety score with weather data
      const totalMinutes = duration / 60;
      const rideScore = calculateRideScore(sessionId, {
        accelerationVariance: fatigueMetrics.accelerationVariance,
        speedViolations: metricsRef.current.speedViolations,
        heatExposureMinutes: metricsRef.current.heatExposureMinutes,
        totalMinutes,
        warningsAcknowledged: metricsRef.current.warningsAcknowledged,
        totalWarnings: metricsRef.current.totalWarnings,
        harshWeatherMinutes: metricsRef.current.harshWeatherMinutes,
        weatherAlertsHeeded: metricsRef.current.weatherAlertsHeeded,
      });
      
      // Show score toast
      toast.success(`Ride Complete! Score: ${rideScore.overallScore} (+${rideScore.creditsEarned} credits)`);
    }
    
    setIsRideActive(false);
    setSessionId(null);
    setLastEvent(null);
    setLocation(null);
    setRiskLevel('none');
    setFatigueLevel('none');
    setWeatherData(null);
    
    speak('ride_ended');
  };
  
  // Demo triggers
  const handleTriggerHeat = () => {
    rideMonitor.triggerHeatWarning();
  };
  
  const handleTriggerUnsafeZone = () => {
    rideMonitor.triggerUnsafeZoneWarning();
  };
  
  // Fatigue simulation for testing
  const handleSimulateFatigue = (level: 'mild' | 'moderate' | 'severe') => {
    fatigueDetector.simulateFatigue(level);
    setFatigueLevel(level);
    toast.info(`Simulating ${level} fatigue`);
  };
  
  const handleSimulatePanic = () => {
    fatigueDetector.simulatePanic();
    setRiskLevel('critical');
    toast.warning('Simulating panic state');
  };
  
  const handleResetFatigue = () => {
    fatigueDetector.resetSimulation();
    setFatigueLevel('none');
    setRiskLevel('none');
    toast.success('Fatigue state reset');
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
        
        {/* Minimal header - only settings access */}
        <Link
          to="/settings"
          className="p-2 rounded-full hover:bg-secondary transition-colors"
          aria-label="Settings"
        >
          <SettingsIcon className="w-5 h-5 text-muted-foreground" />
        </Link>
      </motion.header>
      
      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center gap-8 px-6 pb-32">
        {/* Status */}
        <RideStatus 
          isActive={isRideActive}
          duration={duration}
          lastEvent={lastEvent}
          location={location}
          weatherData={weatherData}
        />
        
        {/* Tagline (when not riding) */}
        {!isRideActive && (
          <motion.p 
            className="text-muted-foreground text-center text-lg max-w-xs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            onClick={() => setShowDemoControls(true)}
          >
            Your invisible guardian.
            <br />
            <span className="text-sm">Always watching. Never intrusive.</span>
          </motion.p>
        )}
        
        {/* Demo mode hint during ride */}
        {isRideActive && (
          <motion.button
            className="text-xs text-muted-foreground/40 underline"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setShowDemoControls(true)}
          >
            Open Demo Controls
          </motion.button>
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
      
      {/* Contextual Safety Actions - appear based on risk/fatigue */}
      <ContextualSafetyActions
        isVisible={isRideActive}
        riskLevel={riskLevel}
        fatigueLevel={fatigueLevel}
        onOpenMap={() => setShowMap(true)}
        onOpenContacts={() => setShowContacts(true)}
        onOpenVoice={() => setShowVoiceChat(true)}
      />
      
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
        isVisible={showDemoControls}
        onClose={() => setShowDemoControls(false)}
        onTriggerHeat={handleTriggerHeat}
        onTriggerUnsafeZone={handleTriggerUnsafeZone}
        onTriggerEmergency={handleEmergency}
        onSimulateFatigue={handleSimulateFatigue}
        onSimulatePanic={handleSimulatePanic}
        onResetFatigue={handleResetFatigue}
      />
      
      {/* Emergency Contacts Sheet */}
      <EmergencyContactsSheet
        isOpen={showContacts}
        onClose={() => setShowContacts(false)}
      />
      
      {/* Voice Chat */}
      <VoiceChat
        isOpen={showVoiceChat}
        onClose={() => setShowVoiceChat(false)}
      />
      
      {/* Safety Map */}
      <SafetyMap
        isOpen={showMap}
        onClose={() => setShowMap(false)}
      />
    </div>
  );
};

export default Index;
