import { defineEntity, field, type EntityDefinition, type FieldDef } from "@nivo-lite/agent-sdk/entity"

import { MAX_LINE } from "../../bounds"
import { SALES_INVOICE_ENTITY } from "./sales-entity-names"

/** Where an invoice stands. */
export const INVOICE_STATUSES: readonly [string, ...Array<string>] = ["draft", "issued", "paid", "void"]

type InvoiceFields = {
    readonly invoiceNo: FieldDef<"sequence", false>
    readonly orderId: FieldDef<"uuid", true>
    readonly contactId: FieldDef<"contact", true>
    readonly amountVnd: FieldDef<"money_vnd", false>
    readonly status: FieldDef<"enum", false>
    readonly dueAt: FieldDef<"timestamptz", true>
    readonly issuedBy: FieldDef<"text", true>
    readonly issuedAt: FieldDef<"timestamptz", true>
    readonly paidAt: FieldDef<"timestamptz", true>
    readonly contractId: FieldDef<"uuid", true>
    readonly periodEndsOn: FieldDef<"date", true>
}

const invoiceFields: InvoiceFields = {
    invoiceNo: field.sequence({ format: "HD-{yyyy}{mm}-{n:4}", resets: "month" }),
    /** The order this invoice bills (a plain id: no read joins it). */
    orderId: field.uuid({ nullable: true }),
    /** The person billed (the core contact); cleared when the contact is deleted, the invoice stays in the books. */
    contactId: field.contact({ nullable: true, onContactDelete: "clear" }),
    amountVnd: field.moneyVnd(),
    status: field.enum({ of: INVOICE_STATUSES, default: { literal: "draft" } }),
    dueAt: field.timestamptz({ nullable: true }),
    issuedBy: field.text({ maxLength: MAX_LINE, nullable: true }),
    issuedAt: field.timestamptz({ nullable: true }),
    paidAt: field.timestamptz({ nullable: true }),
    contractId: field.uuid({ nullable: true }),
    periodEndsOn: field.date({ nullable: true }),
}

/** An invoice a workspace issues. */
export const invoiceEntity: EntityDefinition<InvoiceFields> = defineEntity({
    name: SALES_INVOICE_ENTITY,
    dataKind: "invoice",
    fields: invoiceFields,
    indexes: [
        { name: "key", on: ["id"] },
        { name: "recent", on: [{ desc: "createdAt" }, { desc: "id" }] },
        { name: "status_recent", on: ["status", { desc: "createdAt" }, { desc: "id" }] },
    ],
    constraints: [
        {
            kind: "unique",
            name: "order_key",
            on: ["orderId"],
            where: { op: "notNull", field: "orderId" },
            refusal: "order-already-invoiced",
        },
        { kind: "unique", name: "invoice_no_key", on: ["invoiceNo"], refusal: "invoice-no-taken" },
        {
            kind: "unique",
            name: "contract_period_key",
            on: ["contractId", "periodEndsOn"],
            where: { op: "notNull", field: "contractId" },
            refusal: "renewal-already-invoiced",
        },
        {
            kind: "check",
            name: "amount_chk",
            expr: { op: "gte", field: "amountVnd", value: 0 },
            refusal: "invoice-amount-negative",
        },
        {
            kind: "check",
            name: "contract_period_chk",
            expr: {
                op: "or",
                of: [
                    { op: "isNull", field: "contractId" },
                    { op: "notNull", field: "periodEndsOn" },
                ],
            },
            refusal: "renewal-period-missing",
        },
    ],
})
