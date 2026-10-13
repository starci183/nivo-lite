import { CommandHandler } from "@nestjs/cqrs"
import { BrainService } from "@modules/domain/brain"
import type { LessonRecord } from "@modules/domain/brain-lessons"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SaveBrainLessonCommand } from "./save-brain-lesson.command"

@CommandHandler(SaveBrainLessonCommand)
/** Writes a lesson by hand; it is applied at once. */
export class SaveBrainLessonHandler extends ICQRSHandler<SaveBrainLessonCommand, LessonRecord> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly brain: BrainService,
    ) {
        super(logger)
    }

    protected override process(command: SaveBrainLessonCommand): Promise<LessonRecord> {
        return this.brain.saveLesson(command.params.principal.id, command.params.request)
    }
}
