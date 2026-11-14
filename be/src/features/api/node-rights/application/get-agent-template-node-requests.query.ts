import { Query } from "@nestjs/cqrs"
import type { TemplateNodeRequests } from "@modules/domain/node-right-rollups"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetAgentTemplateNodeRequestsRequest } from "./get-agent-template-node-requests.contracts"

/** What a workflow template's nodes ask for on accounts, before anything is installed. */
export class GetAgentTemplateNodeRequestsQuery extends Query<TemplateNodeRequests> {
    constructor(readonly params: ExecuteParams<GetAgentTemplateNodeRequestsRequest>) {
        super()
    }
}
