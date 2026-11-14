import { defineEntity, field, type EntityDefinition, type FieldDef } from "@nivo-lite/agent-sdk/entity"

import { MAX_LINE } from "../../../shared/bounds"
import { SALES_LEDGER_ADJUSTMENT_ENTITY } from "../../../shared/entities/sales-entity-names"

/** The longest note of an adjustment. */
const MAX_NOTE = 2_000

type AdjustmentFields = {
    readonly targetType: FieldDef<"enum", false>
    readonly targetId: FieldDef<"uuid", false>
    readonly note: FieldDef<"text", false>
    readonly correctedAmountVnd: FieldDef<"money_vnd", true>
    readonly createdBy: FieldDef<"text", false>
    readonly createdByUser: FieldDef<"uuid", true>
}

const adjustmentFields: AdjustmentFields = {
    targetType: field.enum({ of: ["invoice", "transaction"] }),
    targetId: field.uuid(),
    /** At least 5 characters once trimmed: no declared check says it (the blocks-core action refuses a short note, there is no declared check. */
    note: field.text({ maxLength: MAX_NOTE }),
    correctedAmountVnd: field.moneyVnd({ nullable: true }),
    createdBy: field.text({ maxLength: MAX_LINE }),
    createdByUser: field.uuid({ nullable: true }),
}

/** A correction an accountant recorded on an invoice or a transaction. */
export const adjustmentEntity: EntityDefinition<AdjustmentFields> = defineEntity({
    name: SALES_LEDGER_ADJUSTMENT_ENTITY,
    dataKind: "accounting-adjustment",
    fields: adjustmentFields,
    indexes: [
        { name: "target", on: ["targetType", "targetId", { desc: "createdAt" }, { desc: "id" }] },
        { name: "recent", on: [{ desc: "createdAt" }, { desc: "id" }] },
    ],
    constraints: [
        {
            kind: "check",
            name: "corrected_amount_chk",
            expr: {
                op: "or",
                of: [
                    { op: "isNull", field: "correctedAmountVnd" },
                    { op: "gte", field: "correctedAmountVnd", value: 0 },
                ],
            },
            refusal: "adjustment-amount-negative",
        },
    ],
})
