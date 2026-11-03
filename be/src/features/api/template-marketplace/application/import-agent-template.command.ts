import { Command } from "@nestjs/cqrs"
import type { InstalledTemplate } from "@nivo/agent-sdk/template"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ImportAgentTemplateRequest } from "./import-agent-template.contracts"

/** Installs a template of the caller's own account as a new agent in this workspace, in shadow mode. */
export class ImportAgentTemplateCommand extends Command<InstalledTemplate> {
    constructor(readonly params: ExecuteParams<ImportAgentTemplateRequest>) {
        super()
    }
}
