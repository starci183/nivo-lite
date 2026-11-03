import { Query } from "@nestjs/cqrs"
import type { PackagePreview } from "@modules/domain/agent-templates"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { PreviewAgentTemplateRequest } from "./preview-agent-template.contracts"

/** Shows what packaging a version of an agent would keep and leave out, writing nothing. */
export class PreviewAgentTemplateQuery extends Query<PackagePreview> {
    constructor(readonly params: ExecuteParams<PreviewAgentTemplateRequest>) {
        super()
    }
}
