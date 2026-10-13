import type { AccountingAdjustmentRow } from "@modules/domain/accounting-adjustments"
import type { CreateAccountingAdjustmentRequest } from "../../application/create-accounting-adjustment.contracts"
import type { CreateAccountingAdjustmentInput } from "./dto/create-accounting-adjustment.input"
import type { CreateAccountingAdjustmentType } from "./dto/create-accounting-adjustment.type"

/** Maps the bounded transport input to the append-only correction command. */
export const toCreateAccountingAdjustmentRequest = (
    input: CreateAccountingAdjustmentInput,
    workspaceId: string,
): CreateAccountingAdjustmentRequest => ({
    workspaceId,
    targetType: input.targetType,
    targetId: input.targetId,
    note: input.note,
    correctedAmount: input.correctedAmount,
})
/** Maps the recorded correction without a response envelope. */
export const toCreateAccountingAdjustmentType = (row: AccountingAdjustmentRow): CreateAccountingAdjustmentType => ({
    id: row.id,
    targetType: row.target_type,
    targetId: row.target_id,
    note: row.note,
    correctedAmount: row.corrected_amount_vnd,
    createdBy: row.created_by,
    createdAt: row.created_at,
})
