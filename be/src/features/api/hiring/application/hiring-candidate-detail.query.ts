import { Query } from "@nestjs/cqrs"
import type { HiringCandidateDetailView } from "@modules/domain/hiring"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { HiringCandidateDetailRequest } from "./hiring-candidate-detail.contracts"

/** Asks for the timeline and CV link of one candidate. */
export class HiringCandidateDetailQuery extends Query<HiringCandidateDetailView> {
    constructor(readonly params: ExecuteParams<HiringCandidateDetailRequest>) {
        super()
    }
}
