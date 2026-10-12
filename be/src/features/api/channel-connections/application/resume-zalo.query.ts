import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ResumeZaloRequest, ResumeZaloResult } from "./resume-zalo.contracts"

/** Reopens an unfinished Zalo OA connection. */
export class ResumeZaloQuery extends Query<ResumeZaloResult> {
    constructor(readonly params: ExecuteParams<ResumeZaloRequest>) {
        super()
    }
}
