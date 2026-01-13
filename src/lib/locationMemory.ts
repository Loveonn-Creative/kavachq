// Location-based false alarm memory system
// Learns from rider confirmations to reduce false alerts at known locations

import { supabase } from '@/integrations/supabase/client';
import { getDeviceId } from './deviceId';

const LOCATION_MEMORIES_KEY = 'kavach_location_memories';
const CELL_PRECISION = 4; // ~11m precision for geohash

export interface LocationMemory {
  cellId: string;
  falseAlarmCount: number;
  trueAlarmCount: number;
  lastTriggered: number;
  sensorSignature?: {
    avgAccelVariance: number;
    avgGyroVariance: number;
    eventTypes: string[];
  };
  synced: boolean;
}

export interface SensorData {
  accelVariance?: number;
  gyroVariance?: number;
  speed?: number;
  eventType: string;
}

// Generate a geohash-like cell ID from coordinates
export function getLocationCellId(lat: number, lng: number): string {
  // Round to ~11m precision (4 decimal places)
  const latCell = lat.toFixed(CELL_PRECISION);
  const lngCell = lng.toFixed(CELL_PRECISION);
  return `${latCell},${lngCell}`;
}

// Get stored memories from localStorage
function getStoredMemories(): Map<string, LocationMemory> {
  try {
    const data = localStorage.getItem(LOCATION_MEMORIES_KEY);
    if (data) {
      const arr: LocationMemory[] = JSON.parse(data);
      return new Map(arr.map(m => [m.cellId, m]));
    }
  } catch {
    // Ignore parse errors
  }
  return new Map();
}

// Save memories to localStorage
function saveMemories(memories: Map<string, LocationMemory>): void {
  try {
    const arr = Array.from(memories.values());
    localStorage.setItem(LOCATION_MEMORIES_KEY, JSON.stringify(arr));
  } catch (e) {
    console.error('Failed to save location memories:', e);
  }
}

// Get memory for a specific location
export function getLocationMemory(lat: number, lng: number): LocationMemory | null {
  const cellId = getLocationCellId(lat, lng);
  const memories = getStoredMemories();
  return memories.get(cellId) || null;
}

// Calculate confidence adjustment based on location history
export function getLocationConfidenceAdjustment(lat: number, lng: number): number {
  const memory = getLocationMemory(lat, lng);
  
  if (!memory) return 0; // No history, no adjustment
  
  const totalEvents = memory.falseAlarmCount + memory.trueAlarmCount;
  if (totalEvents === 0) return 0;
  
  // Calculate false alarm ratio
  const falseRatio = memory.falseAlarmCount / totalEvents;
  
  // More false alarms = bigger negative adjustment
  // Max -30 if 100% false alarms at this location
  // Minimum 3 events needed for significant adjustment
  if (totalEvents < 3) {
    return -Math.round(falseRatio * 10); // Small adjustment for few events
  }
  
  return -Math.round(falseRatio * 30);
}

// Record a false alarm at a location (rider said "OK")
export async function recordFalseAlarm(
  lat: number,
  lng: number,
  sensorData?: SensorData
): Promise<void> {
  const cellId = getLocationCellId(lat, lng);
  const memories = getStoredMemories();
  
  const existing = memories.get(cellId);
  const now = Date.now();
  
  const updated: LocationMemory = {
    cellId,
    falseAlarmCount: (existing?.falseAlarmCount || 0) + 1,
    trueAlarmCount: existing?.trueAlarmCount || 0,
    lastTriggered: now,
    sensorSignature: sensorData ? updateSensorSignature(existing?.sensorSignature, sensorData) : existing?.sensorSignature,
    synced: false,
  };
  
  memories.set(cellId, updated);
  saveMemories(memories);
  
  // Sync to cloud
  syncMemoryToCloud(updated);
}

// Record a true alert at a location (rider confirmed danger)
export async function recordTrueAlert(
  lat: number,
  lng: number,
  sensorData?: SensorData
): Promise<void> {
  const cellId = getLocationCellId(lat, lng);
  const memories = getStoredMemories();
  
  const existing = memories.get(cellId);
  const now = Date.now();
  
  const updated: LocationMemory = {
    cellId,
    falseAlarmCount: existing?.falseAlarmCount || 0,
    trueAlarmCount: (existing?.trueAlarmCount || 0) + 1,
    lastTriggered: now,
    sensorSignature: existing?.sensorSignature,
    synced: false,
  };
  
  memories.set(cellId, updated);
  saveMemories(memories);
  
  syncMemoryToCloud(updated);
}

// Update sensor signature with new data
function updateSensorSignature(
  existing: LocationMemory['sensorSignature'],
  newData: SensorData
): LocationMemory['sensorSignature'] {
  if (!existing) {
    return {
      avgAccelVariance: newData.accelVariance || 0,
      avgGyroVariance: newData.gyroVariance || 0,
      eventTypes: [newData.eventType],
    };
  }
  
  // Running average
  const count = existing.eventTypes.length;
  return {
    avgAccelVariance: (existing.avgAccelVariance * count + (newData.accelVariance || 0)) / (count + 1),
    avgGyroVariance: (existing.avgGyroVariance * count + (newData.gyroVariance || 0)) / (count + 1),
    eventTypes: [...new Set([...existing.eventTypes, newData.eventType])].slice(-10),
  };
}

// Sync memory to cloud
async function syncMemoryToCloud(memory: LocationMemory): Promise<void> {
  if (!navigator.onLine) return;
  
  const deviceId = getDeviceId();
  
  try {
    const { error } = await supabase.from('location_memories').upsert({
      device_id: deviceId,
      cell_id: memory.cellId,
      false_alarm_count: memory.falseAlarmCount,
      true_alarm_count: memory.trueAlarmCount,
      sensor_signature: memory.sensorSignature,
    }, {
      onConflict: 'device_id,cell_id',
    });
    
    if (!error) {
      const memories = getStoredMemories();
      const updated = memories.get(memory.cellId);
      if (updated) {
        updated.synced = true;
        memories.set(memory.cellId, updated);
        saveMemories(memories);
      }
    }
  } catch (e) {
    console.warn('Failed to sync location memory:', e);
  }
}

// Sync all unsynced memories
export async function syncAllMemories(): Promise<void> {
  if (!navigator.onLine) return;
  
  const memories = getStoredMemories();
  const unsynced = Array.from(memories.values()).filter(m => !m.synced);
  
  for (const memory of unsynced) {
    await syncMemoryToCloud(memory);
  }
}

// Load memories from cloud (on app start)
export async function loadMemoriesFromCloud(): Promise<void> {
  if (!navigator.onLine) return;
  
  const deviceId = getDeviceId();
  
  try {
    const { data, error } = await supabase
      .from('location_memories')
      .select('*')
      .eq('device_id', deviceId);
    
    if (error || !data) return;
    
    const memories = getStoredMemories();
    
    for (const row of data) {
      const existing = memories.get(row.cell_id);
      
      // Merge: keep higher counts
      memories.set(row.cell_id, {
        cellId: row.cell_id,
        falseAlarmCount: Math.max(existing?.falseAlarmCount || 0, row.false_alarm_count || 0),
        trueAlarmCount: Math.max(existing?.trueAlarmCount || 0, row.true_alarm_count || 0),
        lastTriggered: existing?.lastTriggered || new Date(row.updated_at).getTime(),
        sensorSignature: row.sensor_signature as LocationMemory['sensorSignature'] || existing?.sensorSignature,
        synced: true,
      });
    }
    
    saveMemories(memories);
  } catch (e) {
    console.warn('Failed to load location memories:', e);
  }
}

// Clean up old memories (older than 30 days)
export function cleanupOldMemories(): void {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const memories = getStoredMemories();
  
  for (const [cellId, memory] of memories) {
    if (memory.lastTriggered < thirtyDaysAgo) {
      memories.delete(cellId);
    }
  }
  
  saveMemories(memories);
}

// Get location risk score (for admin/analytics)
export function getLocationRiskScore(lat: number, lng: number): number {
  const memory = getLocationMemory(lat, lng);
  if (!memory) return 50; // Unknown = neutral
  
  const total = memory.falseAlarmCount + memory.trueAlarmCount;
  if (total === 0) return 50;
  
  // Higher score = more true alerts = more dangerous
  const trueRatio = memory.trueAlarmCount / total;
  return Math.round(50 + trueRatio * 50);
}

// Initialize on load
if (typeof window !== 'undefined') {
  window.addEventListener('online', syncAllMemories);
  // Load from cloud on startup
  loadMemoriesFromCloud();
}
