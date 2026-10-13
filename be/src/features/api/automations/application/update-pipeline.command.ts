import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AutomationCard } from "@modules/domain/automations"
import type { UpdatePipelineRequest } from "./update-pipeline.contracts"

/** Changes one pipeline: switch, settings, wording, hide, send by itself. */
export class UpdatePipelineCommand extends Command<AutomationCard> {
    constructor(readonly params: ExecuteParams<UpdatePipelineRequest>) {
        super()
    }
}
