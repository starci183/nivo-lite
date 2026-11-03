import { Query } from "@nestjs/cqrs"
import type { UpdateOffer } from "@nivo-lite/agent-sdk/template"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { TemplateUpdateOffersRequest } from "./template-update-offers.contracts"

/** Lists the newer versions of templates offered to the agents of this workspace, branch by branch. */
export class TemplateUpdateOffersQuery extends Query<ReadonlyArray<UpdateOffer>> {
    constructor(readonly params: ExecuteParams<TemplateUpdateOffersRequest>) {
        super()
    }
}
