import type {
    DeleteCandidateOutput,
    LinkStaffOutput,
    MoveCandidateOutput,
    RescreenOutput,
} from "@modules/domain/hiring"
import type { DeleteHiringCandidateRequest } from "../../application/delete-hiring-candidate.contracts"
import type { LinkHiringStaffRequest } from "../../application/link-hiring-staff.contracts"
import type { RescreenHiringCandidateRequest } from "../../application/rescreen-hiring-candidate.contracts"
import type { SaveHiringNotesRequest } from "../../application/save-hiring-notes.contracts"
import type { ToggleHiringOnboardingRequest } from "../../application/toggle-hiring-onboarding.contracts"
import type { DeleteCandidateType } from "./dto/delete-candidate.type"
import type { HiringCandidateRefInput } from "./dto/hiring-candidate-ref.input"
import type { HiringOutcomeType } from "./dto/hiring-outcome.type"
import type { LinkStaffType } from "./dto/link-staff.type"
import type { MoveCandidateType } from "./dto/move-candidate.type"
import type { SaveHiringNotesInput } from "./dto/save-hiring-notes.input"
import type { ToggleHiringOnboardingInput } from "./dto/toggle-hiring-onboarding.input"

/** Maps the GraphQL input to the stage move request of the workspace it names. */
export { toMoveHiringCandidateRequest } from "@modules/domain/hiring"

/** Maps the GraphQL input to the notes save request of the workspace it names. */
export const toSaveHiringNotesRequest = (workspaceId: string, input: SaveHiringNotesInput): SaveHiringNotesRequest => ({
    workspaceId,
    ...input,
})

/** Maps the GraphQL input to the delete request of the workspace it names. */
export const toDeleteHiringCandidateRequest = (
    workspaceId: string,
    input: HiringCandidateRefInput,
): DeleteHiringCandidateRequest => ({ workspaceId, id: input.id })

/** Maps the GraphQL input to the rescreen request of the workspace it names. */
export const toRescreenHiringCandidateRequest = (
    workspaceId: string,
    input: HiringCandidateRefInput,
): RescreenHiringCandidateRequest => ({ workspaceId, id: input.id })

/** Maps the GraphQL input to the staff link request of the workspace it names. */
export const toLinkHiringStaffRequest = (
    workspaceId: string,
    input: HiringCandidateRefInput,
): LinkHiringStaffRequest => ({ workspaceId, candidateId: input.id })

/** Maps the GraphQL input to the onboarding toggle request of the workspace it names. */
export const toToggleHiringOnboardingRequest = (
    workspaceId: string,
    input: ToggleHiringOnboardingInput,
): ToggleHiringOnboardingRequest => ({ workspaceId, ...input })

/** Maps the outcome answer to the GraphQL type. */
export const toHiringOutcomeType = (result: RescreenOutput): HiringOutcomeType => ({
    status: result.status,
    summary: result.summary,
    error: result.error,
})

/** Maps the stage answer to the GraphQL type. */
export const toMoveCandidateType = (result: MoveCandidateOutput): MoveCandidateType => ({ stage: result.stage })

/** Maps the delete answer to the GraphQL type. */
export const toDeleteCandidateType = (result: DeleteCandidateOutput): DeleteCandidateType => ({ files: result.files })

/** Maps the staff link answer to the GraphQL type. */
export const toLinkStaffType = (result: LinkStaffOutput): LinkStaffType => ({ staffId: result.staffId })
