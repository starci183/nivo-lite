import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetAgentAvatarRequest } from "./set-agent-avatar.contracts"

/** Asks to set an uploaded picture on an agent, or to remove it. */
export class SetAgentAvatarCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<SetAgentAvatarRequest>) {
        super()
    }
}
