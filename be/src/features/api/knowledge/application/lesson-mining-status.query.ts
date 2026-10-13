import { Query } from "@nestjs/cqrs"
import type { LessonMiningState } from "@modules/domain/brain"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { LessonMiningStatusRequest } from "./lesson-mining-status.contracts"

/** Reads where the study of an agent's corrections stands. */
export class LessonMiningStatusQuery extends Query<LessonMiningState> {
    constructor(readonly params: ExecuteParams<LessonMiningStatusRequest>) {
        super()
    }
}
