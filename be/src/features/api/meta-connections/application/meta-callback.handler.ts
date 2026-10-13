import { CommandHandler } from "@nestjs/cqrs"
import { MetaConnectionsService } from "@modules/domain/meta-connections"
import type { MetaCallbackResult } from "@modules/domain/meta-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MetaCallbackCommand } from "./meta-callback.command"

@CommandHandler(MetaCallbackCommand)
/** Finishes a Meta login and answers where the browser goes next. */
export class MetaCallbackHandler extends ICQRSHandler<MetaCallbackCommand, MetaCallbackResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly metaConnectionsService: MetaConnectionsService,
    ) {
        super(logger)
    }

    protected override process(command: MetaCallbackCommand): Promise<MetaCallbackResult> {
        return this.metaConnectionsService.complete(command.params.request)
    }
}
