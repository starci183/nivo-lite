import type { RequestInterviewOutput, SaveAvailabilityOutput } from "@modules/domain/hiring"
import type { RequestHiringInterviewRequest } from "../../application/request-hiring-interview.contracts"
import type { SaveHiringAvailabilityRequest } from "../../application/save-hiring-availability.contracts"
import type { SetHiringInterviewStatusRequest } from "../../application/set-hiring-interview-status.contracts"
import type { HiringOutcomeType } from "./dto/hiring-outcome.type"
import type { RequestHiringInterviewInput } from "./dto/request-hiring-interview.input"
import type { SaveAvailabilityType } from "./dto/save-availability.type"
import type { SaveHiringAvailabilityInput } from "./dto/save-hiring-availability.input"
import type { SetHiringInterviewStatusInput } from "./dto/set-hiring-interview-status.input"

/** Maps the GraphQL input to the interview request of the workspace it names. */
export const toRequestHiringInterviewRequest = (
    workspaceId: string,
    input: RequestHiringInterviewInput,
): RequestHiringInterviewRequest => ({
    workspaceId,
    candidateId: input.candidateId,
    ...(input.interviewerUserId === undefined || input.interviewerUserId === null
        ? {}
        : { interviewerUserId: input.interviewerUserId }),
    mode: input.mode,
    location: input.location,
    durationMin: input.durationMin,
})

/** Maps the GraphQL input to the interview status request of the workspace it names. */
export const toSetHiringInterviewStatusRequest = (
    workspaceId: string,
    input: SetHiringInterviewStatusInput,
): SetHiringInterviewStatusRequest => ({ workspaceId, ...input })

/** Maps the GraphQL input to the availability save request of the workspace it names. */
export const toSaveHiringAvailabilityRequest = (
    workspaceId: string,
    input: SaveHiringAvailabilityInput,
): SaveHiringAvailabilityRequest => ({ workspaceId, ...input })

/** Maps the outcome answer to the GraphQL type. */
export const toHiringOutcomeType = (result: RequestInterviewOutput): HiringOutcomeType => ({
    status: result.status,
    summary: result.summary,
    error: result.error,
})

/** Maps the availability answer to the GraphQL type. */
export const toSaveAvailabilityType = (result: SaveAvailabilityOutput): SaveAvailabilityType => ({
    saved: result.saved,
})
