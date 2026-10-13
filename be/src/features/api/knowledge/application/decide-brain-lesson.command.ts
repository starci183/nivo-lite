import { Command } from "@nestjs/cqrs"
import type { LessonRecord } from "@modules/domain/brain-lessons"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DecideBrainLessonRequest } from "./decide-brain-lesson.contracts"

/** Approves or turns down a proposed lesson, or retires one in force. */
export class DecideBrainLessonCommand extends Command<LessonRecord> {
    constructor(readonly params: ExecuteParams<DecideBrainLessonRequest>) {
        super()
    }
}
