import { Query } from "@nestjs/cqrs"
import type { WebsiteSiteView } from "@modules/domain/inbox-leads"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetWebsiteSiteRequest } from "./get-website-site.contracts"

/** Reads the website intake of the workspace; the first read issues its key. */
export class GetWebsiteSiteQuery extends Query<WebsiteSiteView> {
    constructor(readonly params: ExecuteParams<GetWebsiteSiteRequest>) {
        super()
    }
}
