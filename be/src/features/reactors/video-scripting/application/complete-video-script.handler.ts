import { CommandHandler } from "@nestjs/cqrs"
import { VideoScriptingService } from "@modules/domain/video"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CompleteVideoScriptCommand } from "./complete-video-script.command"

@CommandHandler(CompleteVideoScriptCommand)
/** Hands the delivered ai_generation_completed event to the domain service, which claims the delivery in the inbox and applies the change in one transaction. */
export class CompleteVideoScriptHandler extends ICQRSHandler<CompleteVideoScriptCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly scripting: VideoScriptingService,
    ) {
        super(logger)
    }

    protected override process(command: CompleteVideoScriptCommand): Promise<void> {
        return this.scripting.complete(
            command.params.request.delivery.event.payload.workspaceId,
            command.params.request.delivery.event.payload.generationId,
            {
                consumer: command.params.request.delivery.consumer,
                dedupeKey: command.params.request.delivery.dedupeKey,
            },
        )
    }
}
