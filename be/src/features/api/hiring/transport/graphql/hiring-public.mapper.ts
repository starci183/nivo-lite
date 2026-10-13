import type {
    ApplyOutput,
    CreateCvUploadOutput,
    PublicInterviewOutput,
    PublicJobOutput,
    PublicOfferOutput,
    RespondOfferOutput,
    RespondSlotOutput,
} from "@modules/domain/hiring"
import type { ApplyToHiringJobRequest } from "../../application/apply-to-hiring-job.contracts"
import type { CreateHiringCvUploadRequest } from "../../application/create-hiring-cv-upload.contracts"
import type { PublicHiringInterviewRequest } from "../../application/public-hiring-interview.contracts"
import type { PublicHiringJobRequest } from "../../application/public-hiring-job.contracts"
import type { PublicHiringOfferRequest } from "../../application/public-hiring-offer.contracts"
import type { RespondHiringInterviewRequest } from "../../application/respond-hiring-interview.contracts"
import type { RespondHiringOfferRequest } from "../../application/respond-hiring-offer.contracts"
import type { ApplyResultType } from "./dto/apply-result.type"
import type { ApplyToHiringJobInput } from "./dto/apply-to-hiring-job.input"
import type { CreateCvUploadType } from "./dto/create-cv-upload.type"
import type { CreateHiringCvUploadInput } from "./dto/create-hiring-cv-upload.input"
import type { HiringTokenInput } from "./dto/hiring-token.input"
import type { PublicHiringJobInput } from "./dto/public-hiring-job.input"
import type { PublicInterviewType } from "./dto/public-interview.type"
import type { PublicJobType } from "./dto/public-job.type"
import type { PublicOfferType } from "./dto/public-offer.type"
import type { RespondHiringInterviewInput } from "./dto/respond-hiring-interview.input"
import type { RespondHiringOfferInput } from "./dto/respond-hiring-offer.input"
import type { RespondOfferType } from "./dto/respond-offer.type"
import type { RespondSlotType } from "./dto/respond-slot.type"

/** Maps the GraphQL input to the public job request. */
export const toPublicHiringJobRequest = (input: PublicHiringJobInput): PublicHiringJobRequest => ({
    ws: input.ws,
    job: input.job,
})

/** Maps the GraphQL input to the CV upload request. */
export const toCreateHiringCvUploadRequest = (input: CreateHiringCvUploadInput): CreateHiringCvUploadRequest => ({
    ws: input.ws,
    job: input.job,
    fileName: input.fileName,
})

/** Maps the GraphQL input to the application request. */
export const toApplyToHiringJobRequest = (input: ApplyToHiringJobInput): ApplyToHiringJobRequest => ({
    ws: input.ws,
    job: input.job,
    name: input.name,
    phone: input.phone,
    email: input.email,
    availability: input.availability,
    consent: input.consent,
    answers: input.answers,
    ...(input.cvPath === undefined || input.cvPath === null ? {} : { cvPath: input.cvPath }),
    ...(input.cvName === undefined || input.cvName === null ? {} : { cvName: input.cvName }),
    ...(input.website === undefined || input.website === null ? {} : { website: input.website }),
})

/** Maps the GraphQL input to the public interview request. */
export const toPublicHiringInterviewRequest = (input: HiringTokenInput): PublicHiringInterviewRequest => ({
    token: input.token,
})

/** Maps the GraphQL input to the interview response request. */
export const toRespondHiringInterviewRequest = (input: RespondHiringInterviewInput): RespondHiringInterviewRequest => ({
    token: input.token,
    ...(input.start === undefined || input.start === null ? {} : { start: input.start }),
})

/** Maps the GraphQL input to the public offer request. */
export const toPublicHiringOfferRequest = (input: HiringTokenInput): PublicHiringOfferRequest => ({
    token: input.token,
})

/** Maps the GraphQL input to the offer response request. */
export const toRespondHiringOfferRequest = (input: RespondHiringOfferInput): RespondHiringOfferRequest => ({
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
