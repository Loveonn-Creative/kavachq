-- Table for location-based false alarm memory
CREATE TABLE public.location_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  cell_id TEXT NOT NULL,
  false_alarm_count INTEGER DEFAULT 0,
  true_alarm_count INTEGER DEFAULT 0,
  sensor_signature JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(device_id, cell_id)
);

-- Enable RLS
ALTER TABLE public.location_memories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for location_memories
CREATE POLICY "Devices can read own location memories"
ON public.location_memories
FOR SELECT
USING (true);

CREATE POLICY "Devices can insert location memories"
ON public.location_memories
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Devices can update own location memories"
ON public.location_memories
FOR UPDATE
USING (true);

-- Table for alert confirmations and learning data
CREATE TABLE public.alert_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  ride_session_id UUID REFERENCES public.ride_sessions(id),
  location_cell TEXT,
  event_type TEXT NOT NULL,
  sensor_data JSONB,
  initial_confidence INTEGER,
  confirmation TEXT, -- 'ok', 'danger', 'timeout', 'cancelled'
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.alert_confirmations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for alert_confirmations
CREATE POLICY "Devices can read own alert confirmations"
ON public.alert_confirmations
FOR SELECT
USING (true);

CREATE POLICY "Devices can insert alert confirmations"
ON public.alert_confirmations
FOR INSERT
WITH CHECK (true);

-- Create updated_at trigger for location_memories
CREATE TRIGGER update_location_memories_updated_at
BEFORE UPDATE ON public.location_memories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();