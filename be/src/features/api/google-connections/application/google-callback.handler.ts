import { CommandHandler } from "@nestjs/cqrs"
import { GoogleConnectionsService } from "@modules/domain/google-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GoogleCallbackCommand } from "./google-callback.command"
import type { GoogleCallbackOutcome } from "./google-callback.contracts"

@CommandHandler(GoogleCallbackCommand)
/** Finishes a Google consent and answers where the browser goes next. */
export class GoogleCallbackHandler extends ICQRSHandler<GoogleCallbackCommand, GoogleCallbackOutcome> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly googleConnectionsService: GoogleConnectionsService,
    ) {
        super(logger)
    }

    protected override process(command: GoogleCallbackCommand): Promise<GoogleCallbackOutcome> {
        return this.googleConnectionsService.complete(command.params.request)
    }
}
