import type { RequestOfferOutput } from "@modules/domain/hiring"
import type { CancelHiringOfferRequest } from "../../application/cancel-hiring-offer.contracts"
import type { RequestHiringOfferRequest } from "../../application/request-hiring-offer.contracts"
import type { HiringOfferRefInput } from "./dto/hiring-offer-ref.input"
import type { HiringOutcomeType } from "./dto/hiring-outcome.type"
import type { RequestHiringOfferInput } from "./dto/request-hiring-offer.input"

/** Maps the GraphQL input to the offer request of the workspace it names. */
export const toRequestHiringOfferRequest = (
    workspaceId: string,
    input: RequestHiringOfferInput,
): RequestHiringOfferRequest => ({ workspaceId, ...input })

/** Maps the GraphQL input to the offer cancellation request of the workspace it names. */
export const toCancelHiringOfferRequest = (
    workspaceId: string,
    input: HiringOfferRefInput,
): CancelHiringOfferRequest => ({ workspaceId, id: input.id })

/** Maps the outcome answer to the GraphQL type. */
export const toHiringOutcomeType = (result: RequestOfferOutput): HiringOutcomeType => ({
    status: result.status,
    summary: result.summary,
    error: result.error,
})
