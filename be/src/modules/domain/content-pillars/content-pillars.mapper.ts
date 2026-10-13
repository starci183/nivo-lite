import type { ContentPillar, ContentPillarDraft } from "./content-pillars.contracts"
import type { ContentPillarRow } from "./persistence/content-pillars.rows"

/** Maps a stored theme. */
export const toContentPillar = (row: ContentPillarRow): ContentPillar => ({
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    description: row.description,
    weight: row.weight,
    sort: row.sort,
    active: row.active,
})

/** Selects the bounded editable fields and normalizes an omitted GraphQL id. */
const selectContentPillarDrafts = (rows: ReadonlyArray<ContentPillarDraft>): Array<ContentPillarDraft> =>
    rows.map((row) => ({
        ...(typeof row.id === "string" ? { id: row.id } : {}),
        name: row.name,
        description: row.description,
        weight: row.weight,
        active: row.active,
    }))

/** Pure selection of editable themes with nullable GraphQL ids normalized for the domain. */
export class ContentPillarDraftSelectionMapper {
    /** The bounded editable themes. */
    readonly rows: Array<ContentPillarDraft>

    constructor(rows: ReadonlyArray<ContentPillarDraft>) {
        this.rows = selectContentPillarDrafts(rows)
    }
}
