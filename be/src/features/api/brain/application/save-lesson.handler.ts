import { CommandHandler } from "@nestjs/cqrs"
import { BrainService } from "@modules/domain/brain"
import type { LessonRecord } from "@modules/domain/brain-lessons"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SaveLessonCommand } from "./save-lesson.command"

@CommandHandler(SaveLessonCommand)
/** Saves the lesson through the brain service. */
export class SaveLessonHandler extends ICQRSHandler<SaveLessonCommand, LessonRecord> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly brain: BrainService,
    ) {
        super(logger)
    }

    protected override process(command: SaveLessonCommand): Promise<LessonRecord> {
        return this.brain.saveLesson(command.params.principal.id, command.params.request)
    }
}
