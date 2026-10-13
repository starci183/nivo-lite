import { sql } from "@modules/platform/database"

/** Publishes one item of the base knowledge of NIVO; an unchanged text keeps its version and vector ($1 module, $2 slug, $3 title, $4 body, $5 kind). */
export const UPSERT_NIVO_ITEM = sql`INSERT INTO public.nivo_knowledge (module, slug, title, body, kind)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (slug) DO UPDATE SET
    module = excluded.module, title = excluded.title, body = excluded.body, kind = excluded.kind,
    version = CASE WHEN nivo_knowledge.body = excluded.body AND nivo_knowledge.title = excluded.title THEN nivo_knowledge.version ELSE nivo_knowledge.version + 1 END,
    embedding = CASE WHEN nivo_knowledge.body = excluded.body AND nivo_knowledge.title = excluded.title THEN nivo_knowledge.embedding ELSE NULL END,
    embedding_model = CASE WHEN nivo_knowledge.body = excluded.body AND nivo_knowledge.title = excluded.title THEN nivo_knowledge.embedding_model ELSE NULL END,
    updated_at = now()
RETURNING (xmax = 0) AS inserted`

/** Removes the items whose slug is not in the list, so the table mirrors the folder ($1 slugs kept). */
export const DELETE_STALE_NIVO_ITEMS = sql`WITH changed AS (
    DELETE FROM public.nivo_knowledge WHERE slug <> ALL($1::text[]) RETURNING id
)
SELECT id FROM changed`

/** Items of the base knowledge without a vector of the model in use ($1 model, $2 batch). */
export const SELECT_NIVO_UNEMBEDDED = sql`SELECT id, title, body FROM public.nivo_knowledge
WHERE embedding IS NULL OR embedding_model IS NULL OR embedding_model <> $1 ORDER BY module, slug LIMIT $2`

/** Gives items of the base knowledge their vector ($1 ids, $2 vectors as pgvector text, $3 model). */
export const UPDATE_NIVO_VECTORS = sql`UPDATE public.nivo_knowledge k SET embedding = t.embedding::extensions.vector, embedding_model = $3
FROM unnest($1::uuid[], $2::text[]) AS t(id, embedding) WHERE k.id = t.id`

/** How many items of the base knowledge belong to the given modules ($1 modules, including `core`). */
export const COUNT_NIVO_FOR_MODULES = sql`SELECT count(*)::int AS count FROM public.nivo_knowledge WHERE module = ANY($1::text[])`

/** The base knowledge of NIVO for the Knowledge page, ordered by module, kind and slug. */
export const LIST_NIVO_ITEMS = sql`SELECT id, module, slug, title, body, kind, version, updated_at FROM public.nivo_knowledge
ORDER BY module, kind, slug LIMIT 500`
