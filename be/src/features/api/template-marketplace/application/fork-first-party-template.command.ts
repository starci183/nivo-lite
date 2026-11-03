import { Command } from "@nestjs/cqrs"
import type { TemplateVersionView } from "@nivo/agent-sdk/template"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ForkFirstPartyTemplateRequest } from "./fork-first-party-template.contracts"

/** Starts a template of the caller from a first-party package, keeping the provenance of its branches. */
export class ForkFirstPartyTemplateCommand extends Command<TemplateVersionView> {
    constructor(readonly params: ExecuteParams<ForkFirstPartyTemplateRequest>) {
        super()
    }
}
