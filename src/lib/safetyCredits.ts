// Safety Credits System - Local risk scoring with positive reinforcement
// No penalties - only upside rewards

import { getDeviceId } from './deviceId';

const SAFETY_CREDITS_KEY = 'kavach_safety_credits';
const RIDE_SCORES_KEY = 'kavach_ride_scores';

export interface RideScore {
  id: string;
  ride_session_id: string;
  timestamp: string;
  smoothness: number; // 0-100 based on acceleration variance
  compliance: number; // 0-100 based on following speed limits
  heatExposure: number; // 0-100 inverse of heat exposure time
  interventionResponse: number; // 0-100 based on responding to warnings
  overallScore: number;
  creditsEarned: number;
}

export interface SafetyCreditsState {
  device_id: string;
  totalCredits: number;
  currentStreak: number; // consecutive good rides
  lifetimeRides: number;
  averageScore: number;
  lastUpdated: string;
  redemptions: Redemption[];
}

export interface Redemption {
  id: string;
  type: 'insurance_discount' | 'bonus_points' | 'rest_reward' | 'premium_feature';
  credits: number;
  timestamp: string;
  claimed: boolean;
}

// Get or initialize credits state
export function getSafetyCredits(): SafetyCreditsState {
  const deviceId = getDeviceId();
  try {
    const data = localStorage.getItem(SAFETY_CREDITS_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed.device_id === deviceId) {
        return parsed;
      }
    }
  } catch {}
  
  return {
    device_id: deviceId,
    totalCredits: 0,
    currentStreak: 0,
    lifetimeRides: 0,
    averageScore: 0,
    lastUpdated: new Date().toISOString(),
    redemptions: [],
  };
}

// Save credits state
function saveCredits(state: SafetyCreditsState): void {
  try {
    localStorage.setItem(SAFETY_CREDITS_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save credits:', e);
  }
}

// Get all ride scores
export function getRideScores(): RideScore[] {
  const deviceId = getDeviceId();
  try {
    const data = localStorage.getItem(RIDE_SCORES_KEY);
    if (data) {
      return JSON.parse(data).filter((s: RideScore) => true) || [];
    }
  } catch {}
  return [];
}

// Calculate and save ride score
export function calculateRideScore(
  rideSessionId: string,
  metrics: {
    accelerationVariance: number; // lower is smoother
    speedViolations: number; // count of speed warnings
    heatExposureMinutes: number;
    totalMinutes: number;
    warningsAcknowledged: number;
    totalWarnings: number;
    harshWeatherMinutes?: number; // time riding in challenging weather
    weatherAlertsHeeded?: number; // weather alerts that led to rest
  }
): RideScore {
  // Calculate component scores (0-100, higher is better)
  const smoothness = Math.max(0, Math.min(100, 100 - (metrics.accelerationVariance * 10)));
  
  const complianceRatio = metrics.totalMinutes > 0 
    ? 1 - (metrics.speedViolations / Math.max(1, metrics.totalMinutes))
    : 1;
  const compliance = Math.max(0, Math.min(100, complianceRatio * 100));
  
  const heatRatio = metrics.totalMinutes > 0
    ? 1 - (metrics.heatExposureMinutes / metrics.totalMinutes)
    : 1;
  const heatExposure = Math.max(0, Math.min(100, heatRatio * 100));
  
  const responseRatio = metrics.totalWarnings > 0
    ? metrics.warningsAcknowledged / metrics.totalWarnings
    : 1;
  const interventionResponse = Math.max(0, Math.min(100, responseRatio * 100));
  
  // Weighted overall score
  const overallScore = Math.round(
    smoothness * 0.25 +
    compliance * 0.35 +
    heatExposure * 0.15 +
    interventionResponse * 0.25
  );
  
  // Credits earned (1-10 based on score, plus streak and weather bonuses)
  const state = getSafetyCredits();
  const baseCredits = Math.ceil(overallScore / 10);
  const streakBonus = Math.min(state.currentStreak, 5); // max 5 bonus credits
  
  // Weather bonus: reward for riding safely in harsh conditions
  const harshWeatherBonus = metrics.harshWeatherMinutes 
    ? Math.min(5, Math.floor(metrics.harshWeatherMinutes / 10)) // 1 credit per 10 min in harsh weather
    : 0;
  const weatherAlertBonus = metrics.weatherAlertsHeeded 
    ? Math.min(3, metrics.weatherAlertsHeeded) // Up to 3 extra credits for heeding warnings
    : 0;
  
  const creditsEarned = baseCredits + streakBonus + harshWeatherBonus + weatherAlertBonus;
  
  const rideScore: RideScore = {
    id: crypto.randomUUID?.() || Date.now().toString(),
    ride_session_id: rideSessionId,
    timestamp: new Date().toISOString(),
    smoothness: Math.round(smoothness),
    compliance: Math.round(compliance),
    heatExposure: Math.round(heatExposure),
    interventionResponse: Math.round(interventionResponse),
    overallScore,
    creditsEarned,
  };
  
  // Save ride score
  const scores = getRideScores();
  scores.push(rideScore);
  localStorage.setItem(RIDE_SCORES_KEY, JSON.stringify(scores.slice(-100))); // Keep last 100
  
  // Update credits state
  const isGoodRide = overallScore >= 70;
  const newStreak = isGoodRide ? state.currentStreak + 1 : 0;
  const newTotal = state.totalCredits + creditsEarned;
  const newLifetime = state.lifetimeRides + 1;
  const newAverage = Math.round(
    (state.averageScore * state.lifetimeRides + overallScore) / newLifetime
  );
  
  saveCredits({
    ...state,
    totalCredits: newTotal,
    currentStreak: newStreak,
    lifetimeRides: newLifetime,
    averageScore: newAverage,
    lastUpdated: new Date().toISOString(),
  });
  
  return rideScore;
}

// Redeem credits for rewards
export function redeemCredits(
  type: Redemption['type'],
  credits: number
): boolean {
  const state = getSafetyCredits();
  
  if (state.totalCredits < credits) {
    return false;
  }
  
  const redemption: Redemption = {
    id: crypto.randomUUID?.() || Date.now().toString(),
    type,
    credits,
    timestamp: new Date().toISOString(),
    claimed: true,
  };
  
  state.totalCredits -= credits;
  state.redemptions.push(redemption);
  saveCredits(state);
  
  return true;
}

// Get available rewards
export function getAvailableRewards(): Array<{
  type: Redemption['type'];
  name: string;
  description: string;
  credits: number;
  icon: string;
}> {
  return [
    {
      type: 'rest_reward',
      name: 'Chai Break',
      description: 'Free tea at partner stops',
      credits: 50,
      icon: '☕',
    },
    {
      type: 'insurance_discount',
      name: 'Insurance Boost',
      description: '5% off next premium',
      credits: 200,
      icon: '🛡️',
    },
    {
      type: 'bonus_points',
      name: 'Partner Bonus',
      description: '₹50 Zomato/Swiggy credit',
      credits: 300,
      icon: '💰',
    },
    {
      type: 'premium_feature',
      name: 'Premium Week',
      description: '7 days of advanced features',
      credits: 500,
      icon: '⭐',
    },
  ];
}

// Get credit tier
export function getCreditTier(credits: number): {
  name: string;
  minCredits: number;
  color: string;
  icon: string;
} {
  if (credits >= 1000) {
    return { name: 'Guardian', minCredits: 1000, color: 'text-yellow-500', icon: '🏆' };
  } else if (credits >= 500) {
    return { name: 'Protector', minCredits: 500, color: 'text-purple-500', icon: '🛡️' };
  } else if (credits >= 200) {
    return { name: 'Defender', minCredits: 200, color: 'text-blue-500', icon: '⚡' };
  } else if (credits >= 50) {
    return { name: 'Rider', minCredits: 50, color: 'text-green-500', icon: '🚴' };
  }
  return { name: 'Starter', minCredits: 0, color: 'text-muted-foreground', icon: '🌱' };
}
