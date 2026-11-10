import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetAgentAvatarPresetRequest } from "./set-agent-avatar-preset.contracts"

/** Asks to dress an agent in a preset picture, dropping any uploaded one. */
export class SetAgentAvatarPresetCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<SetAgentAvatarPresetRequest>) {
        super()
    }
}
