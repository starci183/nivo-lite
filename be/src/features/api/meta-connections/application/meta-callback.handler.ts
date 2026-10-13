import { CommandHandler } from "@nestjs/cqrs"
import { MetaConnectionsService } from "@modules/domain/meta-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MetaCallbackCommand } from "./meta-callback.command"
import type { MetaCallbackOutcome } from "./meta-callback.contracts"

@CommandHandler(MetaCallbackCommand)
/** Finishes a Meta login and answers where the browser goes next. */
export class MetaCallbackHandler extends ICQRSHandler<MetaCallbackCommand, MetaCallbackOutcome> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly metaConnectionsService: MetaConnectionsService,
    ) {
        super(logger)
    }

    protected override process(command: MetaCallbackCommand): Promise<MetaCallbackOutcome> {
        return this.metaConnectionsService.complete(command.params.request)
    }
}
