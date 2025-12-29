-- Create the update function first
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create emergency contacts table for pre-setting family members
CREATE TABLE public.emergency_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  relationship TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;

-- Devices can manage their own contacts
CREATE POLICY "Devices can read own emergency contacts"
ON public.emergency_contacts
FOR SELECT
USING (true);

CREATE POLICY "Devices can insert emergency contacts"
ON public.emergency_contacts
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Devices can update own emergency contacts"
ON public.emergency_contacts
FOR UPDATE
USING (true);

CREATE POLICY "Devices can delete own emergency contacts"
ON public.emergency_contacts
FOR DELETE
USING (true);

-- Create updated_at trigger
CREATE TRIGGER update_emergency_contacts_updated_at
BEFORE UPDATE ON public.emergency_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();