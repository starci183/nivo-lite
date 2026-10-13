import { CommandHandler } from "@nestjs/cqrs"
import { GenerationsService } from "@modules/domain/ai-generations"
import type { GenerationOutcome } from "@modules/domain/ai-generations"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GenerateTextCommand } from "./generate-text.command"

@CommandHandler(GenerateTextCommand)
/** Writes the text through the generations service. */
export class GenerateTextHandler extends ICQRSHandler<GenerateTextCommand, GenerationOutcome> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly generations: GenerationsService,
    ) {
        super(logger)
    }

    protected override process(command: GenerateTextCommand): Promise<GenerationOutcome> {
        return this.generations.generateFor(command.params.principal.id, command.params.request)
    }
}
