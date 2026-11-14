import type { Type } from "@nestjs/common"
import type { DocumentCriticModel } from "./document-critic.port"

/** What the shop-document critic needs from the composition root: the class that calls the model; the capability never imports it. */
export interface DossierReviewOptions {
    /** Reads one shop document critically. */
    readonly model: Type<DocumentCriticModel>
}
