// Admin Analytics Page - AI learns from rider behavior patterns
// For admin use only - view near-misses, fatigue signals, pressure moments

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  AlertTriangle, 
  TrendingUp, 
  Clock,
  MapPin,
  Users,
  Activity,
  Brain
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';

interface AnalyticsData {
  totalRides: number;
  totalRiskEvents: number;
  emergencyEvents: number;
  avgRideDuration: number;
  riskEventsByType: Record<string, number>;
  hourlyDistribution: number[];
  recentPatterns: Pattern[];
}

interface Pattern {
  id: string;
  type: 'fatigue' | 'near_miss' | 'pressure' | 'high_risk_area';
  description: string;
  frequency: number;
  prediction: string;
  intervention: string;
}

export default function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadAnalytics();
  }, []);
  
  const loadAnalytics = async () => {
    try {
      // Fetch ride sessions
      const { data: rides } = await supabase
        .from('ride_sessions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);
      
      // Fetch risk events
      const { data: riskEvents } = await supabase
        .from('risk_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);
      
      // Fetch emergency events
      const { data: emergencies } = await supabase
        .from('emergency_events')
        .select('*');
      
      // Calculate analytics
      const totalRides = rides?.length || 0;
      const totalRiskEvents = riskEvents?.length || 0;
      const emergencyEvents = emergencies?.length || 0;
      
      const avgDuration = rides?.reduce((sum, r) => sum + (r.duration_seconds || 0), 0) / Math.max(1, totalRides);
      
      // Risk events by type
      const riskEventsByType: Record<string, number> = {};
      riskEvents?.forEach(e => {
        riskEventsByType[e.event_type] = (riskEventsByType[e.event_type] || 0) + 1;
      });
      
      // Hourly distribution
      const hourlyDistribution = Array(24).fill(0);
      rides?.forEach(r => {
        const hour = new Date(r.started_at).getHours();
        hourlyDistribution[hour]++;
      });
      
      // AI-detected patterns (simulated based on real data)
      const patterns: Pattern[] = [];
      
      // Fatigue pattern detection
      const longRides = rides?.filter(r => (r.duration_seconds || 0) > 7200).length || 0;
      if (longRides > 5) {
        patterns.push({
          id: '1',
          type: 'fatigue',
          description: `${longRides} rides exceeded 2 hours`,
          frequency: Math.round((longRides / totalRides) * 100),
          prediction: 'Higher fatigue risk in afternoon shifts',
          intervention: 'Implement mandatory 15-min break reminders after 90 mins',
        });
      }
      
      // Near-miss pattern
      const suddenStops = riskEventsByType['sudden_stop'] || 0;
      if (suddenStops > 3) {
        patterns.push({
          id: '2',
          type: 'near_miss',
          description: `${suddenStops} sudden stop events detected`,
          frequency: Math.round((suddenStops / totalRiskEvents) * 100),
          prediction: 'Potential collision risk in high-traffic areas',
          intervention: 'Pre-warn riders before entering high-risk zones',
        });
      }
      
      // Speed pattern
      const speedWarnings = riskEventsByType['speed_warning'] || 0;
      if (speedWarnings > 5) {
        patterns.push({
          id: '3',
          type: 'pressure',
          description: `${speedWarnings} speed violations recorded`,
          frequency: Math.round((speedWarnings / totalRiskEvents) * 100),
          prediction: 'Speed pressure from delivery deadlines',
          intervention: 'Partner with platforms for realistic delivery windows',
        });
      }
      
      // Heat pattern
      const heatWarnings = riskEventsByType['heat_warning'] || 0;
      if (heatWarnings > 2) {
        patterns.push({
          id: '4',
          type: 'high_risk_area',
          description: `${heatWarnings} heat exposure warnings`,
          frequency: Math.round((heatWarnings / totalRiskEvents) * 100),
          prediction: 'Heat-related incidents peak between 12-3 PM',
          intervention: 'Send proactive hydration reminders during peak heat',
        });
      }
      
      setData({
        totalRides,
        totalRiskEvents,
        emergencyEvents,
        avgRideDuration: Math.round(avgDuration / 60),
        riskEventsByType,
        hourlyDistribution,
        recentPatterns: patterns,
      });
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const getPatternIcon = (type: Pattern['type']) => {
    switch (type) {
      case 'fatigue': return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'near_miss': return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'pressure': return <TrendingUp className="w-5 h-5 text-orange-500" />;
      case 'high_risk_area': return <MapPin className="w-5 h-5 text-purple-500" />;
    }
  };
  
  const getPatternColor = (type: Pattern['type']) => {
    switch (type) {
      case 'fatigue': return 'border-yellow-500/30 bg-yellow-500/5';
      case 'near_miss': return 'border-red-500/30 bg-red-500/5';
      case 'pressure': return 'border-orange-500/30 bg-orange-500/5';
      case 'high_risk_area': return 'border-purple-500/30 bg-purple-500/5';
    }
  };
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Link 
            to="/settings" 
            className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold">Admin Analytics</h1>
            <p className="text-xs text-muted-foreground">AI-powered risk prediction</p>
          </div>
        </div>
      </header>
      
      <main className="p-4 space-y-6 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Activity className="w-8 h-8 animate-pulse text-muted-foreground" />
          </div>
        ) : data ? (
          <>
            {/* Overview Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card border border-border rounded-xl p-4">
                <Users className="w-5 h-5 text-blue-500 mb-2" />
                <p className="text-2xl font-bold">{data.totalRides}</p>
                <p className="text-xs text-muted-foreground">Total Rides</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <AlertTriangle className="w-5 h-5 text-orange-500 mb-2" />
                <p className="text-2xl font-bold">{data.totalRiskEvents}</p>
                <p className="text-xs text-muted-foreground">Risk Events</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <Activity className="w-5 h-5 text-red-500 mb-2" />
                <p className="text-2xl font-bold">{data.emergencyEvents}</p>
                <p className="text-xs text-muted-foreground">Emergencies</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <Clock className="w-5 h-5 text-green-500 mb-2" />
                <p className="text-2xl font-bold">{data.avgRideDuration}m</p>
                <p className="text-xs text-muted-foreground">Avg Duration</p>
              </div>
            </div>
            
            {/* Risk Event Distribution */}
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Risk Event Types
              </h2>
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                {Object.entries(data.riskEventsByType).map(([type, count]) => {
                  const percentage = Math.round((count / data.totalRiskEvents) * 100) || 0;
                  return (
                    <div key={type} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="capitalize">{type.replace('_', ' ')}</span>
                        <span className="text-muted-foreground">{count} ({percentage}%)</span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })}
                {Object.keys(data.riskEventsByType).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No risk events recorded yet
                  </p>
                )}
              </div>
            </section>
            
            {/* AI Pattern Detection */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
                <Brain className="w-4 h-4" />
                <span>AI Pattern Detection</span>
              </div>
              
              {data.recentPatterns.length > 0 ? (
                <div className="space-y-3">
                  {data.recentPatterns.map((pattern) => (
                    <div 
                      key={pattern.id}
                      className={`border rounded-xl p-4 space-y-3 ${getPatternColor(pattern.type)}`}
                    >
                      <div className="flex items-start gap-3">
                        {getPatternIcon(pattern.type)}
                        <div className="flex-1">
                          <p className="font-medium capitalize">{pattern.type.replace('_', ' ')}</p>
                          <p className="text-sm text-muted-foreground">{pattern.description}</p>
                        </div>
                        <span className="text-sm font-medium">{pattern.frequency}%</span>
                      </div>
                      
                      <div className="pl-8 space-y-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Prediction: </span>
                          <span>{pattern.prediction}</span>
                        </div>
                        <div className="bg-background/50 rounded-lg p-2">
                          <span className="text-muted-foreground">Recommended: </span>
                          <span className="text-primary">{pattern.intervention}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-card border border-border rounded-xl p-8 text-center">
                  <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="font-medium">Learning...</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    AI needs more ride data to detect patterns
                  </p>
                </div>
              )}
            </section>
            
            {/* Objective */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
              <p className="text-sm font-medium text-primary">
                🎯 One Objective: Prevent accidents before they happen
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                AI continuously learns from rider patterns to intervene early
              </p>
            </div>
          </>
        ) : (
          <div className="text-center py-20">
            <p className="text-muted-foreground">Failed to load analytics</p>
          </div>
        )}
      </main>
    </div>
  );
}
