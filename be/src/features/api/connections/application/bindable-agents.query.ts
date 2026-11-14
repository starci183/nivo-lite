import { Query } from "@nestjs/cqrs"
import type { BindableAgent } from "@modules/domain/connection-grants"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { BindableAgentsRequest } from "./bindable-agents.contracts"

/** Asks which active agents of the workspace may be bound to a connection of a provider. */
export class BindableAgentsQuery extends Query<ReadonlyArray<BindableAgent>> {
    constructor(readonly params: ExecuteParams<BindableAgentsRequest>) {
        super()
    }
}
