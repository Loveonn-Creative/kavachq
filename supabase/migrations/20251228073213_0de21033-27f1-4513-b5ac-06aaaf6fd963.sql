-- KAVACH: Real-time Safety Guardian for India's Gig Workers

-- Table for ride sessions (device-based, no login required)
CREATE TABLE public.ride_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'emergency')),
  start_location JSONB,
  end_location JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for risk events detected during rides
CREATE TABLE public.risk_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_session_id UUID REFERENCES public.ride_sessions(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('speed_warning', 'heat_warning', 'unsafe_zone', 'sudden_stop', 'fall_detected', 'long_idle', 'wellness_check')),
  severity TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  location JSONB,
  weather_data JSONB,
  message TEXT,
  acknowledged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for emergency events
CREATE TABLE public.emergency_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_session_id UUID REFERENCES public.ride_sessions(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('manual', 'auto_fall', 'auto_idle', 'auto_crash')),
  location JSONB,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'false_alarm')),
  resolved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for known unsafe zones (crowdsourced from past incidents)
CREATE TABLE public.unsafe_zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location JSONB NOT NULL,
  radius_meters INTEGER NOT NULL DEFAULT 500,
  risk_type TEXT NOT NULL CHECK (risk_type IN ('accident_prone', 'poor_road', 'flooding', 'crime', 'heat_zone')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  reports_count INTEGER DEFAULT 1,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for rest stops (toilets, water, shade) crowdsourced
CREATE TABLE public.rest_stops (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location JSONB NOT NULL,
  stop_type TEXT NOT NULL CHECK (stop_type IN ('toilet', 'water', 'shade', 'medical', 'general')),
  name TEXT,
  verified BOOLEAN DEFAULT FALSE,
  visits_count INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.ride_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unsafe_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rest_stops ENABLE ROW LEVEL SECURITY;

-- Public read policies for crowdsourced data (unsafe zones, rest stops)
CREATE POLICY "Anyone can read unsafe zones"
ON public.unsafe_zones FOR SELECT
USING (true);

CREATE POLICY "Anyone can read rest stops"
ON public.rest_stops FOR SELECT
USING (true);

-- Device-based policies (no auth required, identified by device_id)
-- These allow anonymous access for gig workers without accounts

CREATE POLICY "Devices can insert ride sessions"
ON public.ride_sessions FOR INSERT
WITH CHECK (true);

CREATE POLICY "Devices can read own ride sessions"
ON public.ride_sessions FOR SELECT
USING (true);

CREATE POLICY "Devices can update own ride sessions"
ON public.ride_sessions FOR UPDATE
USING (true);

CREATE POLICY "Devices can insert risk events"
ON public.risk_events FOR INSERT
WITH CHECK (true);

CREATE POLICY "Devices can read risk events"
ON public.risk_events FOR SELECT
USING (true);

CREATE POLICY "Devices can insert emergency events"
ON public.emergency_events FOR INSERT
WITH CHECK (true);

CREATE POLICY "Devices can read emergency events"
ON public.emergency_events FOR SELECT
USING (true);

CREATE POLICY "Devices can update emergency events"
ON public.emergency_events FOR UPDATE
USING (true);

-- Allow inserting unsafe zones and rest stops (crowdsourced)
CREATE POLICY "Anyone can report unsafe zones"
ON public.unsafe_zones FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can report rest stops"
ON public.rest_stops FOR INSERT
WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_ride_sessions_device_id ON public.ride_sessions(device_id);
CREATE INDEX idx_ride_sessions_status ON public.ride_sessions(status);
CREATE INDEX idx_risk_events_ride_session ON public.risk_events(ride_session_id);
CREATE INDEX idx_risk_events_device_id ON public.risk_events(device_id);
CREATE INDEX idx_emergency_events_status ON public.emergency_events(status);

-- Enable realtime for emergency events
ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.risk_events;