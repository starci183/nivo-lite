import { CommandHandler } from "@nestjs/cqrs"
import { BrainService } from "@modules/domain/brain"
import type { LessonRecord } from "@modules/domain/brain-lessons"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DecideBrainLessonCommand } from "./decide-brain-lesson.command"

@CommandHandler(DecideBrainLessonCommand)
/** Approves or turns down a proposed lesson, or retires one in force. */
export class DecideBrainLessonHandler extends ICQRSHandler<DecideBrainLessonCommand, LessonRecord> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly brain: BrainService,
    ) {
        super(logger)
    }

    protected override process(command: DecideBrainLessonCommand): Promise<LessonRecord> {
        return this.brain.decideLesson(command.params.principal.id, command.params.request)
    }
}
