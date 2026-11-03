import { CommandHandler } from "@nestjs/cqrs"
import { FirstPartyTemplatesService } from "@modules/domain/template-marketplace"
import type { TemplateVersionView } from "@nivo/agent-sdk/template"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ForkFirstPartyTemplateCommand } from "./fork-first-party-template.command"

@CommandHandler(ForkFirstPartyTemplateCommand)
/** Starts a template of the caller from a first-party package, keeping the provenance of its branches. */
export class ForkFirstPartyTemplateHandler extends ICQRSHandler<ForkFirstPartyTemplateCommand, TemplateVersionView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly svc: FirstPartyTemplatesService,
    ) {
        super(logger)
    }

    protected override process(command: ForkFirstPartyTemplateCommand): Promise<TemplateVersionView> {
        const p = command.params.principal.id
        const r = command.params.request
        return this.svc.fork(p, r)
    }
}
