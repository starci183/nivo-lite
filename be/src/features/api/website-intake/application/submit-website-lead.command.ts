import { Command } from "@nestjs/cqrs"
import type { WebsiteAccepted } from "@modules/domain/inbox-leads"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { SubmitWebsiteLeadRequest } from "./submit-website-lead.contracts"

/** Asks to take the form of an anonymous visitor in as one input and one customer. */
export class SubmitWebsiteLeadCommand extends Command<WebsiteAccepted> {
    constructor(readonly params: PublicExecuteParams<SubmitWebsiteLeadRequest>) {
        super()
    }
}
