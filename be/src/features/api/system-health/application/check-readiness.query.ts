import { Query } from "@nestjs/cqrs"
import type { ReadinessReport } from "@modules/domain/liveness"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { CheckReadinessRequest } from "./check-readiness.contracts"

/** Asks whether this process can take traffic with its required dependencies available. */
export class CheckReadinessQuery extends Query<ReadinessReport> {
    constructor(readonly params: PublicExecuteParams<CheckReadinessRequest>) {
        super()
    }
}
