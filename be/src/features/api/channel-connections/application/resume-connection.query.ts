import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ResumeConnectionRequest, ResumeConnectionResult } from "./resume-connection.contracts"

/** Reopens an unfinished bank or payment feed connection. */
export class ResumeConnectionQuery extends Query<ResumeConnectionResult> {
    constructor(readonly params: ExecuteParams<ResumeConnectionRequest>) {
        super()
    }
}
