import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock, AlertTriangle, MapPin, CheckCircle } from 'lucide-react';
import { getLocalRideHistory } from '@/lib/offlineStorage';
import { supabase } from '@/integrations/supabase/client';
import { getDeviceId } from '@/lib/deviceId';
import { format } from 'date-fns';

interface RideSession {
  id: string;
  started_at: string;
  ended_at?: string | null;
  duration_seconds?: number | null;
  status: string;
  start_location?: { lat: number; lng: number } | null;
}

interface RiskEvent {
  id: string;
  ride_session_id: string | null;
  event_type: string;
  severity: string;
  message?: string | null;
  created_at: string;
}

export default function RideHistory() {
  const [rides, setRides] = useState<RideSession[]>([]);
  const [riskEvents, setRiskEvents] = useState<Record<string, RiskEvent[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRideHistory();
  }, []);

  async function loadRideHistory() {
    const deviceId = getDeviceId();
    
    // First get local data
    const localRides = getLocalRideHistory();
    setRides(localRides);
    
    // Then try to fetch from cloud
    try {
      const { data: cloudRides } = await supabase
        .from('ride_sessions')
        .select('*')
        .eq('device_id', deviceId)
        .order('started_at', { ascending: false })
        .limit(50);
      
      if (cloudRides && cloudRides.length > 0) {
        // Map cloud rides to our interface
        const mappedRides: RideSession[] = cloudRides.map(r => ({
          id: r.id,
          started_at: r.started_at,
          ended_at: r.ended_at,
          duration_seconds: r.duration_seconds,
          status: r.status,
          start_location: r.start_location as { lat: number; lng: number } | null,
        }));
        
        // Merge local and cloud, preferring cloud data
        const mergedRides = [...mappedRides];
        localRides.forEach(local => {
          if (!mergedRides.find(c => c.id === local.id)) {
            mergedRides.push(local);
          }
        });
        mergedRides.sort((a, b) => 
          new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
        );
        setRides(mergedRides);
        
        // Fetch risk events for these rides
        const rideIds = mergedRides.map(r => r.id);
        const { data: events } = await supabase
          .from('risk_events')
          .select('*')
          .in('ride_session_id', rideIds);
        
        if (events) {
          const grouped: Record<string, RiskEvent[]> = {};
          events.forEach(event => {
            if (event.ride_session_id && !grouped[event.ride_session_id]) {
              grouped[event.ride_session_id] = [];
            }
            if (event.ride_session_id) {
              grouped[event.ride_session_id].push(event);
            }
          });
          setRiskEvents(grouped);
        }
      }
    } catch (error) {
      console.warn('Failed to fetch cloud data:', error);
    }
    
    setLoading(false);
  }

  function formatDuration(seconds?: number): string {
    if (!seconds) return '—';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  }

  function getSeverityColor(severity: string): string {
    switch (severity) {
      case 'high': return 'text-red-500';
      case 'medium': return 'text-amber-500';
      default: return 'text-yellow-500';
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Link 
            to="/" 
            className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors"
            aria-label="Back to home"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-semibold">Ride History</h1>
        </div>
      </header>

      {/* Content */}
      <main className="p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rides.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No rides yet</p>
            <p className="text-sm mt-1">Start your first ride to see history here</p>
          </div>
        ) : (
          rides.map(ride => {
            const events = riskEvents[ride.id] || [];
            const hasRisks = events.length > 0;
            
            return (
              <div 
                key={ride.id}
                className="bg-card border border-border rounded-xl p-4 space-y-3"
              >
                {/* Ride header */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">
                      {format(new Date(ride.started_at), 'MMM d, yyyy')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(ride.started_at), 'h:mm a')}
                      {ride.ended_at && ` – ${format(new Date(ride.ended_at), 'h:mm a')}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {ride.status === 'completed' && (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                    {ride.status === 'emergency' && (
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>{formatDuration(ride.duration_seconds)}</span>
                  </div>
                  {ride.start_location && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      <span>
                        {ride.start_location.lat.toFixed(3)}, {ride.start_location.lng.toFixed(3)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Risk events */}
                {hasRisks && (
                  <div className="pt-2 border-t border-border space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Risk Events ({events.length})
                    </p>
                    {events.map(event => (
                      <div 
                        key={event.id}
                        className="flex items-start gap-2 text-sm"
                      >
                        <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${getSeverityColor(event.severity)}`} />
                        <div>
                          <span className="font-medium capitalize">
                            {event.event_type.replace(/_/g, ' ')}
                          </span>
                          {event.message && (
                            <p className="text-muted-foreground text-xs mt-0.5">
                              {event.message}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}
