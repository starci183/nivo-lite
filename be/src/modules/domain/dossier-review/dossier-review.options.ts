import type { Type } from "@nestjs/common"
import type { DossierReasoner, RemedyWriter } from "./dossier-review.port"

/** The two services that call the model; the app names them, the capability never imports them. */
export interface DossierReviewOptions {
    /** Reads a dossier critically. */
    readonly reasoner: Type<DossierReasoner>
    /** Writes the draft of a remedy. */
    readonly writer: Type<RemedyWriter>
}
