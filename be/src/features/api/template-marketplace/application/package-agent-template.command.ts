import { Command } from "@nestjs/cqrs"
import type { TemplateVersionView } from "@nivo-lite/agent-sdk/template"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { PackageAgentTemplateRequest } from "./package-agent-template.contracts"

/** Packages a frozen version of an agent as the next version of a template of the caller. */
export class PackageAgentTemplateCommand extends Command<TemplateVersionView> {
    constructor(readonly params: ExecuteParams<PackageAgentTemplateRequest>) {
        super()
    }
}
