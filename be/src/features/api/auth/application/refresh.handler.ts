import { CommandHandler } from "@nestjs/cqrs"
import { IdentitySignInService } from "@modules/domain/identity"
import type { AccessGrant } from "@modules/domain/identity"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RefreshCommand } from "./refresh.command"

@CommandHandler(RefreshCommand)
/** Rotates the cookie token. */
export class RefreshHandler extends ICQRSHandler<RefreshCommand, AccessGrant> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly signIn: IdentitySignInService,
    ) {
        super(logger)
    }

    protected override process(command: RefreshCommand): Promise<AccessGrant> {
        return this.signIn.refresh(command.params.request.exchange)
    }
}
