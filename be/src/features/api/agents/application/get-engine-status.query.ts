import { Query } from "@nestjs/cqrs"
import type { EngineStatus } from "@modules/domain/agents"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetEngineStatusRequest } from "./get-engine-status.contracts"

/** Asks whether the agent engine can answer. */
export class GetEngineStatusQuery extends Query<EngineStatus> {
    constructor(readonly params: ExecuteParams<GetEngineStatusRequest>) {
        super()
    }
}
