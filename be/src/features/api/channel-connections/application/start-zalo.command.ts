import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { StartZaloRequest, StartZaloResult } from "./start-zalo.contracts"

/** Starts a Zalo OA connection. */
export class StartZaloCommand extends Command<StartZaloResult> {
    constructor(readonly params: ExecuteParams<StartZaloRequest>) {
        super()
    }
}
