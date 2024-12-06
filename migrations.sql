CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch WITH SCHEMA public;


ALTER TABLE IF EXISTS public.plate_notifications 
    ADD COLUMN IF NOT EXISTS priority integer DEFAULT 1;

ALTER TABLE IF EXISTS public.plate_reads 
    ADD COLUMN IF NOT EXISTS camera_name character varying(25);

ALTER TABLE known_plates
    ADD COLUMN parent_plate_number VARCHAR(20) REFERENCES known_plates(plate_number);