import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { LogoutOtherSessionsRequest } from "./logout-other-sessions.contracts"

/** Signs the caller out of every other device. */
export class LogoutOtherSessionsCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<LogoutOtherSessionsRequest>) {
        super()
    }
}
