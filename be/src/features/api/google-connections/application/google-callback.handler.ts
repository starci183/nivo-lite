import { CommandHandler } from "@nestjs/cqrs"
import { GoogleConnectionsService, type GoogleCallbackResult } from "@modules/domain/google-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { GoogleCallbackCommand } from "./google-callback.command"

@CommandHandler(GoogleCallbackCommand)
/** Finishes a Google consent and answers where the browser goes next. */
export class GoogleCallbackHandler extends ICQRSHandler<GoogleCallbackCommand, GoogleCallbackResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly googleConnectionsService: GoogleConnectionsService,
    ) {
        super(logger)
    }

    protected override process(command: GoogleCallbackCommand): Promise<GoogleCallbackResult> {
        return this.googleConnectionsService.complete(command.params.request)
    }
}
