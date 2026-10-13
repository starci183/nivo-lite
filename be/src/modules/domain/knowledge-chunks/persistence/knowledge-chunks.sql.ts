import { sql } from "@modules/platform/database"

/** Removes the passages of a source ($1 source, $2 workspace). */
export const DELETE_CHUNKS = sql`DELETE FROM public.knowledge_chunks WHERE source_id = $1 AND workspace_id = $2`

/** Stores passages ($1 workspace, $2 source, $3 module, $4 visibility, $5 orders, $6 texts, $7 vectors as pgvector text or null, $8 model per passage or null). */
export const INSERT_CHUNKS = sql`INSERT INTO public.knowledge_chunks (workspace_id, source_id, module, visibility, ord, content, embedding, embedding_model)
SELECT $1, $2, $3, $4, t.ord, t.content, t.embedding::extensions.vector, t.model
FROM unnest($5::int[], $6::text[], $7::text[], $8::text[]) AS t(ord, content, embedding, model)`

/** The embedded passages of a source in order, to tell whether they already are the passages of the current text ($1 source, $2 workspace). */
export const SELECT_EMBEDDED_CHUNKS = sql`SELECT ord, content, embedding_model FROM public.knowledge_chunks
WHERE source_id = $1 AND workspace_id = $2 AND embedding IS NOT NULL ORDER BY ord LIMIT 2000`

/** Up to $3 passages of a workspace made by another model than $2, or with no vector ($1 workspace, $2 model, $3 batch). */
export const SELECT_STALE_CHUNKS = sql`SELECT id, content FROM public.knowledge_chunks
WHERE workspace_id = $1 AND (embedding IS NULL OR embedding_model IS NULL OR embedding_model <> $2)
ORDER BY created_at LIMIT $3`

/** Gives passages their vector and model ($1 workspace, $2 ids, $3 vectors as pgvector text, $4 model). */
export const UPDATE_CHUNK_VECTORS = sql`UPDATE public.knowledge_chunks c SET embedding = t.embedding::extensions.vector, embedding_model = $4
FROM unnest($2::uuid[], $3::text[]) AS t(id, embedding)
WHERE c.id = t.id AND c.workspace_id = $1`
