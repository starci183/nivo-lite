import { Command } from "@nestjs/cqrs"
import type { InstalledTemplate } from "@nivo-lite/agent-sdk/template"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { InstallTemplateListingRequest } from "./install-template-listing.contracts"

/** Installs an approved listing as a new agent in shadow mode; a paid one needs its settled order. */
export class InstallTemplateListingCommand extends Command<InstalledTemplate> {
    constructor(readonly params: ExecuteParams<InstallTemplateListingRequest>) {
        super()
    }
}
