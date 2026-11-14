import type { AgentNodeRightsView } from "@/modules/types"
import type { StepRightRowView, StepRightsView } from "./component"

/** How many rows the card shows before the "N more" row; the API's own row count says how many are folded. */
export const PREVIEW_ROWS = 3

/** The geometry of the roll-up while it loads: three operations with their endpoint, a chip and a step. */
export const STEP_RIGHTS_PLACEHOLDER: StepRightsView = {
    total: 0,
    moreLabel: null,
    rows: ["a", "b", "c"].map(
        (id): StepRightRowView => ({
            id,
            title: "-",
            endpoint: "-",
            chip: "-",
            place: { label: "-", href: null },
        }),
    ),
}

/** The words the roll-up joins to the rows it reads. */
interface StepRightsWords {
    /** the count of folded rows from the number of folded rows. */
    readonly moreOperations: (count: number) => string
    /** "Xem". */
    readonly more: string
}

/**
 * The roll-up as the card draws it: every row the API sent counts, the first few show (all once opened), the rest are the folded
 * the folded rows line row; each chip carries the mode of the node that calls it.
 */
export const stepRightsOf = (answer: AgentNodeRightsView, isOpen: boolean, words: StepRightsWords): StepRightsView => {
    const shown = isOpen ? answer.rows : answer.rows.slice(0, PREVIEW_ROWS)
    const folded = answer.rows.length - shown.length
    return {
        total: answer.rows.length,
        moreLabel: folded > 0 ? `${words.moreOperations(folded)} · ${words.more}` : null,
        rows: shown.map(
            (row): StepRightRowView => ({
                id: row.id,
                title: row.operation.title ?? row.operation.id,
                endpoint: row.operation.endpoint ?? (row.operation.title === null ? null : row.operation.id),
                chip: row.operation.chip,
                place: { label: row.place.line, href: row.place.href },
            }),
        ),
    }
}
