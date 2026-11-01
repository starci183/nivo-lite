import { CommandHandler } from "@nestjs/cqrs"
import { BrainBulkService } from "@modules/domain/brain"
import type { BulkUndone } from "@modules/domain/brain"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { UndoBrainFactBatchCommand } from "./undo-brain-fact-batch.command"

@CommandHandler(UndoBrainFactBatchCommand)
/** Takes a batch of facts applied together back to review. */
export class UndoBrainFactBatchHandler extends ICQRSHandler<UndoBrainFactBatchCommand, BulkUndone> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly bulk: BrainBulkService,
    ) {
        super(logger)
    }

    protected override process(command: UndoBrainFactBatchCommand): Promise<BulkUndone> {
        return this.bulk.undoBatch(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.batchId,
        )
    }
}
