import { z } from "zod"
import { MAX_ENTRIES, MAX_ID, MAX_LINE } from "../../bounds"
import { SHOP_OFFSET_MS } from "./shop-time"

/** The questions queue as the questions read answers it: how many wait and the rows to answer. */
export interface QuestionsRecord {
    /** The count the chip shows; null when no question waits. */
    readonly count: string | null
    /** The questions, oldest first. */
    readonly rows: ReadonlyArray<QuestionRecord>
}

/** One question the accounting department asked the owner. */
export interface QuestionRecord {
    /** The question id, and the record the answer is made on. */
    readonly id: string
    /** The question. */
    readonly title: string
    /** The entry or order the question is about; empty when it is about none. */
    readonly description: string
    /** When it was asked, ISO text; absent when the read does not say. */
    readonly askedAt?: string | undefined
}

/** The questions the read answers, judged by the fields the list draws; a row that does not fit is a failed read. */
export const questionsRecord: z.ZodType<QuestionsRecord> = z.looseObject({
    count: z.string().max(MAX_ID).nullable(),
    rows: z
        .array(
            z.looseObject({
                id: z.string().min(1).max(MAX_ID),
                title: z.string().max(MAX_LINE),
                description: z.string().max(MAX_LINE),
                askedAt: z.string().max(MAX_ID).optional(),
            }),
        )
        .max(MAX_ENTRIES),
})

/** One question as the list draws it. */
export interface QuestionRow {
    /** The key of the row, and the question an answer is made on. */
    readonly id: string
    /** The question. */
    readonly question: string
    /** The entry or order it is about; empty draws none. */
    readonly source: string
    /** When it was asked, written day/month hour:minute on the shop's wall; empty when unknown. */
    readonly asked: string
}

const two = (value: number): string => String(value).padStart(2, "0")

/** An instant written day/month hour:minute on the shop's wall (`04/11 09:12`); empty for text that is no instant. */
export const askedAtOf = (instant: string | undefined): string => {
    const at = Date.parse(instant ?? "")
    if (Number.isNaN(at)) return ""
    const shop = new Date(at + SHOP_OFFSET_MS)
    return `${two(shop.getUTCDate())}/${two(shop.getUTCMonth() + 1)} ${two(shop.getUTCHours())}:${two(shop.getUTCMinutes())}`
}

/** The rows of the questions list. */
export const questionRowsOf = (record: QuestionsRecord): ReadonlyArray<QuestionRow> =>
    record.rows.map((row) => ({
        id: row.id,
        question: row.title,
        source: row.description,
        asked: askedAtOf(row.askedAt),
    }))

/** The answer text to send: trimmed, or null when nothing was written. */
export const answerOf = (draft: string): string | null => {
    const trimmed = draft.trim()
    return trimmed === "" ? null : trimmed
}
