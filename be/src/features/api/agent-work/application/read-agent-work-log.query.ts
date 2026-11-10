import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ReadAgentWorkLogRequest, WorkLogLine } from "./read-agent-work-log.contracts"

/** Asks for the work log of one agent: its newest work items with how each was decided and what backs it. */
export class ReadAgentWorkLogQuery extends Query<ReadonlyArray<WorkLogLine>> {
    constructor(readonly params: ExecuteParams<ReadAgentWorkLogRequest>) {
        super()
    }
}
