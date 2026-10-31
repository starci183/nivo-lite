import type { Type } from "@nestjs/common"
import type { DossierReasoner, RemedyWriter } from "./dossier-review.port"

/** The two services that call the model; the app names them, the capability never imports them. */
export interface DossierReviewFullOptions {
    /** Reads a dossier critically. */
    readonly reasoner: Type<DossierReasoner>
    /** Writes the draft of a remedy. */
    readonly writer: Type<RemedyWriter>
    /** Absent or false: the full capability. */
    readonly readOnly?: false
}

/**
 * The read-only mode (the mcp app): the findings and the summary of the review as an agent reads them, with no runs, no remedy
 * drafts and no model: the reasoner and the writer are not needed.
 */
export interface DossierReviewReadOnlyOptions {
    /** Registers the read-only mode. */
    readonly readOnly: true
    /** Not needed in this mode. */
    readonly reasoner?: undefined
    /** Not needed in this mode. */
    readonly writer?: undefined
}

/** What the dossier-review capability needs from the composition root. */
export type DossierReviewOptions = DossierReviewFullOptions | DossierReviewReadOnlyOptions
