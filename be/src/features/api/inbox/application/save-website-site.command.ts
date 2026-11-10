import { Command } from "@nestjs/cqrs"
import type { WebsiteSiteView } from "@modules/domain/inbox-leads"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveWebsiteSiteRequest } from "./save-website-site.contracts"

/** Asks to change the switches and the agent of the website intake. */
export class SaveWebsiteSiteCommand extends Command<WebsiteSiteView> {
    constructor(readonly params: ExecuteParams<SaveWebsiteSiteRequest>) {
        super()
    }
}
