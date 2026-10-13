import { Query } from "@nestjs/cqrs"
import type { PublicInterviewOutput, PublicInterviewParams } from "@modules/domain/hiring"
import type { PublicExecuteParams } from "@modules/platform/cqrs"

/** Asks for read an interview from the candidate's link. */
export class PublicHiringInterviewQuery extends Query<PublicInterviewOutput> {
    constructor(readonly params: PublicExecuteParams<PublicInterviewParams>) {
        super()
    }
}
