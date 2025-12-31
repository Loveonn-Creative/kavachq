// Ride monitoring system - detects risks in real-time
// Local-first processing for low network conditions

import { speak, vibrateAlert, vibrateEmergency } from './voiceOutput';

export interface RideState {
  isActive: boolean;
  startTime: number | null;
  lastPosition: GeolocationPosition | null;
  lastSpeed: number;
  idleTime: number;
  distanceTraveled: number;
  riskEvents: RiskEvent[];
}

export interface RiskEvent {
  type: 'speed_warning' | 'heat_warning' | 'unsafe_zone' | 'sudden_stop' | 'fall_detected' | 'long_idle' | 'wellness_check';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  location?: { lat: number; lng: number };
  message?: string;
}

// Thresholds for risk detection
const SPEED_THRESHOLD_KMH = 60; // Warn above this speed
const IDLE_WARNING_MS = 5 * 60 * 1000; // 5 minutes idle
const SUDDEN_STOP_THRESHOLD = 20; // km/h drop in 1 second
const HEAT_INDEX_THRESHOLD = 35; // Celsius

class RideMonitor {
  private state: RideState = {
    isActive: false,
    startTime: null,
    lastPosition: null,
    lastSpeed: 0,
    idleTime: 0,
    distanceTraveled: 0,
    riskEvents: [],
  };
  
  private watchId: number | null = null;
  private idleCheckInterval: number | null = null;
  private lastUpdateTime: number = 0;
  private onRiskEvent: ((event: RiskEvent) => void) | null = null;
  private onEmergency: (() => void) | null = null;
  private motionHandler: ((e: DeviceMotionEvent) => void) | null = null;
  
  // Accelerometer data for fall detection
  private lastAcceleration: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };
  
  setRiskEventHandler(handler: (event: RiskEvent) => void): void {
    this.onRiskEvent = handler;
  }
  
  setEmergencyHandler(handler: () => void): void {
    this.onEmergency = handler;
  }
  
  async startMonitoring(): Promise<boolean> {
    if (this.state.isActive) return true;
    
    try {
      // Request location permission
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });
      
      this.state = {
        isActive: true,
        startTime: Date.now(),
        lastPosition: position,
        lastSpeed: 0,
        idleTime: 0,
        distanceTraveled: 0,
        riskEvents: [],
      };
      
      this.lastUpdateTime = Date.now();
      
      // Start continuous location watching
      this.watchId = navigator.geolocation.watchPosition(
        this.handlePositionUpdate.bind(this),
        this.handlePositionError.bind(this),
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 1000,
        }
      );
      
      // Start idle check interval
      this.idleCheckInterval = window.setInterval(() => {
        this.checkIdle();
      }, 30000); // Check every 30 seconds
      
      // Start motion detection for fall detection
      this.startMotionDetection();
      
      return true;
    } catch (error) {
      console.error('Failed to start monitoring:', error);
      return false;
    }
  }
  
  stopMonitoring(): RideState {
    const finalState = { ...this.state };
    
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    
    if (this.idleCheckInterval !== null) {
      clearInterval(this.idleCheckInterval);
      this.idleCheckInterval = null;
    }
    
    this.stopMotionDetection();
    
    this.state = {
      isActive: false,
      startTime: null,
      lastPosition: null,
      lastSpeed: 0,
      idleTime: 0,
      distanceTraveled: 0,
      riskEvents: [],
    };
    
    return finalState;
  }
  
  private handlePositionUpdate(position: GeolocationPosition): void {
    const now = Date.now();
    const timeDelta = (now - this.lastUpdateTime) / 1000; // seconds
    
    if (this.state.lastPosition && timeDelta > 0) {
      // Calculate speed
      const distance = this.calculateDistance(
        this.state.lastPosition.coords.latitude,
        this.state.lastPosition.coords.longitude,
        position.coords.latitude,
        position.coords.longitude
      );
      
      const speedKmh = (distance / timeDelta) * 3.6; // m/s to km/h
      
      // Check for sudden stop (potential crash)
      if (this.state.lastSpeed > 20 && speedKmh < 2) {
        const speedDrop = this.state.lastSpeed - speedKmh;
        if (speedDrop > SUDDEN_STOP_THRESHOLD) {
          this.triggerRiskEvent({
            type: 'sudden_stop',
            severity: 'high',
            timestamp: now,
            location: { lat: position.coords.latitude, lng: position.coords.longitude },
          });
        }
      }
      
      // Check for excessive speed
      if (speedKmh > SPEED_THRESHOLD_KMH) {
        this.triggerRiskEvent({
          type: 'speed_warning',
          severity: 'medium',
          timestamp: now,
          location: { lat: position.coords.latitude, lng: position.coords.longitude },
        });
      }
      
      this.state.lastSpeed = speedKmh;
      this.state.distanceTraveled += distance;
      
      // Reset idle time if moving
      if (speedKmh > 2) {
        this.state.idleTime = 0;
      }
    }
    
    this.state.lastPosition = position;
    this.lastUpdateTime = now;
  }
  
  private handlePositionError(error: GeolocationPositionError): void {
    console.warn('Geolocation error:', error.message);
    // Continue monitoring even with GPS errors - fail gracefully
  }
  
  private checkIdle(): void {
    if (!this.state.isActive) return;
    
    const now = Date.now();
    const timeSinceUpdate = now - this.lastUpdateTime;
    
    this.state.idleTime += timeSinceUpdate;
    
    if (this.state.idleTime > IDLE_WARNING_MS) {
      this.triggerRiskEvent({
        type: 'long_idle',
        severity: 'high',
        timestamp: now,
        location: this.state.lastPosition ? {
          lat: this.state.lastPosition.coords.latitude,
          lng: this.state.lastPosition.coords.longitude,
        } : undefined,
      });
    }
  }
  
  private startMotionDetection(): void {
    if ('DeviceMotionEvent' in window) {
      this.motionHandler = (event: DeviceMotionEvent) => {
        const acc = event.accelerationIncludingGravity;
        if (!acc) return;
        
        const x = acc.x || 0;
        const y = acc.y || 0;
        const z = acc.z || 0;
        
        // Detect sudden large acceleration changes (potential fall)
        const deltaX = Math.abs(x - this.lastAcceleration.x);
        const deltaY = Math.abs(y - this.lastAcceleration.y);
        const deltaZ = Math.abs(z - this.lastAcceleration.z);
        
        const totalDelta = Math.sqrt(deltaX ** 2 + deltaY ** 2 + deltaZ ** 2);
        
        // Fall detection threshold (significant G-force change)
        if (totalDelta > 25) {
          this.triggerRiskEvent({
            type: 'fall_detected',
            severity: 'critical',
            timestamp: Date.now(),
            location: this.state.lastPosition ? {
              lat: this.state.lastPosition.coords.latitude,
              lng: this.state.lastPosition.coords.longitude,
            } : undefined,
          });
        }
        
        this.lastAcceleration = { x, y, z };
      };
      
      window.addEventListener('devicemotion', this.motionHandler);
    }
  }
  
  private stopMotionDetection(): void {
    if (this.motionHandler) {
      window.removeEventListener('devicemotion', this.motionHandler);
      this.motionHandler = null;
    }
  }
  
  private triggerRiskEvent(event: RiskEvent): void {
    // Debounce same event type (don't spam)
    const recentSameEvent = this.state.riskEvents.find(
      e => e.type === event.type && (Date.now() - e.timestamp) < 60000
    );
    
    if (recentSameEvent) return;
    
    this.state.riskEvents.push(event);
    
    // Voice warning
    speak(event.type);
    
    // Vibration based on severity
    if (event.severity === 'critical') {
      vibrateEmergency();
      // Auto-trigger emergency for critical events
      if (event.type === 'fall_detected') {
        setTimeout(() => {
          this.onEmergency?.();
        }, 10000); // 10 second delay to allow cancellation
      }
    } else {
      vibrateAlert();
    }
    
    // Notify handler
    this.onRiskEvent?.(event);
  }
  
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  
  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
  
  getState(): RideState {
    return { ...this.state };
  }
  
  getCurrentLocation(): { lat: number; lng: number } | null {
    if (!this.state.lastPosition) return null;
    return {
      lat: this.state.lastPosition.coords.latitude,
      lng: this.state.lastPosition.coords.longitude,
    };
  }
  
  getCurrentSpeed(): number {
    return this.state.lastSpeed;
  }
  
  // Simulate heat warning (in production, this would use weather API)
  triggerHeatWarning(): void {
    this.triggerRiskEvent({
      type: 'heat_warning',
      severity: 'high',
      timestamp: Date.now(),
      location: this.getCurrentLocation() || undefined,
    });
  }
  
  // Simulate unsafe zone alert
  triggerUnsafeZoneWarning(): void {
    this.triggerRiskEvent({
      type: 'unsafe_zone',
      severity: 'medium',
      timestamp: Date.now(),
      location: this.getCurrentLocation() || undefined,
    });
  }
}

export const rideMonitor = new RideMonitor();
