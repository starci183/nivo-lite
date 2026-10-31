import type { DossierRecord } from "@modules/domain/brain-dossiers"
import type { BrainDossiersRequest } from "../../application/brain-dossiers.contracts"
import type { BrainDossierType } from "./dto/brain-dossier.type"

/** Maps the workspace of the call to the request. */
export const toBrainDossiersRequest = (workspaceId: string): BrainDossiersRequest => ({ workspaceId })

/** Maps the answer to the GraphQL types. */
export const toBrainDossierTypes = (result: ReadonlyArray<DossierRecord>): Array<BrainDossierType> =>
    result.map((dossier) => ({ ...dossier }))
