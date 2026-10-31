import type { DossierDocumentCount } from "@modules/domain/knowledge-sources"
import type { DossierRecord } from "./brain-dossiers.contracts"
import type { BrainDossierEntity } from "./persistence/entities"

const keyOf = (category: string, ref: string): string => `${category.normalize("NFC")}\u0000${ref}`

/** How many documents name a dossier: looks up a category and a reference among the counts a read answered; none counted is zero. */
export const documentCountsOf = (
    counts: ReadonlyArray<DossierDocumentCount>,
): ((category: string, ref: string) => number) => {
    const byKey = new Map(counts.map((count) => [keyOf(count.topic, count.ref), count.documentCount]))
    return (category, ref) => byKey.get(keyOf(category, ref)) ?? 0
}

/** A dossier as the callers read it, from the stored row and the number of documents that name it. */
export const toDossierRecord = (row: BrainDossierEntity, documentCount: number): DossierRecord => ({
    id: row.id,
    ref: row.ref,
    category: row.category,
    categoryOrder: row.categoryOrder,
    position: row.position,
    name: row.name,
    status: row.status,
    existing: row.existing,
    missing: row.missing,
    drafts: row.drafts,
    documentCount,
})
