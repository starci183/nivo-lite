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

/** Prefixes that introduce an amount threshold or limit. */
const THRESHOLD_PREFIX = /tren|qua|hon|vuot|over|above|more than/g
const AMOUNT_PREFIX = /duoi|tren|qua|toi da|toi|den|khong qua|hon|vuot|under|below|over|above|up to|max/g
const NUMBER = /^\s*(\d+(?:[.,]\d+)?)\s*/
const UNIT = /^(ty|trieu|tr|m|k|nghin|ngan|million|billion)/
const THRESHOLD_NUMBER = /^\s*[\d.,]+/

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
export const isThresholdSaid = (said: string): boolean => {
    const candidates: Array<number> = []
    for (const prefix of said.matchAll(THRESHOLD_PREFIX)) {
        const start = prefix.index + prefix[0].length
        const number = THRESHOLD_NUMBER.exec(said.slice(start))
        if (number === null) continue
        const end = start + number[0].length
        const spaces = /^\s*/.exec(said.slice(end))?.[0].length ?? 0
        candidates.push(end + spaces)
    }
    // Candidate positions are ordered. Once a line break passes one, only later candidates can match.
    let candidate = 0
    let lineStart = 0
    for (const token of said.matchAll(/hoi|ask|[\n\r\u2028\u2029]/g)) {
        if (token[0].length === 1) {
            lineStart = token.index + 1
            continue
        }
        while (candidate < candidates.length && (candidates[candidate] ?? 0) < lineStart) candidate++
        const start = candidates[candidate]
        if (start !== undefined && start <= token.index) return true
    }
    return false
}

/** "duoi 20 trieu" / "tren 1,5 ty" / "over 20m" as VND; null when the message names no amount limit. */
export const amountIn = (said: string): number | null => {
    for (const prefix of said.matchAll(AMOUNT_PREFIX)) {
        const tail = said.slice(prefix.index + prefix[0].length)
        const match = NUMBER.exec(tail)
        if (match?.[1] === undefined) continue
        const unit = UNIT.exec(tail.slice(match[0].length))?.[1] ?? ""
        const vnd = Math.round(Number(match[1].replace(",", ".")) * multiplierOf(unit))
        return Number.isFinite(vnd) && vnd > 0 ? vnd : null
    }
    return null
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
