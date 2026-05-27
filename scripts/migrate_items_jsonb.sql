-- migrate items column from text to jsonb
-- run this in Supabase SQL Editor

ALTER TABLE order_entries
  ALTER COLUMN items TYPE jsonb
  USING CASE
    WHEN items IS NULL OR items = '' THEN NULL
    WHEN items LIKE '[%' THEN items::jsonb  -- already JSON array string
    ELSE to_jsonb(string_to_array(items, E'\n'))  -- old plain text → array
  END;
