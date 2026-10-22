import { Query } from "@nestjs/cqrs"
import type { ThreadView } from "@modules/domain/thread-messages"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ReadWorkThreadRequest } from "./read-work-thread.contracts"

/** Asks for one thread with its newest messages. */
export class ReadWorkThreadQuery extends Query<ThreadView> {
    constructor(readonly params: ExecuteParams<ReadWorkThreadRequest>) {
        super()
    }
}
