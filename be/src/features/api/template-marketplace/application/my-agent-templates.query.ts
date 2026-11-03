import { Query } from "@nestjs/cqrs"
import type { TemplateView } from "@nivo/agent-sdk/template"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { MyAgentTemplatesRequest } from "./my-agent-templates.contracts"

/** Lists the templates of the caller with their versions. */
export class MyAgentTemplatesQuery extends Query<ReadonlyArray<TemplateView>> {
    constructor(readonly params: ExecuteParams<MyAgentTemplatesRequest>) {
        super()
    }
}
