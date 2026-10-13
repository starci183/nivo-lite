import { CommandHandler } from "@nestjs/cqrs"
import { BankFeedService } from "@modules/domain/billing"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RecordManualEvidenceCommand } from "./record-manual-evidence.command"

@CommandHandler(RecordManualEvidenceCommand)
/** Admits one piece of manual evidence: money the owner knows arrived. */
export class RecordManualEvidenceHandler extends ICQRSHandler<RecordManualEvidenceCommand, boolean> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly feed: BankFeedService,
    ) {
        super(logger)
    }

    protected override process(command: RecordManualEvidenceCommand): Promise<boolean> {
        return this.feed.acceptManualCredit(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
