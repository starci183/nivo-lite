import { Query } from "@nestjs/cqrs"
import type { ProviderTriggerState } from "@modules/domain/provider-triggers"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetProviderTriggerStatesRequest } from "./get-provider-trigger-states.contracts"

/** Asks the states of a connected account's triggers. */
export class GetProviderTriggerStatesQuery extends Query<ReadonlyArray<ProviderTriggerState>> {
    constructor(readonly params: ExecuteParams<GetProviderTriggerStatesRequest>) {
        super()
    }
}
