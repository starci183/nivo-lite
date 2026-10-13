import { Command } from "@nestjs/cqrs"
import type { LessonRecord } from "@modules/domain/brain-lessons"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveBrainLessonRequest } from "./save-brain-lesson.contracts"

/** Writes a lesson by hand; it is applied at once. */
export class SaveBrainLessonCommand extends Command<LessonRecord> {
    constructor(readonly params: ExecuteParams<SaveBrainLessonRequest>) {
        super()
    }
}
