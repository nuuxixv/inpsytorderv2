-- Add structured fields to events table
ALTER TABLE public.events
ADD COLUMN event_year integer,
ADD COLUMN host_society text,
ADD COLUMN event_season text,
ADD COLUMN status text DEFAULT 'active';

-- Optional: Comments for table columns
COMMENT ON COLUMN public.events.event_year IS 'Year of the event (e.g. 2026)';
COMMENT ON COLUMN public.events.host_society IS 'Host society name (e.g. 대한치매학회)';
COMMENT ON COLUMN public.events.event_season IS 'Season or type (e.g. 춘계학술대회)';
COMMENT ON COLUMN public.events.status IS 'Status of the event: active, closed, upcoming';
