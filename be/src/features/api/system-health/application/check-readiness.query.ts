import { Query } from "@nestjs/cqrs"
import type { ReadinessReport } from "@modules/domain/readiness"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { CheckReadinessRequest } from "./check-readiness.contracts"

/** Asks whether this instance can receive work requiring its primary database. */
export class CheckReadinessQuery extends Query<ReadinessReport> {
    constructor(readonly params: PublicExecuteParams<CheckReadinessRequest>) {
        super()
    }
}
