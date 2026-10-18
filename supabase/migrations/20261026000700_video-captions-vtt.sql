-- Add the renderer's WebVTT sidecar without changing other videos bucket restrictions.
UPDATE storage.buckets
SET allowed_mime_types = array_append(allowed_mime_types, 'text/vtt')
WHERE id = 'videos'
  AND allowed_mime_types IS NOT NULL
  AND NOT ('text/vtt' = ANY (allowed_mime_types));
