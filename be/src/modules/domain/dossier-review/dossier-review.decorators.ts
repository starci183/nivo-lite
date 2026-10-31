import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { DossierReasoner, RemedyWriter } from "./dossier-review.port"

/** Token of the model reader of a dossier. */
export const DOSSIER_REASONER: unique symbol = Symbol("domain.dossier-review.reasoner")

/** Injects the model reader. Parameter type: DossierReasoner. */
export const InjectDossierReasoner = (): TypedParameterDecorator<DossierReasoner> =>
    injector<DossierReasoner>(DOSSIER_REASONER)

/** Token of the writer of remedy drafts. */
export const REMEDY_WRITER: unique symbol = Symbol("domain.dossier-review.remedy-writer")

/** Injects the draft writer. Parameter type: RemedyWriter. */
export const InjectRemedyWriter = (): TypedParameterDecorator<RemedyWriter> => injector<RemedyWriter>(REMEDY_WRITER)
