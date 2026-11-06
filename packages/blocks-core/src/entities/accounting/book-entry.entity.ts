import { defineEntity, field } from "@nivo-lite/agent-sdk/entity"
import type { EntityDefinition, FieldDef } from "@nivo-lite/agent-sdk/entity"

/** What a book entry records: money in, an invoice issued, a correction. */
export const BOOK_ENTRY_KINDS: readonly [string, ...Array<string>] = ["income", "invoice", "adjustment"]

/** The longest note of a book entry. */
const MAX_NOTE = 2_000

type BookEntryFields = {
    readonly kind: FieldDef<"enum", false>
    readonly sourceEntity: FieldDef<"text", false>
    readonly sourceId: FieldDef<"uuid", false>
    readonly entryDate: FieldDef<"date", false>
    readonly amountVnd: FieldDef<"money_vnd", false>
    readonly note: FieldDef<"text", true>
}

const bookEntryFields: BookEntryFields = {
    kind: field.enum({ of: BOOK_ENTRY_KINDS }),
    sourceEntity: field.text({ maxLength: 120 }),
    sourceId: field.uuid(),
    entryDate: field.date(),
    amountVnd: field.moneyVnd(),
    note: field.text({ maxLength: MAX_NOTE, searchable: true, nullable: true }),
}

/** The books of a workspace, one row per source row: a projection the declared jobs keep (plan 9.5). */
export const bookEntryEntity: EntityDefinition<BookEntryFields> = defineEntity({
    name: "accounting.book-entry",
    dataKind: "book-entry",
    fields: bookEntryFields,
    indexes: [
        { name: "date", on: [{ desc: "entryDate" }, { desc: "id" }] },
        { name: "kind_date", on: ["kind", { desc: "entryDate" }, { desc: "id" }] },
        { name: "amount", on: [{ desc: "amountVnd" }, { desc: "id" }] },
        { name: "kind_amount", on: ["kind", { desc: "amountVnd" }, { desc: "id" }] },
    ],
    constraints: [
        { kind: "unique", name: "source_key", on: ["sourceEntity", "sourceId", "kind"], refusal: "book-entry-exists" },
    ],
    projection: { sources: ["payment.transaction", "accounting.invoice", "accounting.adjustment"] },
    view: true,
})
