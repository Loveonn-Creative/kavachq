// Offline-first storage for low network conditions
// Syncs to cloud when network returns

import { supabase } from '@/integrations/supabase/client';
import { getDeviceId } from './deviceId';
import type { RiskEvent, RideState } from './rideMonitor';

const RIDE_SESSIONS_KEY = 'kavach_ride_sessions';
const RISK_EVENTS_KEY = 'kavach_risk_events';
const EMERGENCY_EVENTS_KEY = 'kavach_emergency_events';
const SYNC_QUEUE_KEY = 'kavach_sync_queue';

interface StoredRideSession {
  id: string;
  device_id: string;
  started_at: string;
  ended_at?: string;
  duration_seconds?: number;
  status: 'active' | 'completed' | 'emergency';
  start_location?: { lat: number; lng: number };
  end_location?: { lat: number; lng: number };
  synced: boolean;
}

interface StoredRiskEvent {
  id: string;
  ride_session_id: string;
  device_id: string;
  event_type: string;
  severity: string;
  location?: { lat: number; lng: number };
  message?: string;
  created_at: string;
  synced: boolean;
}

interface StoredEmergencyEvent {
  id: string;
  ride_session_id: string;
  device_id: string;
  trigger_type: 'manual' | 'auto_fall' | 'auto_idle' | 'auto_crash';
  location?: { lat: number; lng: number };
  status: 'active' | 'resolved' | 'false_alarm';
  created_at: string;
  synced: boolean;
}

// Generate UUID
function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : 
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
}

// Get stored data
function getStoredData<T>(key: string): T[] {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// Save data
function saveData<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
}

// Ride Sessions
export async function startRideSession(location?: { lat: number; lng: number }): Promise<string> {
  const deviceId = getDeviceId();
  const sessionId = generateId();
  
  const session: StoredRideSession = {
    id: sessionId,
    device_id: deviceId,
    started_at: new Date().toISOString(),
    status: 'active',
    start_location: location,
    synced: false,
  };
  
  const sessions = getStoredData<StoredRideSession>(RIDE_SESSIONS_KEY);
  sessions.push(session);
  saveData(RIDE_SESSIONS_KEY, sessions);
  
  // Try to sync immediately
  syncToCloud();
  
  return sessionId;
}

export async function endRideSession(
  sessionId: string,
  finalState: RideState
): Promise<void> {
  const sessions = getStoredData<StoredRideSession>(RIDE_SESSIONS_KEY);
  const sessionIndex = sessions.findIndex(s => s.id === sessionId);
  
  if (sessionIndex !== -1) {
    const duration = finalState.startTime 
      ? Math.round((Date.now() - finalState.startTime) / 1000)
      : 0;
    
    sessions[sessionIndex] = {
      ...sessions[sessionIndex],
      ended_at: new Date().toISOString(),
      duration_seconds: duration,
      status: 'completed',
      end_location: finalState.lastPosition ? {
        lat: finalState.lastPosition.coords.latitude,
        lng: finalState.lastPosition.coords.longitude,
      } : undefined,
      synced: false,
    };
    
    saveData(RIDE_SESSIONS_KEY, sessions);
    syncToCloud();
  }
}

// Risk Events
export async function saveRiskEvent(
  sessionId: string,
  event: RiskEvent
): Promise<void> {
  const deviceId = getDeviceId();
  
  const storedEvent: StoredRiskEvent = {
    id: generateId(),
    ride_session_id: sessionId,
    device_id: deviceId,
    event_type: event.type,
    severity: event.severity,
    location: event.location,
    message: event.message,
    created_at: new Date(event.timestamp).toISOString(),
    synced: false,
  };
  
  const events = getStoredData<StoredRiskEvent>(RISK_EVENTS_KEY);
  events.push(storedEvent);
  saveData(RISK_EVENTS_KEY, events);
  
  syncToCloud();
}

// Emergency Events
export async function saveEmergencyEvent(
  sessionId: string,
  triggerType: 'manual' | 'auto_fall' | 'auto_idle' | 'auto_crash',
  location?: { lat: number; lng: number }
): Promise<string> {
  const deviceId = getDeviceId();
  const eventId = generateId();
  
  const event: StoredEmergencyEvent = {
    id: eventId,
    ride_session_id: sessionId,
    device_id: deviceId,
    trigger_type: triggerType,
    location,
    status: 'active',
    created_at: new Date().toISOString(),
    synced: false,
  };
  
  const events = getStoredData<StoredEmergencyEvent>(EMERGENCY_EVENTS_KEY);
  events.push(event);
  saveData(EMERGENCY_EVENTS_KEY, events);
  
  // Priority sync for emergencies
  syncEmergencyToCloud(event);
  
  return eventId;
}

export async function resolveEmergency(
  eventId: string,
  status: 'resolved' | 'false_alarm'
): Promise<void> {
  const events = getStoredData<StoredEmergencyEvent>(EMERGENCY_EVENTS_KEY);
  const eventIndex = events.findIndex(e => e.id === eventId);
  
  if (eventIndex !== -1) {
    events[eventIndex] = {
      ...events[eventIndex],
      status,
      synced: false,
    };
    saveData(EMERGENCY_EVENTS_KEY, events);
    syncToCloud();
  }
}

// Cloud Sync
async function syncToCloud(): Promise<void> {
  if (!navigator.onLine) return;
  
  try {
    // Sync unsynced ride sessions
    const sessions = getStoredData<StoredRideSession>(RIDE_SESSIONS_KEY);
    const unsyncedSessions = sessions.filter(s => !s.synced);
    
    for (const session of unsyncedSessions) {
      const { error } = await supabase.from('ride_sessions').upsert({
        id: session.id,
        device_id: session.device_id,
        started_at: session.started_at,
        ended_at: session.ended_at,
        duration_seconds: session.duration_seconds,
        status: session.status,
        start_location: session.start_location,
        end_location: session.end_location,
      });
      
      if (!error) {
        session.synced = true;
      }
    }
    saveData(RIDE_SESSIONS_KEY, sessions);
    
    // Sync unsynced risk events
    const riskEvents = getStoredData<StoredRiskEvent>(RISK_EVENTS_KEY);
    const unsyncedRiskEvents = riskEvents.filter(e => !e.synced);
    
    for (const event of unsyncedRiskEvents) {
      const { error } = await supabase.from('risk_events').upsert({
        id: event.id,
        ride_session_id: event.ride_session_id,
        device_id: event.device_id,
        event_type: event.event_type,
        severity: event.severity,
        location: event.location,
        message: event.message,
        created_at: event.created_at,
      });
      
      if (!error) {
        event.synced = true;
      }
    }
    saveData(RISK_EVENTS_KEY, riskEvents);
    
    // Sync emergency events
    const emergencyEvents = getStoredData<StoredEmergencyEvent>(EMERGENCY_EVENTS_KEY);
    const unsyncedEmergencyEvents = emergencyEvents.filter(e => !e.synced);
    
    for (const event of unsyncedEmergencyEvents) {
      const { error } = await supabase.from('emergency_events').upsert({
        id: event.id,
        ride_session_id: event.ride_session_id,
        device_id: event.device_id,
        trigger_type: event.trigger_type,
        location: event.location,
        status: event.status,
        created_at: event.created_at,
      });
      
      if (!error) {
        event.synced = true;
      }
    }
    saveData(EMERGENCY_EVENTS_KEY, emergencyEvents);
    
  } catch (error) {
    console.warn('Sync failed, will retry later:', error);
  }
}

async function syncEmergencyToCloud(event: StoredEmergencyEvent): Promise<void> {
  if (!navigator.onLine) return;
  
  try {
    await supabase.from('emergency_events').upsert({
      id: event.id,
      ride_session_id: event.ride_session_id,
      device_id: event.device_id,
      trigger_type: event.trigger_type,
      location: event.location,
      status: event.status,
      created_at: event.created_at,
    });
    
    event.synced = true;
    const events = getStoredData<StoredEmergencyEvent>(EMERGENCY_EVENTS_KEY);
    const idx = events.findIndex(e => e.id === event.id);
    if (idx !== -1) {
      events[idx] = event;
      saveData(EMERGENCY_EVENTS_KEY, events);
    }
  } catch (error) {
    console.warn('Emergency sync failed:', error);
  }
}

// Auto-sync when network comes back
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Network restored, syncing...');
    syncToCloud();
  });
}

// Get ride history for device
export function getLocalRideHistory(): StoredRideSession[] {
  const deviceId = getDeviceId();
  return getStoredData<StoredRideSession>(RIDE_SESSIONS_KEY)
    .filter(s => s.device_id === deviceId)
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
}

// Clear old data (keep last 30 days)
export function cleanupOldData(): void {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  
  const sessions = getStoredData<StoredRideSession>(RIDE_SESSIONS_KEY)
    .filter(s => new Date(s.started_at).getTime() > thirtyDaysAgo);
  saveData(RIDE_SESSIONS_KEY, sessions);
  
  const riskEvents = getStoredData<StoredRiskEvent>(RISK_EVENTS_KEY)
    .filter(e => new Date(e.created_at).getTime() > thirtyDaysAgo);
  saveData(RISK_EVENTS_KEY, riskEvents);
}
