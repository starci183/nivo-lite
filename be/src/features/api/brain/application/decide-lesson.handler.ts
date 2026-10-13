import { CommandHandler } from "@nestjs/cqrs"
import { BrainService } from "@modules/domain/brain"
import type { LessonRecord } from "@modules/domain/brain-lessons"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DecideLessonCommand } from "./decide-lesson.command"

@CommandHandler(DecideLessonCommand)
/** Applies the decision through the brain service. */
export class DecideLessonHandler extends ICQRSHandler<DecideLessonCommand, LessonRecord> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly brain: BrainService,
    ) {
        super(logger)
    }

    protected override process(command: DecideLessonCommand): Promise<LessonRecord> {
        return this.brain.decideLesson(command.params.principal.id, command.params.request)
    }
}
