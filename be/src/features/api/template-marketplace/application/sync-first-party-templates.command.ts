import { Command } from "@nestjs/cqrs"
import type { FirstPartySyncReport } from "@modules/domain/template-marketplace"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SyncFirstPartyTemplatesRequest } from "./sync-first-party-templates.contracts"

/** A platform admin packages the built-in modules of the catalogue as first-party templates and records the agents that already run. */
export class SyncFirstPartyTemplatesCommand extends Command<FirstPartySyncReport> {
    constructor(readonly params: ExecuteParams<SyncFirstPartyTemplatesRequest>) {
        super()
    }
}
