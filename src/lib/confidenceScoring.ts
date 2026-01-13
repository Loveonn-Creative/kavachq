// Intelligent confidence scoring for risk events
// Factors in sensor data, location history, context, and patterns

import { getLocationConfidenceAdjustment, getLocationCellId } from './locationMemory';
import type { RiskEvent } from './rideMonitor';

export interface ConfidenceFactors {
  sensorIntensity: number;      // 0-40: Base score from sensor readings
  patternDuration: number;      // 0-20: Sustained patterns score higher
  locationAdjustment: number;   // -30 to 0: Reduces for known false alarm spots
  timeOfDay: number;            // 0-10: Higher at night
  speedContext: number;         // 0-15: Higher at high speeds
  behaviorConsistency: number;  // -20 to 0: Reduces if erratic all ride
}

export interface ScoredRiskEvent extends RiskEvent {
  confidence: number;
  confidenceFactors: ConfidenceFactors;
  requiresConfirmation: boolean;
  locationCellId?: string;
}

// Thresholds for different actions
export const CONFIDENCE_THRESHOLDS = {
  SUPPRESS: 40,           // Below this: silent log only
  CONFIRM_REQUIRED: 70,   // 40-70: require voice confirmation
  IMMEDIATE_ALERT: 70,    // Above this: alert immediately (still ask for confirmation)
  EMERGENCY_AUTO: 85,     // Above this: start emergency countdown
};

// Calculate confidence score for a risk event
export function calculateConfidence(
  event: RiskEvent,
  context: {
    currentSpeed: number;
    accelerationVariance: number;
    rideStartTime: number;
    recentEvents: RiskEvent[];
    sensorIntensity?: number;
  }
): ScoredRiskEvent {
  const factors: ConfidenceFactors = {
    sensorIntensity: 0,
    patternDuration: 0,
    locationAdjustment: 0,
    timeOfDay: 0,
    speedContext: 0,
    behaviorConsistency: 0,
  };

  // 1. Base score from event severity
  switch (event.severity) {
    case 'critical':
      factors.sensorIntensity = 35;
      break;
    case 'high':
      factors.sensorIntensity = 25;
      break;
    case 'medium':
      factors.sensorIntensity = 15;
      break;
    case 'low':
      factors.sensorIntensity = 8;
      break;
  }

  // Adjust based on provided sensor intensity
  if (context.sensorIntensity !== undefined) {
    // Scale sensor intensity (0-100) to contribute to base score
    factors.sensorIntensity = Math.min(40, Math.round(context.sensorIntensity * 0.4));
  }

  // 2. Event type specific adjustments
  if (event.type === 'fall_detected') {
    factors.sensorIntensity = Math.min(40, factors.sensorIntensity + 10);
  } else if (event.type === 'sudden_stop') {
    factors.sensorIntensity = Math.min(40, factors.sensorIntensity + 5);
  } else if (event.type === 'speed_warning' || event.type === 'heat_warning') {
    factors.sensorIntensity = Math.max(10, factors.sensorIntensity - 5);
  }

  // 3. Pattern duration: check for similar recent events
  const recentSimilar = context.recentEvents.filter(
    e => e.type === event.type && (event.timestamp - e.timestamp) < 30000
  );
  if (recentSimilar.length > 0) {
    factors.patternDuration = Math.min(20, recentSimilar.length * 7);
  }

  // 4. Location adjustment
  if (event.location) {
    factors.locationAdjustment = getLocationConfidenceAdjustment(
      event.location.lat,
      event.location.lng
    );
  }

  // 5. Time of day (night = higher confidence for same events)
  const hour = new Date().getHours();
  if (hour >= 22 || hour < 5) {
    factors.timeOfDay = 10; // Night riding
  } else if (hour >= 19 || hour < 7) {
    factors.timeOfDay = 5; // Dusk/dawn
  }

  // 6. Speed context
  if (context.currentSpeed > 40) {
    factors.speedContext = 15;
  } else if (context.currentSpeed > 20) {
    factors.speedContext = 10;
  } else if (context.currentSpeed > 5) {
    factors.speedContext = 5;
  }

  // 7. Behavior consistency: reduce if there have been many events this ride
  const rideDuration = (Date.now() - context.rideStartTime) / 1000 / 60; // minutes
  const eventsPerMinute = context.recentEvents.length / Math.max(1, rideDuration);
  if (eventsPerMinute > 2) {
    factors.behaviorConsistency = -20; // Very erratic
  } else if (eventsPerMinute > 1) {
    factors.behaviorConsistency = -10; // Somewhat erratic
  }

  // Calculate total confidence
  const confidence = Math.min(100, Math.max(0,
    factors.sensorIntensity +
    factors.patternDuration +
    factors.locationAdjustment +
    factors.timeOfDay +
    factors.speedContext +
    factors.behaviorConsistency
  ));

  // Determine if confirmation is required
  const requiresConfirmation = 
    confidence >= CONFIDENCE_THRESHOLDS.SUPPRESS &&
    confidence < CONFIDENCE_THRESHOLDS.IMMEDIATE_ALERT;

  // Get location cell ID for tracking
  const locationCellId = event.location 
    ? getLocationCellId(event.location.lat, event.location.lng)
    : undefined;

  return {
    ...event,
    confidence,
    confidenceFactors: factors,
    requiresConfirmation,
    locationCellId,
  };
}

// Determine action based on confidence
export function getConfidenceAction(confidence: number): 'suppress' | 'confirm' | 'alert' | 'emergency' {
  if (confidence < CONFIDENCE_THRESHOLDS.SUPPRESS) {
    return 'suppress';
  }
  if (confidence >= CONFIDENCE_THRESHOLDS.EMERGENCY_AUTO) {
    return 'emergency';
  }
  if (confidence >= CONFIDENCE_THRESHOLDS.IMMEDIATE_ALERT) {
    return 'alert';
  }
  return 'confirm';
}

// Check if event should trigger emergency automatically
export function shouldAutoTriggerEmergency(event: ScoredRiskEvent): boolean {
  // Fall detected with high confidence = auto emergency
  if (event.type === 'fall_detected' && event.confidence >= CONFIDENCE_THRESHOLDS.EMERGENCY_AUTO) {
    return true;
  }
  // Critical severity + very high confidence
  if (event.severity === 'critical' && event.confidence >= 90) {
    return true;
  }
  return false;
}

// Calculate sensor intensity from accelerometer data
export function calculateSensorIntensity(
  accelerationDelta: number,
  speedDelta: number
): number {
  // Normalize acceleration delta (typical range 0-50 m/s²)
  const accelScore = Math.min(50, accelerationDelta * 2);
  
  // Normalize speed delta (typical range 0-30 km/h sudden change)
  const speedScore = Math.min(50, Math.abs(speedDelta) * 1.67);
  
  // Combine scores
  return Math.round((accelScore + speedScore) / 2);
}
