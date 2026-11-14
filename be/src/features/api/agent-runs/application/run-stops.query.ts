import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RunStopsPage } from "@modules/domain/agent-pages"
import type { RunStopsRequest } from "./run-stops-page.contracts"

/** Reads one page of the open stops of the workspace. */
export class RunStopsQuery extends Query<RunStopsPage> {
    constructor(readonly params: ExecuteParams<RunStopsRequest>) {
        super()
    }
}
