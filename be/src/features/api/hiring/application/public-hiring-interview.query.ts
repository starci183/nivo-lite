import { Query } from "@nestjs/cqrs"
import type { PublicInterviewOutput } from "@modules/domain/hiring"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { PublicHiringInterviewRequest } from "./public-hiring-interview.contracts"

/** Asks for read an interview from the candidate's link. */
export class PublicHiringInterviewQuery extends Query<PublicInterviewOutput> {
    constructor(readonly params: PublicExecuteParams<PublicHiringInterviewRequest>) {
        super()
    }
}
