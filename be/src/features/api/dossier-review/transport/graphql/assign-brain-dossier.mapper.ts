import type { DossierRecord } from "@modules/domain/brain-dossiers"
import type { AssignBrainDossierRequest } from "../../application/assign-brain-dossier.contracts"
import type { AssignBrainDossierInput } from "./dto/assign-brain-dossier.input"
import type { BrainDossierOwnerType } from "./dto/brain-dossier-owner.type"

/** Maps the GraphQL input to the request. */
export const toAssignBrainDossierRequest = (
    workspaceId: string,
    input: AssignBrainDossierInput,
): AssignBrainDossierRequest => ({
    workspaceId,
    dossierId: input.dossierId,
    assigneeId: input.assigneeId,
    dueAt: input.dueAt,
})

/** The owner and the due date the record now holds. */
export const toAssignBrainDossierType = (result: DossierRecord): BrainDossierOwnerType => ({
    id: result.id,
    assigneeId: result.assigneeId,
    dueAt: result.dueAt,
})
