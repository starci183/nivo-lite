import { defineAction } from "@nivo-lite/agent-sdk/block"
import type { ActionDefinition, ActionResult } from "@nivo-lite/agent-sdk/block"
import { outboxPort } from "@nivo-lite/agent-sdk/mutation"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { normalizeAdjustment } from "../../../rules/accounting/adjustment"
import { adjustTargetOf } from "../../../rules/accounting/entry-stages"
import { SOURCE_ADJUSTMENT } from "../../../rules/accounting/posting"
import { membersPort } from "../../platform/ports"
import { bookEntryById, targetExists } from "../accounting-data"
import { bookProjectJob } from "../jobs/book-project.job"
import { textOf } from "../messages/copy"
import { ADJUSTMENTS, BOOK, INVOICES, TRANSACTIONS } from "../ports"

/** The longest note the door accepts; the rule judges the length it needs. */
const NOTE_MAX = 2_000

/** Who a correction is written by when no seat of the workspace asked: the system. */
const SYSTEM = "system"

const input: z.ZodObject<{
    id: z.ZodString
    note: z.ZodString
    correctedAmount: z.ZodOptional<z.ZodNullable<z.ZodNumber>>
}> = z.object({
    id: z.string().min(1).max(MAX_ID),
    note: z.string().max(NOTE_MAX),
    correctedAmount: z.number().nullable().optional(),
})

const ports = {
    adjustments: ADJUSTMENTS,
    book: BOOK,
    invoices: INVOICES,
    transactions: TRANSACTIONS,
    members: membersPort,
    outbox: outboxPort,
}

/**
 * `accounting.adjust`: an accountant records a correction on an entry of the books, which lands on the invoice or the payment the
 * entry comes from (an entry that is itself a correction cannot be corrected). Corrections are append-only; the note and the amount
 * are judged by the rule, the record corrected must exist, and the write enqueues the book entry of the correction in the same
 * transaction. A refusal names the field that broke it.
 */
export const adjustAction: ActionDefinition = defineAction({
    id: "accounting.adjust",
    permission: "accounting.manage",
    label: textOf("adjust"),
    input,
    ports,
    transactional: true,
    refreshes: [
        "accounting.entries",
        "accounting.entry-counts",
        "accounting.status-counts",
        "accounting.weekly",
        "accounting.ledger",
        "accounting.decisions",
        "accounting.figures",
        "accounting.entry",
    ],
    run: async (
        { adjustments, book, invoices, transactions, members, outbox },
        given,
        context,
    ): Promise<ActionResult> => {
        const entry = await bookEntryById(book, given.id)
        if (entry === null) return { ok: false, reason: "refused", message: textOf("adjust_target_missing") }
        const target = adjustTargetOf(entry)
        if (target === null) return { ok: false, reason: "refused", message: textOf("adjust_entry_final") }
        const verdict = normalizeAdjustment({ ...target, note: given.note, correctedAmount: given.correctedAmount })
        if (!verdict.ok) {
            const message = textOf(verdict.reason === "note_length" ? "adjust_note_length" : "adjust_amount_invalid")
            const field = verdict.reason === "note_length" ? "note" : "correctedAmount"
            return { ok: false, reason: "invalid", message, fields: { [field]: message } }
        }
        if (!(await targetExists({ invoices, transactions }, target.targetType, target.targetId)))
            return { ok: false, reason: "refused", message: textOf("adjust_target_missing") }
        const memberId = context.memberId
        const member = memberId === null ? null : await members.get(memberId)
        const written = await adjustments.insert({
            ...verdict.adjustment,
            createdBy: member?.displayName ?? SYSTEM,
            createdByUser: member === null ? null : memberId,
        })
        if (!written.ok) return { ok: false, reason: "failed", message: textOf("adjust_failed") }
        await outbox.enqueue(
            bookProjectJob,
            { sourceEntity: SOURCE_ADJUSTMENT, sourceId: written.row.id },
            { dedupeKey: `book:${SOURCE_ADJUSTMENT}:${written.row.id}` },
        )
        return { ok: true, data: { id: written.row.id } }
    },
})
