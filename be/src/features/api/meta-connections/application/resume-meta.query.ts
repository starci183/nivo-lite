import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ResumeMetaRequest, ResumeMetaResult } from "./resume-meta.contracts"

/** Reopens an unfinished Meta connection. */
export class ResumeMetaQuery extends Query<ResumeMetaResult> {
    constructor(readonly params: ExecuteParams<ResumeMetaRequest>) {
        super()
    }
}
