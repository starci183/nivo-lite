import { CommandHandler } from "@nestjs/cqrs"
import { BrandKitService } from "@modules/domain/content-ai"
import type { BrandProposal } from "@modules/domain/content-ai"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DecideBrandProposalCommand } from "./decide-brand-proposal.command"

@CommandHandler(DecideBrandProposalCommand)
/** Confirms or rejects a brand proposal. */
export class DecideBrandProposalHandler extends ICQRSHandler<DecideBrandProposalCommand, BrandProposal> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly brand: BrandKitService,
    ) {
        super(logger)
    }

    protected override process(command: DecideBrandProposalCommand): Promise<BrandProposal> {
        return this.brand.decide(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.proposalId,
            command.params.request.decision,
        )
    }
}
