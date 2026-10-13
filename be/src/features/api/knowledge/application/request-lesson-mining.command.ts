import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RequestLessonMiningRequest } from "./request-lesson-mining.contracts"

/** Asks the brain to study the corrections of one agent and propose lessons. */
export class RequestLessonMiningCommand extends Command<string> {
    constructor(readonly params: ExecuteParams<RequestLessonMiningRequest>) {
        super()
    }
}
