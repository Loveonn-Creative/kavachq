import { useState, useEffect } from 'react';
import { MapPin, AlertTriangle, CheckCircle, TrendingDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface LocationMemory {
  id: string;
  cell_id: string;
  false_alarm_count: number | null;
  true_alarm_count: number | null;
  device_id: string;
}

interface HotSpot {
  cellId: string;
  falseAlarms: number;
  trueAlarms: number;
  accuracy: number;
  deviceCount: number;
}

export function LocationMemoryMap() {
  const [hotSpots, setHotSpots] = useState<HotSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalMemories, setTotalMemories] = useState(0);

  useEffect(() => {
    loadLocationMemories();
  }, []);

  const loadLocationMemories = async () => {
    try {
      const { data: memories } = await supabase
        .from('location_memories')
        .select('*')
        .order('false_alarm_count', { ascending: false })
        .limit(500);

      if (!memories || memories.length === 0) {
        setLoading(false);
        return;
      }

      setTotalMemories(memories.length);

      // Aggregate by cell_id across all devices
      const cellMap = new Map<string, { falseAlarms: number; trueAlarms: number; devices: Set<string> }>();
      
      memories.forEach((m: LocationMemory) => {
        const existing = cellMap.get(m.cell_id) || { falseAlarms: 0, trueAlarms: 0, devices: new Set() };
        existing.falseAlarms += m.false_alarm_count || 0;
        existing.trueAlarms += m.true_alarm_count || 0;
        existing.devices.add(m.device_id);
        cellMap.set(m.cell_id, existing);
      });

      // Convert to sorted array of hot spots
      const spots: HotSpot[] = Array.from(cellMap.entries())
        .map(([cellId, data]) => {
          const total = data.falseAlarms + data.trueAlarms;
          return {
            cellId,
            falseAlarms: data.falseAlarms,
            trueAlarms: data.trueAlarms,
            accuracy: total > 0 ? Math.round((data.trueAlarms / total) * 100) : 0,
            deviceCount: data.devices.size,
          };
        })
        .filter(s => s.falseAlarms > 0 || s.trueAlarms > 0)
        .sort((a, b) => b.falseAlarms - a.falseAlarms)
        .slice(0, 10);

      setHotSpots(spots);
    } catch (error) {
      console.error('Failed to load location memories:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCellCoordinates = (cellId: string) => {
    // cellId format: "lat_lng" with 3 decimal precision (~100m)
    const parts = cellId.split('_');
    if (parts.length === 2) {
      return { lat: parseFloat(parts[0]), lng: parseFloat(parts[1]) };
    }
    return null;
  };

  const getSpotColor = (accuracy: number) => {
    if (accuracy >= 70) return 'border-safe/40 bg-safe/10';
    if (accuracy >= 40) return 'border-warning/40 bg-warning/10';
    return 'border-danger/40 bg-danger/10';
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <MapPin className="w-8 h-8 animate-pulse text-muted-foreground mx-auto" />
      </div>
    );
  }

  if (hotSpots.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
        <p className="font-medium">No Location Data Yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          The system learns from alert confirmations at different locations
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <MapPin className="w-5 h-5 text-primary mx-auto mb-2" />
          <p className="text-2xl font-bold">{totalMemories}</p>
          <p className="text-xs text-muted-foreground">Locations Learned</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <TrendingDown className="w-5 h-5 text-safe mx-auto mb-2" />
          <p className="text-2xl font-bold">{hotSpots.filter(s => s.accuracy < 30).length}</p>
          <p className="text-xs text-muted-foreground">False Alarm Hotspots</p>
        </div>
      </div>

      {/* Hot Spots List */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/50">
          <h3 className="text-sm font-medium">Top False Alarm Locations</h3>
          <p className="text-xs text-muted-foreground">Locations with most "I'm OK" responses</p>
        </div>

        <div className="divide-y divide-border">
          {hotSpots.map((spot) => {
            const coords = getCellCoordinates(spot.cellId);
            return (
              <div key={spot.cellId} className={`p-3 ${getSpotColor(spot.accuracy)}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-mono">
                      {coords 
                        ? `${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)}`
                        : spot.cellId
                      }
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {spot.deviceCount} device{spot.deviceCount > 1 ? 's' : ''}
                  </span>
                </div>
                
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-danger" />
                    <span>{spot.falseAlarms} false</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-safe" />
                    <span>{spot.trueAlarms} real</span>
                  </div>
                  <div className="ml-auto">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      spot.accuracy >= 70 
                        ? 'bg-safe/20 text-safe' 
                        : spot.accuracy >= 40 
                          ? 'bg-warning/20 text-warning'
                          : 'bg-danger/20 text-danger'
                    }`}>
                      {spot.accuracy}% accurate
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Explanation */}
      <div className="bg-muted/50 rounded-xl p-4 text-center">
        <p className="text-xs text-muted-foreground">
          🧠 The AI automatically reduces confidence for alerts at known false-alarm locations,
          preventing unnecessary emergency triggers
        </p>
      </div>
    </div>
  );
}
