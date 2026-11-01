import { CommandHandler } from "@nestjs/cqrs"
import { BrainBulkService } from "@modules/domain/brain"
import type { BulkApplied } from "@modules/domain/brain"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ApplyBrainFactGroupCommand } from "./apply-brain-fact-group.command"

@CommandHandler(ApplyBrainFactGroupCommand)
/** Applies the checked facts of one internal document together, as one batch that can be taken back. */
export class ApplyBrainFactGroupHandler extends ICQRSHandler<ApplyBrainFactGroupCommand, BulkApplied> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly bulk: BrainBulkService,
    ) {
        super(logger)
    }

    protected override process(command: ApplyBrainFactGroupCommand): Promise<BulkApplied> {
        return this.bulk.applyDocument(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.sourceId,
        )
    }
}
