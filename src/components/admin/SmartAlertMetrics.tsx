import { useState, useEffect } from 'react';
import { 
  Target, 
  TrendingDown, 
  CheckCircle, 
  XCircle,
  Mic,
  Clock,
  MapPin
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';

interface SmartAlertData {
  totalAlerts: number;
  confirmedOk: number;
  confirmedDanger: number;
  timeoutNoResponse: number;
  cancelled: number;
  avgResponseTimeMs: number;
  accuracyRate: number;
  falsePositiveRate: number;
  confidenceDistribution: { range: string; count: number }[];
}

export function SmartAlertMetrics() {
  const [data, setData] = useState<SmartAlertData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      const { data: confirmations } = await supabase
        .from('alert_confirmations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (!confirmations || confirmations.length === 0) {
        setData({
          totalAlerts: 0,
          confirmedOk: 0,
          confirmedDanger: 0,
          timeoutNoResponse: 0,
          cancelled: 0,
          avgResponseTimeMs: 0,
          accuracyRate: 0,
          falsePositiveRate: 0,
          confidenceDistribution: [],
        });
        setLoading(false);
        return;
      }

      const totalAlerts = confirmations.length;
      const confirmedOk = confirmations.filter(c => c.confirmation === 'ok').length;
      const confirmedDanger = confirmations.filter(c => c.confirmation === 'danger').length;
      const timeoutNoResponse = confirmations.filter(c => c.confirmation === 'timeout').length;
      const cancelled = confirmations.filter(c => c.confirmation === 'cancelled').length;

      // Calculate average response time (only for valid responses)
      const responseTimes = confirmations
        .filter(c => c.response_time_ms && c.response_time_ms > 0)
        .map(c => c.response_time_ms!);
      const avgResponseTimeMs = responseTimes.length > 0 
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : 0;

      // Accuracy = confirmed dangers that were actual emergencies
      // For this demo, we consider timeout + danger as "real alerts" and ok + cancelled as "false"
      const realAlerts = confirmedDanger + timeoutNoResponse;
      const falseAlerts = confirmedOk + cancelled;
      const accuracyRate = totalAlerts > 0 
        ? Math.round((realAlerts / totalAlerts) * 100)
        : 0;
      const falsePositiveRate = totalAlerts > 0
        ? Math.round((falseAlerts / totalAlerts) * 100)
        : 0;

      // Confidence distribution
      const confidenceRanges = [
        { range: '0-25%', min: 0, max: 25, count: 0 },
        { range: '26-50%', min: 26, max: 50, count: 0 },
        { range: '51-75%', min: 51, max: 75, count: 0 },
        { range: '76-100%', min: 76, max: 100, count: 0 },
      ];

      confirmations.forEach(c => {
        const confidence = c.initial_confidence || 0;
        const range = confidenceRanges.find(r => confidence >= r.min && confidence <= r.max);
        if (range) range.count++;
      });

      setData({
        totalAlerts,
        confirmedOk,
        confirmedDanger,
        timeoutNoResponse,
        cancelled,
        avgResponseTimeMs,
        accuracyRate,
        falsePositiveRate,
        confidenceDistribution: confidenceRanges.map(r => ({ range: r.range, count: r.count })),
      });
    } catch (error) {
      console.error('Failed to load smart alert metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <Target className="w-8 h-8 animate-pulse text-muted-foreground mx-auto" />
      </div>
    );
  }

  if (!data || data.totalAlerts === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <Target className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
        <p className="font-medium">No Alert Data Yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Voice confirmations will appear here once riders start responding to alerts
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main Accuracy Card */}
      <div className="bg-gradient-to-br from-safe/10 to-safe/5 border border-safe/30 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-safe" />
            <span className="font-medium">System Accuracy</span>
          </div>
          <span className="text-2xl font-bold text-safe">{100 - data.falsePositiveRate}%</span>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <TrendingDown className="w-4 h-4 text-safe" />
              <span className="text-muted-foreground">False Positives</span>
            </div>
            <p className="text-xl font-semibold">{data.falsePositiveRate}%</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">Avg Response</span>
            </div>
            <p className="text-xl font-semibold">{(data.avgResponseTimeMs / 1000).toFixed(1)}s</p>
          </div>
        </div>
      </div>

      {/* Confirmation Breakdown */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Voice Confirmation Results
        </h3>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-safe/10 border border-safe/20">
            <CheckCircle className="w-5 h-5 text-safe" />
            <div>
              <p className="text-lg font-semibold">{data.confirmedOk}</p>
              <p className="text-xs text-muted-foreground">Said "OK"</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 rounded-lg bg-danger/10 border border-danger/20">
            <XCircle className="w-5 h-5 text-danger" />
            <div>
              <p className="text-lg font-semibold">{data.confirmedDanger}</p>
              <p className="text-xs text-muted-foreground">Said "Help"</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <Clock className="w-5 h-5 text-warning" />
            <div>
              <p className="text-lg font-semibold">{data.timeoutNoResponse}</p>
              <p className="text-xs text-muted-foreground">No Response</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
            <Mic className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-lg font-semibold">{data.cancelled}</p>
              <p className="text-xs text-muted-foreground">Cancelled</p>
            </div>
          </div>
        </div>
      </div>

      {/* Confidence Distribution */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Alert Confidence Distribution
        </h3>
        
        {data.confidenceDistribution.map(({ range, count }) => {
          const percentage = data.totalAlerts > 0 
            ? Math.round((count / data.totalAlerts) * 100) 
            : 0;
          return (
            <div key={range} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>{range}</span>
                <span className="text-muted-foreground">{count} ({percentage}%)</span>
              </div>
              <Progress value={percentage} className="h-2" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
