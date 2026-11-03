import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ExportAgentTemplateRequest } from "./export-agent-template.contracts"

/** Exports one version of a template of the caller as a file of canonical JSON. */
export class ExportAgentTemplateQuery extends Query<string> {
    constructor(readonly params: ExecuteParams<ExportAgentTemplateRequest>) {
        super()
    }
}
