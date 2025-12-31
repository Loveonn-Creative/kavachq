// On-device AI for fatigue and panic detection
// Works offline, screen-off, zero taps required
// Fuses: accelerometer, gyroscope, GPS variance, ambient temp, time-on-ride

import { speak, speakCustom, vibrateAlert } from './voiceOutput';
import { getUserLanguage } from './deviceId';

interface FatigueState {
  isMonitoring: boolean;
  rideStartTime: number;
  timeOnRide: number; // minutes
  
  // Sensor fusion data
  accelerometerVariance: number;
  gyroscopeStability: number;
  gpsVariance: number;
  ambientTemp: number | null;
  
  // Fatigue indicators
  fatigueScore: number; // 0-100, higher = more fatigue
  panicScore: number; // 0-100, higher = more panic risk
  
  // History for pattern detection
  recentAccelData: number[];
  recentGyroData: number[];
  recentSpeedData: number[];
  lastNudgeTime: number;
}

// Fatigue voice nudges (short, actionable)
const fatigueNudges: Record<string, Record<string, string[]>> = {
  'en-IN': {
    mild: [
      'Slow now. Take a breath.',
      'Easy ride. Stay calm.',
      'Relax your shoulders.',
    ],
    moderate: [
      'Pull over 60 seconds. You need rest.',
      'Stop for water. Stay sharp.',
      'Take a break. Safety first.',
    ],
    severe: [
      'Stop now. You are too tired.',
      'Find shade. Rest 5 minutes.',
      'End ride soon. Fatigue danger.',
    ],
  },
  'hi-IN': {
    mild: [
      'धीमे चलो। सांस लो।',
      'आराम से। शांत रहो।',
      'कंधे ढीले करो।',
    ],
    moderate: [
      'रुको 1 मिनट। आराम करो।',
      'पानी पियो। सतर्क रहो।',
      'ब्रेक लो। सेफ्टी पहले।',
    ],
    severe: [
      'अभी रुको। बहुत थके हो।',
      'छाया में रुको। 5 मिनट आराम।',
      'राइड खत्म करो। थकान खतरनाक।',
    ],
  },
  'ta-IN': {
    mild: [
      'மெதுவாக. ஓய்வு எடு.',
      'சாந்தமாக. அமைதியாக.',
      'தோள்களை தளர்த்து.',
    ],
    moderate: [
      '60 வினாடி நிறுத்து. ஓய்வு தேவை.',
      'தண்ணீர் குடி. விழிப்பாக இரு.',
      'இடைவேளை எடு. பாதுகாப்பு முதல்.',
    ],
    severe: [
      'இப்போதே நிறுத்து. மிகவும் சோர்வு.',
      'நிழலில் நிறுத்து. 5 நிமிடம் ஓய்வு.',
      'சவாரி முடி. சோர்வு ஆபத்து.',
    ],
  },
};

class FatigueDetector {
  private state: FatigueState = {
    isMonitoring: false,
    rideStartTime: 0,
    timeOnRide: 0,
    accelerometerVariance: 0,
    gyroscopeStability: 100,
    gpsVariance: 0,
    ambientTemp: null,
    fatigueScore: 0,
    panicScore: 0,
    recentAccelData: [],
    recentGyroData: [],
    recentSpeedData: [],
    lastNudgeTime: 0,
  };
  
  private motionHandler: ((e: DeviceMotionEvent) => void) | null = null;
  private orientationHandler: ((e: DeviceOrientationEvent) => void) | null = null;
  private checkInterval: number | null = null;
  
  // Thresholds
  private readonly FATIGUE_NUDGE_INTERVAL = 5 * 60 * 1000; // 5 min between nudges
  private readonly MILD_FATIGUE_THRESHOLD = 30;
  private readonly MODERATE_FATIGUE_THRESHOLD = 50;
  private readonly SEVERE_FATIGUE_THRESHOLD = 70;
  private readonly PANIC_THRESHOLD = 60;
  
  startMonitoring(): void {
    if (this.state.isMonitoring) return;
    
    this.state = {
      ...this.state,
      isMonitoring: true,
      rideStartTime: Date.now(),
      timeOnRide: 0,
      fatigueScore: 0,
      panicScore: 0,
      recentAccelData: [],
      recentGyroData: [],
      recentSpeedData: [],
      lastNudgeTime: 0,
    };
    
    // Start accelerometer monitoring
    if ('DeviceMotionEvent' in window) {
      this.motionHandler = this.handleMotion.bind(this);
      window.addEventListener('devicemotion', this.motionHandler);
    }
    
    // Start gyroscope monitoring
    if ('DeviceOrientationEvent' in window) {
      this.orientationHandler = this.handleOrientation.bind(this);
      window.addEventListener('deviceorientation', this.orientationHandler);
    }
    
    // Periodic fatigue check
    this.checkInterval = window.setInterval(() => {
      this.updateFatigueScore();
      this.checkAndNudge();
    }, 30000); // Every 30 seconds
  }
  
  stopMonitoring(): FatigueState {
    const finalState = { ...this.state };
    
    if (this.motionHandler) {
      window.removeEventListener('devicemotion', this.motionHandler);
      this.motionHandler = null;
    }
    
    if (this.orientationHandler) {
      window.removeEventListener('deviceorientation', this.orientationHandler);
      this.orientationHandler = null;
    }
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    this.state.isMonitoring = false;
    return finalState;
  }
  
  private handleMotion(event: DeviceMotionEvent): void {
    const acc = event.accelerationIncludingGravity;
    if (!acc || acc.x === null) return;
    
    // Calculate acceleration magnitude
    const magnitude = Math.sqrt(
      (acc.x || 0) ** 2 + 
      (acc.y || 0) ** 2 + 
      (acc.z || 0) ** 2
    );
    
    // Store recent data (keep last 60 samples ~1 minute at 1Hz effective)
    this.state.recentAccelData.push(magnitude);
    if (this.state.recentAccelData.length > 60) {
      this.state.recentAccelData.shift();
    }
    
    // Calculate variance (high variance = jerky/erratic = possibly fatigued)
    if (this.state.recentAccelData.length >= 10) {
      const mean = this.state.recentAccelData.reduce((a, b) => a + b, 0) / this.state.recentAccelData.length;
      const variance = this.state.recentAccelData.reduce((sum, val) => 
        sum + Math.pow(val - mean, 2), 0) / this.state.recentAccelData.length;
      this.state.accelerometerVariance = Math.min(10, variance);
    }
  }
  
  private handleOrientation(event: DeviceOrientationEvent): void {
    // Track gyro stability (unstable = weaving/erratic steering)
    const beta = event.beta || 0;
    const gamma = event.gamma || 0;
    
    const combined = Math.abs(beta) + Math.abs(gamma);
    this.state.recentGyroData.push(combined);
    
    if (this.state.recentGyroData.length > 60) {
      this.state.recentGyroData.shift();
    }
    
    if (this.state.recentGyroData.length >= 10) {
      const mean = this.state.recentGyroData.reduce((a, b) => a + b, 0) / this.state.recentGyroData.length;
      const variance = this.state.recentGyroData.reduce((sum, val) => 
        sum + Math.pow(val - mean, 2), 0) / this.state.recentGyroData.length;
      // Stability decreases with variance
      this.state.gyroscopeStability = Math.max(0, 100 - variance);
    }
  }
  
  updateGPSData(speed: number): void {
    this.state.recentSpeedData.push(speed);
    if (this.state.recentSpeedData.length > 30) {
      this.state.recentSpeedData.shift();
    }
    
    // GPS variance = inconsistent speeds (stop-start pattern = fatigue)
    if (this.state.recentSpeedData.length >= 5) {
      const mean = this.state.recentSpeedData.reduce((a, b) => a + b, 0) / this.state.recentSpeedData.length;
      const variance = this.state.recentSpeedData.reduce((sum, val) => 
        sum + Math.pow(val - mean, 2), 0) / this.state.recentSpeedData.length;
      this.state.gpsVariance = Math.min(100, variance);
    }
  }
  
  updateTemperature(temp: number): void {
    this.state.ambientTemp = temp;
  }
  
  private updateFatigueScore(): void {
    this.state.timeOnRide = (Date.now() - this.state.rideStartTime) / 60000; // minutes
    
    // Fatigue factors:
    // 1. Time on ride (exponential after 90 min)
    const timeScore = this.state.timeOnRide > 90 
      ? Math.min(40, (this.state.timeOnRide - 90) / 2)
      : this.state.timeOnRide > 60 
        ? 15 
        : this.state.timeOnRide / 6;
    
    // 2. Acceleration variance (jerky movements)
    const accelScore = Math.min(25, this.state.accelerometerVariance * 3);
    
    // 3. Gyro instability (weaving)
    const gyroScore = Math.min(20, (100 - this.state.gyroscopeStability) / 5);
    
    // 4. Heat exposure
    const heatScore = this.state.ambientTemp && this.state.ambientTemp > 35 
      ? Math.min(15, (this.state.ambientTemp - 35) * 3) 
      : 0;
    
    // Combined fatigue score
    this.state.fatigueScore = Math.min(100, Math.round(
      timeScore + accelScore + gyroScore + heatScore
    ));
    
    // Panic score (based on sudden erratic behavior)
    const suddenAccelSpike = this.state.accelerometerVariance > 5;
    const erraticGyro = this.state.gyroscopeStability < 50;
    const highSpeedVariance = this.state.gpsVariance > 50;
    
    let panicScore = 0;
    if (suddenAccelSpike) panicScore += 30;
    if (erraticGyro) panicScore += 30;
    if (highSpeedVariance) panicScore += 20;
    if (this.state.ambientTemp && this.state.ambientTemp > 40) panicScore += 20;
    
    this.state.panicScore = Math.min(100, panicScore);
  }
  
  private checkAndNudge(): void {
    const now = Date.now();
    
    // Respect nudge interval
    if (now - this.state.lastNudgeTime < this.FATIGUE_NUDGE_INTERVAL) {
      return;
    }
    
    const lang = getUserLanguage();
    const langKey = fatigueNudges[lang] ? lang : 'en-IN';
    
    // Check panic first (higher priority)
    if (this.state.panicScore >= this.PANIC_THRESHOLD) {
      const nudges = fatigueNudges[langKey].severe;
      const nudge = nudges[Math.floor(Math.random() * nudges.length)];
      speakCustom(nudge);
      vibrateAlert();
      this.state.lastNudgeTime = now;
      return;
    }
    
    // Check fatigue levels
    if (this.state.fatigueScore >= this.SEVERE_FATIGUE_THRESHOLD) {
      const nudges = fatigueNudges[langKey].severe;
      const nudge = nudges[Math.floor(Math.random() * nudges.length)];
      speakCustom(nudge);
      vibrateAlert();
      this.state.lastNudgeTime = now;
    } else if (this.state.fatigueScore >= this.MODERATE_FATIGUE_THRESHOLD) {
      const nudges = fatigueNudges[langKey].moderate;
      const nudge = nudges[Math.floor(Math.random() * nudges.length)];
      speakCustom(nudge);
      vibrateAlert();
      this.state.lastNudgeTime = now;
    } else if (this.state.fatigueScore >= this.MILD_FATIGUE_THRESHOLD) {
      const nudges = fatigueNudges[langKey].mild;
      const nudge = nudges[Math.floor(Math.random() * nudges.length)];
      speakCustom(nudge);
      this.state.lastNudgeTime = now;
    }
  }
  
  getState(): FatigueState {
    return { ...this.state };
  }
  
  getFatigueLevel(): 'none' | 'mild' | 'moderate' | 'severe' {
    if (this.state.fatigueScore >= this.SEVERE_FATIGUE_THRESHOLD) return 'severe';
    if (this.state.fatigueScore >= this.MODERATE_FATIGUE_THRESHOLD) return 'moderate';
    if (this.state.fatigueScore >= this.MILD_FATIGUE_THRESHOLD) return 'mild';
    return 'none';
  }
  
  // Get metrics for safety score calculation
  getMetrics(): {
    accelerationVariance: number;
    timeOnRide: number;
    fatigueScore: number;
  } {
    return {
      accelerationVariance: this.state.accelerometerVariance,
      timeOnRide: this.state.timeOnRide,
      fatigueScore: this.state.fatigueScore,
    };
  }
}

export const fatigueDetector = new FatigueDetector();
