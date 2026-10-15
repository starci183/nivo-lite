import type { Correction } from "@modules/domain/brain"

/** A stored edited or rejected decision, as the brain's learning source reads it. */
export interface CorrectionRow {
    /** The decision id. */
    readonly id: string
    /** The module whose work was corrected. */
    readonly department: string
    /** What the agent proposed to do. */
    readonly action: string
    /** The correction outcomes selected by the query. */
    readonly outcome: "edited" | "rejected"
    /** The reviewer's note, retained for the regression case. */
    readonly note: string | null
    /** When the decision was written, ISO text. */
    readonly created_at: string
    /** The original proposal, retained for the regression case. */
    readonly before: Correction["before"]
    /** The reviewed proposal, retained for the regression case. */
    readonly after: Correction["after"]
}
