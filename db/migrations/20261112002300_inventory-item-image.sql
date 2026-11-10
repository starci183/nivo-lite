-- inventory-item-image: forward-only; immutable once on origin/main.
-- The photo of a catalogue item: where its file lives in the media bucket and its content type. Additive and nullable: an item without a photo keeps both empty, and inventory_save_item leaves them as they are.

ALTER TABLE public.inventory_items ADD COLUMN image_path text;
ALTER TABLE public.inventory_items ADD COLUMN image_type text;
ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_image_check
    CHECK ((image_path IS NULL) = (image_type IS NULL) AND (image_type IS NULL OR image_type IN ('image/jpeg', 'image/png', 'image/webp')));
