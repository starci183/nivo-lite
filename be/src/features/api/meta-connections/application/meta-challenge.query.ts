import { Query } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { MetaChallengeRequest, MetaChallengeResult } from "./meta-challenge.contracts"

/** Answers the webhook verification request of Meta. */
export class MetaChallengeQuery extends Query<MetaChallengeResult> {
    constructor(readonly params: PublicExecuteParams<MetaChallengeRequest>) {
        super()
    }
}
