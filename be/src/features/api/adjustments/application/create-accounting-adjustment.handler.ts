import { CommandHandler } from "@nestjs/cqrs"
import { AccountingAdjustmentsService } from "@modules/domain/accounting-adjustments"
import type { AccountingAdjustmentRow } from "@modules/domain/accounting-adjustments"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CreateAccountingAdjustmentCommand } from "./create-accounting-adjustment.command"

@CommandHandler(CreateAccountingAdjustmentCommand)
/** Appends the correction through the table owner, which proves role and target scope. */
export class CreateAccountingAdjustmentHandler extends ICQRSHandler<
    CreateAccountingAdjustmentCommand,
    AccountingAdjustmentRow
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly adjustments: AccountingAdjustmentsService,
    ) {
        super(logger)
    }
    protected override process(command: CreateAccountingAdjustmentCommand): Promise<AccountingAdjustmentRow> {
        return this.adjustments.create(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
