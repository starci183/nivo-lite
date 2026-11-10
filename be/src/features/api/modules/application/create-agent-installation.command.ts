import { Command } from "@nestjs/cqrs"
import type { CreateAgentInstanceRequest, CreatedAgent } from "@modules/domain/agent-instances"
import type { ExecuteParams } from "@modules/platform/cqrs"

/** Asks to create one more agent of a role, with its own name, picture, handle and channels. */
export class CreateAgentInstallationCommand extends Command<CreatedAgent> {
    constructor(readonly params: ExecuteParams<CreateAgentInstanceRequest>) {
        super()
    }
}
