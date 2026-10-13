import { Command } from "@nestjs/cqrs"
import type { LessonRecord } from "@modules/domain/brain-lessons"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DecideLessonRequest } from "./decide-lesson.contracts"

/** Asks to approve, turn down or retire a lesson. */
export class DecideLessonCommand extends Command<LessonRecord> {
    constructor(readonly params: ExecuteParams<DecideLessonRequest>) {
        super()
    }
}
