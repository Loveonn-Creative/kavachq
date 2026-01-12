// Weather Service - Real-time weather monitoring for rider safety
// Uses Open-Meteo API (free, no API key required)
// Offline-first with localStorage caching

const WEATHER_CACHE_KEY = 'kavach_weather_cache';
const WEATHER_FETCH_INTERVAL = 15 * 60 * 1000; // 15 minutes

export interface WeatherData {
  temperature: number; // Celsius
  humidity: number; // Percentage
  feelsLike: number; // Heat index adjusted
  windSpeed: number; // km/h
  weatherCode: number; // WMO weather code
  uvIndex: number; // UV exposure risk
  isRaining: boolean;
  lastUpdated: number; // Timestamp
  location: { lat: number; lng: number };
  // AQI data
  aqi: number | null; // US EPA AQI (0-500+)
  pm25: number | null; // PM2.5 µg/m³
  pm10: number | null; // PM10 µg/m³
}

export interface WeatherRisk {
  level: 'none' | 'caution' | 'warning' | 'danger' | 'extreme';
  type: 'heat' | 'rain' | 'wind' | 'uv' | 'aqi' | 'none';
  message: string;
}

// AQI breakpoints (US EPA standard)
// 0-50: Good, 51-100: Moderate, 101-150: Unhealthy for Sensitive, 
// 151-200: Unhealthy, 201-300: Very Unhealthy, 301+: Hazardous
export interface AQIRisk {
  level: 'good' | 'moderate' | 'sensitive' | 'unhealthy' | 'very_unhealthy' | 'hazardous';
  message: string;
}

// Weather code to rain mapping (WMO codes)
const RAIN_CODES = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99];

class WeatherService {
  private cachedData: WeatherData | null = null;
  private lastFetchLocation: { lat: number; lng: number } | null = null;
  private fetchPromise: Promise<WeatherData | null> | null = null;
  private onWeatherUpdate: ((data: WeatherData) => void) | null = null;
  private checkInterval: number | null = null;
  
  constructor() {
    this.loadFromCache();
  }
  
  setWeatherUpdateHandler(handler: (data: WeatherData) => void): void {
    this.onWeatherUpdate = handler;
  }
  
  private loadFromCache(): void {
    try {
      const cached = localStorage.getItem(WEATHER_CACHE_KEY);
      if (cached) {
        this.cachedData = JSON.parse(cached);
      }
    } catch {}
  }
  
  private saveToCache(data: WeatherData): void {
    try {
      localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(data));
    } catch {}
  }
  
  // Calculate heat index (feels like temperature)
  // Optimized for Indian tropical conditions
  private calculateHeatIndex(tempC: number, humidity: number): number {
    if (tempC < 27) return tempC;
    
    // Simplified heat index formula for high humidity
    const t = tempC;
    const rh = humidity;
    
    let hi = -8.784695 +
      1.61139411 * t +
      2.338549 * rh -
      0.14611605 * t * rh -
      0.012308094 * t * t -
      0.016424828 * rh * rh +
      0.002211732 * t * t * rh +
      0.00072546 * t * rh * rh -
      0.000003582 * t * t * rh * rh;
    
    return Math.round(hi * 10) / 10;
  }
  
  // Check if location has changed significantly (> 5km)
  private hasLocationChanged(lat: number, lng: number): boolean {
    if (!this.lastFetchLocation) return true;
    
    const R = 6371; // Earth's radius in km
    const dLat = (lat - this.lastFetchLocation.lat) * Math.PI / 180;
    const dLng = (lng - this.lastFetchLocation.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.lastFetchLocation.lat * Math.PI / 180) *
      Math.cos(lat * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance > 5; // More than 5km
  }
  
  async fetchWeather(lat: number, lng: number): Promise<WeatherData | null> {
    const now = Date.now();
    
    // Return cached if recent and location hasn't changed much
    if (
      this.cachedData &&
      now - this.cachedData.lastUpdated < WEATHER_FETCH_INTERVAL &&
      !this.hasLocationChanged(lat, lng)
    ) {
      return this.cachedData;
    }
    
    // If already fetching, wait for that
    if (this.fetchPromise) {
      return this.fetchPromise;
    }
    
    this.fetchPromise = this.doFetch(lat, lng);
    const result = await this.fetchPromise;
    this.fetchPromise = null;
    
    return result;
  }
  
  private async doFetch(lat: number, lng: number): Promise<WeatherData | null> {
    try {
      // Fetch weather and AQI in parallel
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?` +
        `latitude=${lat}&longitude=${lng}&` +
        `current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,uv_index`;
      
      const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?` +
        `latitude=${lat}&longitude=${lng}&` +
        `current=us_aqi,pm2_5,pm10`;
      
      const [weatherResponse, aqiResponse] = await Promise.all([
        fetch(weatherUrl, { signal: AbortSignal.timeout(5000) }),
        fetch(aqiUrl, { signal: AbortSignal.timeout(5000) }).catch(() => null),
      ]);
      
      if (!weatherResponse.ok) throw new Error('Weather fetch failed');
      
      const weatherData = await weatherResponse.json();
      const current = weatherData.current;
      
      // Parse AQI data (may be null if API fails)
      let aqi: number | null = null;
      let pm25: number | null = null;
      let pm10: number | null = null;
      
      if (aqiResponse?.ok) {
        try {
          const aqiData = await aqiResponse.json();
          aqi = aqiData.current?.us_aqi ?? null;
          pm25 = aqiData.current?.pm2_5 ?? null;
          pm10 = aqiData.current?.pm10 ?? null;
        } catch {
          // AQI parsing failed, continue with null values
        }
      }
      
      const temperature = current.temperature_2m;
      const humidity = current.relative_humidity_2m;
      const windSpeed = current.wind_speed_10m;
      const weatherCode = current.weather_code;
      const uvIndex = current.uv_index || 0;
      
      const result: WeatherData = {
        temperature,
        humidity,
        feelsLike: this.calculateHeatIndex(temperature, humidity),
        windSpeed,
        weatherCode,
        uvIndex,
        isRaining: RAIN_CODES.includes(weatherCode),
        lastUpdated: Date.now(),
        location: { lat, lng },
        aqi,
        pm25,
        pm10,
      };
      
      this.cachedData = result;
      this.lastFetchLocation = { lat, lng };
      this.saveToCache(result);
      this.onWeatherUpdate?.(result);
      
      return result;
    } catch (error) {
      console.warn('Weather fetch failed, using cache:', error);
      // Return stale cache if available
      return this.cachedData;
    }
  }
  
  // Get weather risk assessment
  getWeatherRisk(data: WeatherData | null): WeatherRisk {
    if (!data) {
      return { level: 'none', type: 'none', message: '' };
    }
    
    const { feelsLike, windSpeed, isRaining, uvIndex, aqi } = data;
    
    // Hazardous AQI (highest priority - immediate health risk)
    if (aqi !== null && aqi > 300) {
      return {
        level: 'extreme',
        type: 'aqi',
        message: 'Hazardous air. Stop immediately. Find shelter.',
      };
    }
    
    // Extreme heat
    if (feelsLike >= 45) {
      return {
        level: 'extreme',
        type: 'heat',
        message: 'Extreme heat. Stop immediately. Find shade and water.',
      };
    }
    
    // Very unhealthy AQI
    if (aqi !== null && aqi > 200) {
      return {
        level: 'danger',
        type: 'aqi',
        message: 'Very unhealthy air. Limit outdoor exposure.',
      };
    }
    
    // Danger heat
    if (feelsLike >= 40) {
      return {
        level: 'danger',
        type: 'heat',
        message: 'Dangerous heat. Stop for rest and water.',
      };
    }
    
    // Unhealthy AQI
    if (aqi !== null && aqi > 150) {
      return {
        level: 'warning',
        type: 'aqi',
        message: 'Unhealthy air quality. Take breaks indoors.',
      };
    }
    
    // Warning heat
    if (feelsLike >= 38) {
      return {
        level: 'warning',
        type: 'heat',
        message: 'High heat. Take breaks and hydrate.',
      };
    }
    
    // Rain warning
    if (isRaining) {
      return {
        level: 'warning',
        type: 'rain',
        message: 'Rain detected. Roads are slippery. Slow down.',
      };
    }
    
    // High wind
    if (windSpeed >= 40) {
      return {
        level: 'warning',
        type: 'wind',
        message: 'Strong winds. Hold steady. Stay alert.',
      };
    }
    
    // Sensitive groups AQI
    if (aqi !== null && aqi > 100) {
      return {
        level: 'caution',
        type: 'aqi',
        message: 'Air quality concern. Sensitive groups should rest.',
      };
    }
    
    // UV warning (mid-day riding)
    if (uvIndex >= 8) {
      return {
        level: 'caution',
        type: 'uv',
        message: 'High UV. Protect your skin.',
      };
    }
    
    // Caution heat
    if (feelsLike >= 35) {
      return {
        level: 'caution',
        type: 'heat',
        message: 'Warm conditions. Stay hydrated.',
      };
    }
    
    return { level: 'none', type: 'none', message: '' };
  }
  
  // Get specific AQI risk assessment
  getAQIRisk(data: WeatherData | null): AQIRisk | null {
    if (!data || data.aqi === null) return null;
    
    const aqi = data.aqi;
    
    if (aqi <= 50) {
      return { level: 'good', message: 'Good air quality' };
    }
    if (aqi <= 100) {
      return { level: 'moderate', message: 'Moderate air quality' };
    }
    if (aqi <= 150) {
      return { level: 'sensitive', message: 'Unhealthy for sensitive groups' };
    }
    if (aqi <= 200) {
      return { level: 'unhealthy', message: 'Unhealthy air quality' };
    }
    if (aqi <= 300) {
      return { level: 'very_unhealthy', message: 'Very unhealthy air' };
    }
    return { level: 'hazardous', message: 'Hazardous air quality' };
  }
  
  // Start periodic weather monitoring
  startMonitoring(getLocation: () => { lat: number; lng: number } | null): void {
    // Initial fetch
    const loc = getLocation();
    if (loc) {
      this.fetchWeather(loc.lat, loc.lng);
    }
    
    // Periodic updates
    this.checkInterval = window.setInterval(() => {
      const loc = getLocation();
      if (loc) {
        this.fetchWeather(loc.lat, loc.lng);
      }
    }, WEATHER_FETCH_INTERVAL);
  }
  
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
  
  getCachedWeather(): WeatherData | null {
    return this.cachedData;
  }
  
  // Check if cached data is stale (> 1 hour)
  isDataStale(): boolean {
    if (!this.cachedData) return true;
    return Date.now() - this.cachedData.lastUpdated > 60 * 60 * 1000;
  }
}

export const weatherService = new WeatherService();
