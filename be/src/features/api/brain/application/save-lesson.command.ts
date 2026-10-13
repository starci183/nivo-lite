import { Command } from "@nestjs/cqrs"
import type { LessonRecord } from "@modules/domain/brain-lessons"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveLessonRequest } from "./save-lesson.contracts"

/** Asks to write a lesson by hand. */
export class SaveLessonCommand extends Command<LessonRecord> {
    constructor(readonly params: ExecuteParams<SaveLessonRequest>) {
        super()
    }
}
