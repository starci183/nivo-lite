import type { HiringCandidateDetailView } from "@modules/domain/hiring"
import type { HiringCandidateDetailRequest } from "../../application/hiring-candidate-detail.contracts"
import type { HiringWorkbenchRequest } from "../../application/hiring-workbench.contracts"
import type { HiringCandidateDetailType } from "./dto/hiring-candidate-detail.type"
import type { HiringCandidateRefInput } from "./dto/hiring-candidate-ref.input"

/** Maps the workspace scope to the workbench request. */
export const toHiringWorkbenchRequest = (workspaceId: string): HiringWorkbenchRequest => ({ workspaceId })

/** Maps the GraphQL input to the candidate detail request of the workspace it names. */
export const toHiringCandidateDetailRequest = (
    workspaceId: string,
    input: HiringCandidateRefInput,
): HiringCandidateDetailRequest => ({ workspaceId, candidateId: input.id })

/** Maps the workbench view to the GraphQL type; question expectations become three typed fields. */
export { toHiringBenchType } from "@modules/domain/hiring"

/** Maps the candidate detail view to the GraphQL type. */
export const toHiringCandidateDetailType = (result: HiringCandidateDetailView): HiringCandidateDetailType => result
