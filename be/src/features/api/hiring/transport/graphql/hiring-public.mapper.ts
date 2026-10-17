import type {
    ApplyOutput,
    HiringPublicService,
    PublicInterviewOutput,
    PublicJobOutput,
    PublicJobParams,
    PublicOfferOutput,
    RespondOfferOutput,
    HiringOffersService,
    HiringInterviewsService,
} from "@modules/domain/hiring"
import type { ApplyResultType } from "./dto/apply-result.type"
import type { CreateCvUploadType } from "./dto/create-cv-upload.type"
import type { CreateHiringCvUploadInput } from "./dto/create-hiring-cv-upload.input"
import type { HiringTokenInput } from "./dto/hiring-token.input"
import type { PublicHiringJobInput } from "./dto/public-hiring-job.input"
import type { PublicInterviewType } from "./dto/public-interview.type"
import type { PublicJobType } from "./dto/public-job.type"
import type { PublicOfferType } from "./dto/public-offer.type"
import type { RespondHiringOfferInput } from "./dto/respond-hiring-offer.input"
import type { RespondOfferType } from "./dto/respond-offer.type"
import type { RespondSlotType } from "./dto/respond-slot.type"

type PublicOfferParams = Parameters<HiringOffersService["publicView"]>[0]
type PublicInterviewParams = Parameters<HiringInterviewsService["publicView"]>[0]
type RespondOfferParams = Parameters<HiringOffersService["respond"]>[0]
type CreateCvUploadOutput = Awaited<ReturnType<HiringPublicService["createCvUpload"]>>
type RespondSlotOutput = Awaited<ReturnType<HiringInterviewsService["respond"]>>

/** Maps the GraphQL input to the public job request. */
export const toPublicHiringJobRequest = (input: PublicHiringJobInput): PublicJobParams => ({
    ws: input.ws,
    job: input.job,
})

/** Maps the GraphQL input to the CV upload request. */
export const toCreateHiringCvUploadRequest = (
    input: CreateHiringCvUploadInput,
): Parameters<HiringPublicService["createCvUpload"]>[0] => ({
    ws: input.ws,
    job: input.job,
    fileName: input.fileName,
})

/** Maps the GraphQL input to the application request. */
export { toApplyToHiringJobRequest } from "@modules/domain/hiring"

/** Maps the GraphQL input to the public interview request. */
export const toPublicHiringInterviewRequest = (input: HiringTokenInput): PublicInterviewParams => ({
    token: input.token,
})

/** Maps the GraphQL input to the interview response request. */
export { toRespondHiringInterviewRequest } from "@modules/domain/hiring"

/** Maps the GraphQL input to the public offer request. */
export const toPublicHiringOfferRequest = (input: HiringTokenInput): PublicOfferParams => ({
    token: input.token,
})

/** Maps the GraphQL input to the offer response request. */
export const toRespondHiringOfferRequest = (input: RespondHiringOfferInput): RespondOfferParams => ({
    token: input.token,
    accept: input.accept,
})

/** Maps the public job to the GraphQL type. */
export const toPublicJobType = (result: PublicJobOutput): PublicJobType => result

/** Maps the upload answer to the GraphQL type. */
export const toCreateCvUploadType = (result: CreateCvUploadOutput): CreateCvUploadType => result

/** Maps the application answer to the GraphQL type. */
export const toApplyResultType = (result: ApplyOutput): ApplyResultType => result

/** Maps the public interview to the GraphQL type. */
export const toPublicInterviewType = (result: PublicInterviewOutput): PublicInterviewType => result

/** Maps the interview response to the GraphQL type. */
export const toRespondSlotType = (result: RespondSlotOutput): RespondSlotType => result

/** Maps the public offer to the GraphQL type. */
export const toPublicOfferType = (result: PublicOfferOutput): PublicOfferType => result

/** Maps the offer response to the GraphQL type. */
export const toRespondOfferType = (result: RespondOfferOutput): RespondOfferType => result
