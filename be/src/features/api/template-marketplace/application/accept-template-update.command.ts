import { Command } from "@nestjs/cqrs"
import type { UpdateOffer } from "@modules/domain/agent-templates"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AcceptTemplateUpdateRequest } from "./accept-template-update.contracts"

/** Takes the named branches of a newer version into the agent, keeping every edit of the buyer on the others. */
export class AcceptTemplateUpdateCommand extends Command<UpdateOffer | null> {
    constructor(readonly params: ExecuteParams<AcceptTemplateUpdateRequest>) {
        super()
    }
}
