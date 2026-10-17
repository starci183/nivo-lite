import type { HiringLinkRequest } from "./hiring-link.contracts"
import { Query } from "@nestjs/cqrs"
import type { PublicInterviewOutput, HiringInterviewsService } from "@modules/domain/hiring"
import type { PublicExecuteParams } from "@modules/platform/cqrs"

type PublicInterviewParams = Parameters<HiringInterviewsService["publicView"]>[0]

/** Asks for read an interview from the candidate's link. */
export class PublicHiringInterviewQuery extends Query<PublicInterviewOutput> {
    constructor(readonly params: PublicExecuteParams<HiringLinkRequest<PublicInterviewParams>>) {
        super()
    }
}
