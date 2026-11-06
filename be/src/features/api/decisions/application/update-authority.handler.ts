import { CommandHandler } from "@nestjs/cqrs"
import { DecisionsService } from "@modules/domain/decisions"
import type { AuthorityProfile } from "@modules/domain/authority"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { UpdateAuthorityCommand } from "./update-authority.command"

@CommandHandler(UpdateAuthorityCommand)
/** Saves the patch through the decisions service. */
export class UpdateAuthorityHandler extends ICQRSHandler<UpdateAuthorityCommand, AuthorityProfile> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly decisions: DecisionsService,
    ) {
        super(logger)
    }

    protected override process(command: UpdateAuthorityCommand): Promise<AuthorityProfile> {
        return this.decisions.updateAuthority(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.patch,
        )
    }
}
