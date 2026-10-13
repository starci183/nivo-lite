import { Command } from "@nestjs/cqrs"
import type { AccountingAdjustmentRow } from "@modules/domain/accounting-adjustments"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CreateAccountingAdjustmentRequest } from "./create-accounting-adjustment.contracts"

/** Requests an append-only correction over a workspace invoice or payment. */
export class CreateAccountingAdjustmentCommand extends Command<AccountingAdjustmentRow> {
    constructor(readonly params: ExecuteParams<CreateAccountingAdjustmentRequest>) {
        super()
    }
}
