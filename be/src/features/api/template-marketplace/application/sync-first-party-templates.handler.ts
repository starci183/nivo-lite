import { CommandHandler } from "@nestjs/cqrs"
import { FirstPartyTemplatesService } from "@modules/domain/template-marketplace"
import type { FirstPartySyncReport } from "@modules/domain/template-marketplace"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SyncFirstPartyTemplatesCommand } from "./sync-first-party-templates.command"

@CommandHandler(SyncFirstPartyTemplatesCommand)
/** A platform admin packages the built-in modules of the catalogue as first-party templates and records the agents that already run. */
export class SyncFirstPartyTemplatesHandler extends ICQRSHandler<SyncFirstPartyTemplatesCommand, FirstPartySyncReport> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly svc: FirstPartyTemplatesService,
    ) {
        super(logger)
    }

    protected override process(command: SyncFirstPartyTemplatesCommand): Promise<FirstPartySyncReport> {
        const pr = command.params.principal
        return this.svc.sync(pr)
    }
}
