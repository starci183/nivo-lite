import { QueryHandler } from "@nestjs/cqrs"
import { ProviderTriggerStatesService, type ProviderTriggerState } from "@modules/domain/provider-triggers"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { GetProviderTriggerStatesQuery } from "./get-provider-trigger-states.query"

@QueryHandler(GetProviderTriggerStatesQuery)
/** Asks the provider triggers capability for the states of an account's triggers; the capability proves the member. */
export class GetProviderTriggerStatesHandler extends ICQRSHandler<
    GetProviderTriggerStatesQuery,
    ReadonlyArray<ProviderTriggerState>
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly states: ProviderTriggerStatesService,
    ) {
        super(logger)
    }

    protected override process(query: GetProviderTriggerStatesQuery): Promise<ReadonlyArray<ProviderTriggerState>> {
        return this.states.statesOf(
            { principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId },
            query.params.request.connectionId,
        )
    }
}
