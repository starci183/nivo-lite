import { CommandHandler } from "@nestjs/cqrs"
import { GenerationsService } from "@modules/domain/ai-generations"
import type { GenerationRequested } from "@modules/domain/ai-generations"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RequestGenerationCommand } from "./request-generation.command"

@CommandHandler(RequestGenerationCommand)
/** Queues the text through the generations service. */
export class RequestGenerationHandler extends ICQRSHandler<RequestGenerationCommand, GenerationRequested> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly generations: GenerationsService,
    ) {
        super(logger)
    }

    protected override process(command: RequestGenerationCommand): Promise<GenerationRequested> {
        return this.generations.requestFor(command.params.principal.id, command.params.request)
    }
}
