import type { Passage } from "./knowledge.contracts"
import type { PassageRow } from "./persistence/search.rows"

/** A passage as the services hand it out, from the row the search answers. */
export const toPassage = (row: PassageRow): Passage => ({
    layer: row.layer,
    id: row.id,
    sourceId: row.source_id,
    module: row.module,
    kind: row.kind,
    title: row.title,
    content: row.content,
    score: row.score,
    visibility: row.visibility,
    topic: row.topic,
})
