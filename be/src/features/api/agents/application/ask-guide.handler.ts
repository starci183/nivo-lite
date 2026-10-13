import { CommandHandler } from "@nestjs/cqrs"
import { GuideService } from "@modules/domain/ai-generations"
import type { GenerationEnqueued } from "@modules/domain/ai-generations"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AskGuideCommand } from "./ask-guide.command"

@CommandHandler(AskGuideCommand)
/** Queues the guide's answer through the guide service. */
export class AskGuideHandler extends ICQRSHandler<AskGuideCommand, GenerationEnqueued> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly guide: GuideService,
    ) {
        super(logger)
    }

    protected override process(command: AskGuideCommand): Promise<GenerationEnqueued> {
        return this.guide.ask(command.params.principal.id, command.params.request)
    }
}
