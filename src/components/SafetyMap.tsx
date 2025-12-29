import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Droplet, Coffee, AlertTriangle, Navigation, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { rideMonitor } from '@/lib/rideMonitor';

interface SafetyMapProps {
  isOpen: boolean;
  onClose: () => void;
}

interface RestStop {
  id: string;
  name: string | null;
  location: { lat: number; lng: number };
  stop_type: string;
  verified: boolean;
}

interface UnsafeZone {
  id: string;
  location: { lat: number; lng: number };
  risk_type: string;
  severity: string;
  radius_meters: number;
}

export function SafetyMap({ isOpen, onClose }: SafetyMapProps) {
  const [restStops, setRestStops] = useState<RestStop[]>([]);
  const [unsafeZones, setUnsafeZones] = useState<UnsafeZone[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<RestStop | UnsafeZone | null>(null);
  
  // Load data
  useEffect(() => {
    if (isOpen) {
      loadData();
      // Get current location
      const loc = rideMonitor.getCurrentLocation();
      if (loc) {
        setCurrentLocation(loc);
      } else {
        // Try to get location
        navigator.geolocation?.getCurrentPosition(
          (pos) => {
            setCurrentLocation({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            });
          },
          () => {
            // Use default Delhi location for demo
            setCurrentLocation({ lat: 28.6139, lng: 77.2090 });
          }
        );
      }
    }
  }, [isOpen]);
  
  const loadData = async () => {
    setIsLoading(true);
    
    try {
      // Load rest stops
      const { data: stops } = await supabase
        .from('rest_stops')
        .select('*')
        .eq('active', true)
        .limit(50);
      
      if (stops) {
        setRestStops(stops.map(s => ({
          id: s.id,
          name: s.name,
          location: s.location as { lat: number; lng: number },
          stop_type: s.stop_type,
          verified: s.verified || false,
        })));
      }
      
      // Load unsafe zones
      const { data: zones } = await supabase
        .from('unsafe_zones')
        .select('*')
        .eq('active', true)
        .limit(50);
      
      if (zones) {
        setUnsafeZones(zones.map(z => ({
          id: z.id,
          location: z.location as { lat: number; lng: number },
          risk_type: z.risk_type,
          severity: z.severity,
          radius_meters: z.radius_meters,
        })));
      }
    } catch (e) {
      console.error('Failed to load map data:', e);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Calculate distance in km
  const calculateDistance = (loc1: { lat: number; lng: number }, loc2: { lat: number; lng: number }) => {
    const R = 6371; // Earth's radius in km
    const dLat = (loc2.lat - loc1.lat) * Math.PI / 180;
    const dLng = (loc2.lng - loc1.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(loc1.lat * Math.PI / 180) * Math.cos(loc2.lat * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };
  
  // Get icon for stop type
  const getStopIcon = (type: string) => {
    switch (type) {
      case 'water':
        return <Droplet className="w-4 h-4 text-blue-400" />;
      case 'rest':
        return <Coffee className="w-4 h-4 text-amber-400" />;
      case 'toilet':
        return <MapPin className="w-4 h-4 text-green-400" />;
      default:
        return <MapPin className="w-4 h-4 text-primary" />;
    }
  };
  
  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-destructive/20 border-destructive text-destructive';
      case 'medium':
        return 'bg-amber-500/20 border-amber-500 text-amber-500';
      default:
        return 'bg-yellow-500/20 border-yellow-500 text-yellow-500';
    }
  };
  
  // Open in maps
  const openInMaps = (loc: { lat: number; lng: number }) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`;
    window.open(url, '_blank');
  };
  
  if (!isOpen) return null;
  
  // Sort by distance if we have current location
  const sortedStops = currentLocation
    ? [...restStops].sort((a, b) => 
        calculateDistance(currentLocation, a.location) - calculateDistance(currentLocation, b.location)
      )
    : restStops;
  
  const sortedZones = currentLocation
    ? [...unsafeZones].sort((a, b) => 
        calculateDistance(currentLocation, a.location) - calculateDistance(currentLocation, b.location)
      )
    : unsafeZones;
  
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-background rounded-t-3xl w-full max-w-lg max-h-[85vh] overflow-hidden"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Nearby Places</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadData}
                className="p-2 rounded-full hover:bg-secondary transition-colors"
                disabled={isLoading}
              >
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-secondary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {/* Content */}
          <div className="overflow-y-auto max-h-[70vh] p-4">
            {/* Current Location */}
            {currentLocation && (
              <div className="flex items-center gap-2 mb-4 p-2 rounded-lg bg-primary/10">
                <Navigation className="w-4 h-4 text-primary" />
                <span className="text-sm text-muted-foreground">
                  Your location: {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
                </span>
              </div>
            )}
            
            {/* Unsafe Zones */}
            {sortedZones.length > 0 && (
              <div className="mb-6">
                <h3 className="flex items-center gap-2 text-sm font-medium text-destructive mb-3">
                  <AlertTriangle className="w-4 h-4" />
                  Reported Unsafe Areas
                </h3>
                <div className="space-y-2">
                  {sortedZones.slice(0, 5).map((zone) => (
                    <motion.div
                      key={zone.id}
                      className={`flex items-center justify-between p-3 rounded-xl border ${getSeverityColor(zone.severity)}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      onClick={() => openInMaps(zone.location)}
                    >
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5" />
                        <div>
                          <p className="font-medium capitalize">{zone.risk_type.replace('_', ' ')}</p>
                          <p className="text-xs opacity-70">
                            {currentLocation 
                              ? `${calculateDistance(currentLocation, zone.location).toFixed(1)} km away`
                              : 'Tap to navigate'}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs uppercase font-medium px-2 py-1 rounded bg-black/20">
                        {zone.severity}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Rest Stops */}
            <div>
              <h3 className="flex items-center gap-2 text-sm font-medium text-green-400 mb-3">
                <Coffee className="w-4 h-4" />
                Rest Stops & Water Points
              </h3>
              
              {sortedStops.length === 0 && !isLoading && (
                <p className="text-center text-muted-foreground py-4 text-sm">
                  No rest stops reported nearby yet.
                  <br />
                  Community-reported stops will appear here.
                </p>
              )}
              
              <div className="space-y-2">
                {sortedStops.map((stop) => (
                  <motion.div
                    key={stop.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => openInMaps(stop.location)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                        {getStopIcon(stop.stop_type)}
                      </div>
                      <div>
                        <p className="font-medium">
                          {stop.name || `${stop.stop_type.charAt(0).toUpperCase() + stop.stop_type.slice(1)} Point`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {currentLocation 
                            ? `${calculateDistance(currentLocation, stop.location).toFixed(1)} km away`
                            : 'Tap to navigate'}
                        </p>
                      </div>
                    </div>
                    {stop.verified && (
                      <span className="text-xs text-green-400 px-2 py-1 rounded bg-green-400/10">
                        Verified
                      </span>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
            
            {/* Empty state */}
            {sortedStops.length === 0 && sortedZones.length === 0 && !isLoading && (
              <div className="text-center py-8">
                <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">
                  No data available yet.
                  <br />
                  <span className="text-sm">Rest stops and alerts will appear as the community reports them.</span>
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
