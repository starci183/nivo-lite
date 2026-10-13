import { QueryHandler } from "@nestjs/cqrs"
import { SetupChatService } from "@modules/domain/modules"
import type { SetupState } from "@modules/domain/modules"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetSetupStateQuery } from "./get-setup-state.query"

@QueryHandler(GetSetupStateQuery)
/** Answers the setup state from the setup chat service. */
export class GetSetupStateHandler extends ICQRSHandler<GetSetupStateQuery, SetupState> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly chat: SetupChatService,
    ) {
        super(logger)
    }

    protected override process(query: GetSetupStateQuery): Promise<SetupState> {
        return this.chat.state(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.installationId,
            query.params.request.locale,
        )
    }
}
