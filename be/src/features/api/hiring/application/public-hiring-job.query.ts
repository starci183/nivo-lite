import { Query } from "@nestjs/cqrs"
import type { PublicJobOutput, PublicJobParams } from "@modules/domain/hiring"
import type { PublicExecuteParams } from "@modules/platform/cqrs"

/** Asks for read a published job for the apply page. */
export class PublicHiringJobQuery extends Query<PublicJobOutput> {
    constructor(readonly params: PublicExecuteParams<PublicJobParams>) {
        super()
    }
}
