import { CommandHandler } from "@nestjs/cqrs"
import { BrainPageService } from "@modules/domain/brain"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RequestLessonMiningCommand } from "./request-lesson-mining.command"

@CommandHandler(RequestLessonMiningCommand)
/** Asks the brain to study the corrections of one agent and propose lessons. */
export class RequestLessonMiningHandler extends ICQRSHandler<RequestLessonMiningCommand, string> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly page: BrainPageService,
    ) {
        super(logger)
    }

    protected override process(command: RequestLessonMiningCommand): Promise<string> {
        return this.page.requestMining(command.params.principal.id, command.params.request.workspaceId, command.params.request.module)
    }
}
