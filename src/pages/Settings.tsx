import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Globe, 
  Bell, 
  Trash2, 
  Download, 
  ExternalLink,
  ChevronRight,
  Smartphone
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { getLocalRideHistory, cleanupOldData } from '@/lib/offlineStorage';

interface AppSettings {
  language: string;
  voiceAlerts: boolean;
  vibrationAlerts: boolean;
  autoEmergency: boolean;
  locationSharing: boolean;
}

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'हिंदी (Hindi)' },
  { code: 'ta', name: 'தமிழ் (Tamil)' },
  { code: 'te', name: 'తెలుగు (Telugu)' },
  { code: 'kn', name: 'ಕನ್ನಡ (Kannada)' },
  { code: 'mr', name: 'मराठी (Marathi)' },
  { code: 'bn', name: 'বাংলা (Bengali)' },
  { code: 'gu', name: 'ગુજરાતી (Gujarati)' },
];

const DELIVERY_APPS = [
  { 
    name: 'Zomato', 
    icon: '🍽️',
    color: 'bg-red-500/10 border-red-500/20',
    url: 'https://www.zomato.com/delivery-partner'
  },
  { 
    name: 'Swiggy', 
    icon: '🛵',
    color: 'bg-orange-500/10 border-orange-500/20',
    url: 'https://partner.swiggy.com'
  },
  { 
    name: 'Blinkit', 
    icon: '⚡',
    color: 'bg-yellow-500/10 border-yellow-500/20',
    url: 'https://blinkit.com/rider'
  },
  { 
    name: 'Zepto', 
    icon: '🚀',
    color: 'bg-purple-500/10 border-purple-500/20',
    url: 'https://www.zeptonow.com/rider'
  },
];

const SETTINGS_KEY = 'kavach_settings';

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings>({
    language: 'en',
    voiceAlerts: true,
    vibrationAlerts: true,
    autoEmergency: true,
    locationSharing: true,
  });
  const [rideCount, setRideCount] = useState(0);

  useEffect(() => {
    // Load saved settings
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      setSettings(JSON.parse(saved));
    } else {
      // Detect browser language
      const browserLang = navigator.language.split('-')[0];
      const supported = LANGUAGES.find(l => l.code === browserLang);
      if (supported) {
        setSettings(prev => ({ ...prev, language: supported.code }));
      }
    }
    
    // Get ride count
    const rides = getLocalRideHistory();
    setRideCount(rides.length);
  }, []);

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
    toast.success('Setting updated');
  };

  const handleClearData = () => {
    localStorage.removeItem('kavach_ride_sessions');
    localStorage.removeItem('kavach_risk_events');
    localStorage.removeItem('kavach_emergency_events');
    cleanupOldData();
    setRideCount(0);
    toast.success('All local data cleared');
  };

  const handleExportData = () => {
    const rides = getLocalRideHistory();
    const dataStr = JSON.stringify(rides, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kavach-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Data exported');
  };

  const openDeliveryApp = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

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
          <h1 className="text-lg font-semibold">Settings</h1>
        </div>
      </header>

      <main className="p-4 space-y-6 pb-8">
        {/* Language */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
            <Globe className="w-4 h-4" />
            <span>Language</span>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <Select 
              value={settings.language} 
              onValueChange={(v) => updateSetting('language', v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map(lang => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        {/* Notifications */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
            <Bell className="w-4 h-4" />
            <span>Alerts & Notifications</span>
          </div>
          <div className="bg-card border border-border rounded-xl divide-y divide-border">
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">Voice Alerts</p>
                <p className="text-sm text-muted-foreground">Speak warnings aloud</p>
              </div>
              <Switch 
                checked={settings.voiceAlerts}
                onCheckedChange={(v) => updateSetting('voiceAlerts', v)}
              />
            </div>
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">Vibration</p>
                <p className="text-sm text-muted-foreground">Vibrate on alerts</p>
              </div>
              <Switch 
                checked={settings.vibrationAlerts}
                onCheckedChange={(v) => updateSetting('vibrationAlerts', v)}
              />
            </div>
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">Auto Emergency</p>
                <p className="text-sm text-muted-foreground">Detect falls & crashes</p>
              </div>
              <Switch 
                checked={settings.autoEmergency}
                onCheckedChange={(v) => updateSetting('autoEmergency', v)}
              />
            </div>
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">Location Sharing</p>
                <p className="text-sm text-muted-foreground">Share location in emergency</p>
              </div>
              <Switch 
                checked={settings.locationSharing}
                onCheckedChange={(v) => updateSetting('locationSharing', v)}
              />
            </div>
          </div>
        </section>

        {/* Delivery Partner Apps */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
            <Smartphone className="w-4 h-4" />
            <span>Delivery Partner Apps</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {DELIVERY_APPS.map(app => (
              <button
                key={app.name}
                onClick={() => openDeliveryApp(app.url)}
                className={`flex items-center gap-3 p-4 rounded-xl border ${app.color} hover:opacity-80 transition-opacity text-left`}
              >
                <span className="text-2xl">{app.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{app.name}</p>
                  <p className="text-xs text-muted-foreground">Partner Portal</p>
                </div>
                <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </button>
            ))}
          </div>
        </section>

        {/* Data Management */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
            <Download className="w-4 h-4" />
            <span>Data Management</span>
          </div>
          <div className="bg-card border border-border rounded-xl divide-y divide-border">
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">Local Rides</p>
                <p className="text-sm text-muted-foreground">{rideCount} rides stored</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleExportData}>
                Export
              </Button>
            </div>
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium text-destructive">Clear All Data</p>
                <p className="text-sm text-muted-foreground">Remove all local data</p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear all data?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all your ride history and events from this device. 
                      Data already synced to cloud will not be affected.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearData}>
                      Clear Data
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </section>

        {/* App Info */}
        <section className="text-center text-sm text-muted-foreground pt-4">
          <p>Kavach v1.0</p>
          <p className="mt-1">Your invisible guardian</p>
        </section>
      </main>
    </div>
  );
}
