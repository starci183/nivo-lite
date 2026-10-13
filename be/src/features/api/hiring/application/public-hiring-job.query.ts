import { Query } from "@nestjs/cqrs"
import type { PublicJobOutput } from "@modules/domain/hiring"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { PublicHiringJobRequest } from "./public-hiring-job.contracts"

/** Asks for read a published job for the apply page. */
export class PublicHiringJobQuery extends Query<PublicJobOutput> {
    constructor(readonly params: PublicExecuteParams<PublicHiringJobRequest>) {
        super()
    }
}
