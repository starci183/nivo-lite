import type { AuthorityActionRecord } from "@modules/domain/authority-actions"
import type { RuleMode } from "@modules/domain/authority-rules"
import { fold, hasWord } from "./owner-chat.policy"

/** The modes a rule can take. */
export const RULE_MODES: ReadonlyArray<RuleMode> = ["auto", "ask", "never"]

/** The words that name the order action. */
const ORDER_WORDS: ReadonlyArray<string> = ["don", "order"]

/**
 * Words that name each action in the owner's message, Vietnamese without accents and English; a rule change needs one of them.
 * The message is folded the same way before it is matched.
 */
const ACTION_WORDS: Readonly<Record<string, ReadonlyArray<string>>> = {
    reply_customer: ["tra loi khach", "tu van", "chatbot", "reply", "answer customer"],
    handoff_lead: ["chuyen lead", "chuyen cho sales", "handoff", "hand off", "lead"],
    classify_lead: ["phan loai", "classify"],
    send_follow_up: ["follow-up", "follow up", "followup", "theo doi", "nhan lai", "cham soc lai"],
    send_quote: ["bao gia", "quote"],
    confirm_order: ORDER_WORDS,
    send_care: ["cham soc", "care"],
    issue_invoice: ["hoa don", "invoice", "xuat hd"],
    reconcile_payment: ["doi soat", "thanh toan", "chuyen khoan", "payment", "reconcile"],
    send_email: ["gui email", "gui mail", "email khach", "send email", "email the customer"],
}

/** "over <amount> ... ask" (Vietnamese "tren / qua / hon / vuot ... hoi"): an amount threshold. */
const THRESHOLD = /(tren|qua|hon|vuot|over|above|more than)\s*[\d.,]+\s*(trieu|tr|m|k|nghin|million)?.*(hoi|ask)/

/** An amount limit named in the message ("duoi 20 trieu", "tren 1,5 ty", "over 20m"). */
const AMOUNT =
    /(?:duoi|tren|qua|toi da|toi|den|khong qua|hon|vuot|under|below|over|above|up to|max)\s*(\d+(?:[.,]\d+)?)\s*(ty|trieu|tr|m|k|nghin|ngan|million|billion)?/

/** The VND multiplier of an amount unit. */
const multiplierOf = (unit: string): number => {
    if (/ty|billion/.test(unit)) return 1e9
    if (/trieu|tr|m|million/.test(unit)) return 1e6
    if (/k|nghin|ngan/.test(unit)) return 1e3
    return 1
}

/** The message as rules are matched against it: lower case, no accents. */
export const saidOf = (text: string): string => fold(text)

/** The words that name an action: the known ones, else the registry labels of a newer module, folded. */
const wordsOf = (record: AuthorityActionRecord): ReadonlyArray<string> =>
    ACTION_WORDS[record.action] ?? [fold(record.label.vi), fold(record.label.en)]

/** Whether the message names the action. */
export const namesAction = (said: string, record: AuthorityActionRecord): boolean =>
    wordsOf(record).some((word) => hasWord(said, word))

/** Whether the message names the order action by its words, without the registry. */
export const namesOrder = (said: string): boolean => ORDER_WORDS.some((word) => hasWord(said, word))

/** Whether the message states "over <amount> ask me". */
export const isThresholdSaid = (said: string): boolean => THRESHOLD.test(said)

/** "duoi 20 trieu" / "tren 1,5 ty" / "over 20m" as VND; null when the message names no amount limit. */
export const amountIn = (said: string): number | null => {
    const match = AMOUNT.exec(said)
    if (match?.[1] === undefined) return null
    const vnd = Math.round(Number(match[1].replace(",", ".")) * multiplierOf(match[2] ?? ""))
    return Number.isFinite(vnd) && vnd > 0 ? vnd : null
}

/** A whole non-negative number the model returned, or null. */
export const wholeOf = (value: unknown): number | null =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : null

/** A text the model returned, trimmed, or blank. */
export const trimmed = (value: string | null | undefined): string => value?.trim() ?? ""

/** Lines joined after the stored ones, blanks dropped. */
export const appended = (stored: string | undefined, added: ReadonlyArray<string>): string =>
    [stored?.trim() ?? "", ...added].filter((line) => line !== "").join("\n")

/** The mode a model's rule asks for, when it is one. */
export const modeOf = (value: unknown): RuleMode | null => RULE_MODES.find((mode) => mode === value) ?? null
