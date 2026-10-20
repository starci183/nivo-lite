import { CommandHandler } from "@nestjs/cqrs"
import { BrandKitService } from "@modules/domain/content-ai"
import type { BrandProposal } from "@modules/domain/content-ai"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ProposeBrandKitCommand } from "./propose-brand-kit.command"

@CommandHandler(ProposeBrandKitCommand)
/** Reads an attached brand guideline PDF into a brand proposal. */
export class ProposeBrandKitHandler extends ICQRSHandler<ProposeBrandKitCommand, BrandProposal> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly brand: BrandKitService,
    ) {
        super(logger)
    }

    protected override process(command: ProposeBrandKitCommand): Promise<BrandProposal> {
        return this.brand.propose(command.params.principal.id, command.params.request)
    }
}
