import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RequestAgentSyncRequest } from "./request-agent-sync.contracts"

/** Asks to rebuild the OpenClaw copy of the agents. */
export class RequestAgentSyncCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<RequestAgentSyncRequest>) {
        super()
    }
}
