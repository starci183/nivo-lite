import type { MessageFact } from "@nivo-lite/blocks-core"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"

/** The words of one catalogue key with no fill-in; empty when the key is missing (or its text still waits for a fill-in). */
export type WordsOfKey = (key: string) => string

/** The display name of a bank code, or the code itself (trimmed, upper case) when it is not listed. */
export type BankNameOf = (code: string) => string

/** The words the facts of an engine message are worded with. */
export interface FactWords {
    /** A catalogue word; empty when the catalogue has none for the key. */
    readonly text: WordsOfKey
    /** The display name of a bank. */
    readonly bankName: BankNameOf
}

/** Where fact words come from: the catalogue, the team's language and the bank names. */
export interface FactWordsSource {
    /** The message catalogue. */
    readonly catalog: MessageCatalog
    /** The team's language. */
    readonly locale: Locale
    /** The bank names (channel-connections `bankDisplayNameOf`). */
    readonly bankName: BankNameOf
}

/** The fact words of a catalogue in one language; a key the catalogue answers with the key itself is missing. */
export const factWordsOf = (source: FactWordsSource): FactWords => ({
    text: (key) => {
        const words = source.catalog.get(key, {}, source.locale)
        return words === key || words.includes("{{") ? "" : words
    },
    bankName: source.bankName,
})

/** The words of a key, or the fallback when the catalogue has none. */
export const wordOr = (words: FactWords, key: string, fallback: string): string => {
    const found = words.text(key)
    return found === "" ? fallback : found
}

/** The plain label of a fact by its label key; the label key itself when the catalogue has no word (never empty). */
const labelOf = (words: FactWords, label: string): string => wordOr(words, `teamChat.fact.${label}`, label)

/** A worded fact: a plain label and a readable value (marked `technical: false`, so it is never worded again). */
const worded = (words: FactWords, label: string, value: string): MessageFact => ({
    name: labelOf(words, label),
    value,
    technical: false,
})

/** A raw fact, folded under the technical details: a code, an id, the raw words of an error. */
const technical = (words: FactWords, label: string, value: string): MessageFact => ({
    name: labelOf(words, label),
    value,
    technical: true,
})

/**
 * The common words of an error code: the engine's own word for it (`teamChat.reason.<code>`), else the module's refusal text
 * (`errors.<code>`, when it needs no fill-in), else the common "system error" words. Never the code itself.
 */
export const reasonWordsOf = (words: FactWords, code: string): string =>
    wordOr(words, `teamChat.reason.${code}`, wordOr(words, `errors.${code}`, words.text("teamChat.reason.unknown")))

/** The facts of an error code: its common words as the reason (none without a catalogue), the code itself as a technical fact. */
export const codeFactsOf = (words: FactWords, code: string): ReadonlyArray<MessageFact> => {
    const reason = reasonWordsOf(words, code)
    return [...(reason === "" ? [] : [worded(words, "reason", reason)]), technical(words, "code", code)]
}

/** The facts of a customer channel: its name in words when it has one, else the raw id as a technical fact. */
export const channelFactOf = (words: FactWords, channel: string): MessageFact => {
    const name = words.text(`teamChat.channel.${channel}`)
    return name === "" ? technical(words, "channel", channel) : worded(words, "channel", name)
}

/** The names `stuckFactsOf` (agent-graphs `step-trouble.policy`) gives the engine's own facts of a stopped step. */
export const STUCK_FACT = {
    workflow: "workflow",
    step: "step",
    code: "code",
    error: "error",
    subject: "subject",
    run: "run",
    question: "question",
} as const

/** The facts of a step's data that name a bank: the code or the provider's spelling of it. */
const BANK_FACTS: ReadonlySet<string> = new Set(["bank", "bankCode", "bankName"])

/** The facts of a step's data whose value is already words for a person, by their label key. */
const PLAIN_FACTS: Readonly<Record<string, string>> = {
    orderNo: "orderNo",
    contactName: "customer",
    customerName: "customer",
    channel: "channel",
}

/** An amount in dong (`amountVnd`, `paidVnd`, ...). */
const AMOUNT_NAME = /Vnd$/u

/** A whole number as a person writes an amount (dot-grouped with the dong sign in Vietnamese). */
const amountWordsOf = (value: string, locale: Locale): string | null => {
    if (!/^-?\d{1,15}$/u.test(value.trim())) return null
    const amount = Number(value.trim())
    return `${new Intl.NumberFormat(locale === "en" ? "en-US" : "vi-VN").format(amount)} ₫`
}

/** What a stop card already names in words: its workflow, its step and its question. */
export interface StopFactContext {
    /** The workflow's title. */
    readonly workflowTitle: string
    /** The step's title (from the step's blocks-core messages). */
    readonly stepTitle: string
    /** The question of the card, or null. */
    readonly question: string | null
    /** The team's language. */
    readonly locale: Locale
}

/** One fact of a step's data in words: a bank by its name, an amount as money, a known plain value under its label; else technical. */
const dataFactOf = (words: FactWords, fact: MessageFact, locale: Locale): MessageFact => {
    if (BANK_FACTS.has(fact.name)) {
        const name = words.bankName(fact.value)
        return name === fact.value.trim().toUpperCase() ? technical(words, "bank", fact.value) : worded(words, "bank", name)
    }
    const amount = AMOUNT_NAME.test(fact.name) ? amountWordsOf(fact.value, locale) : null
    if (amount !== null) return worded(words, "amount", amount)
    const label = PLAIN_FACTS[fact.name]
    if (label === "channel") return channelFactOf(words, fact.value)
    return label === undefined ? { name: fact.name, value: fact.value, technical: true } : worded(words, label, fact.value)
}

/** The facts of one engine fact of a stopped step, worded and technical. */
const stuckFactOf = (words: FactWords, fact: MessageFact, context: StopFactContext): ReadonlyArray<MessageFact> => {
    switch (fact.name) {
        case STUCK_FACT.workflow:
            return context.workflowTitle === ""
                ? [technical(words, "workflowKey", fact.value)]
                : [worded(words, "workflow", context.workflowTitle), technical(words, "workflowKey", fact.value)]
        case STUCK_FACT.step:
            return context.stepTitle === ""
                ? [technical(words, "stepKey", fact.value)]
                : [worded(words, "step", context.stepTitle), technical(words, "stepKey", fact.value)]
        case STUCK_FACT.code:
            return codeFactsOf(words, fact.value)
        case STUCK_FACT.error:
            return [technical(words, "error", fact.value)]
        case STUCK_FACT.subject:
            return [technical(words, "subject", fact.value)]
        case STUCK_FACT.run:
            return [technical(words, "run", fact.value)]
        case STUCK_FACT.question:
            return fact.value === context.question ? [] : [worded(words, "question", fact.value)]
        default:
            return [dataFactOf(words, fact, context.locale)]
    }
}

/**
 * The facts of a stop card in words. The engine's facts (`stuckFactsOf`: workflow, step, code, error, subject, run, then the trouble's
 * data and the step's given values) become plain labels with worded values: the workflow and step by their titles, the error code by its
 * common words, a bank by its name, an amount as money, a known plain value under its label. Every raw value (the code, the step and
 * workflow keys, the raw error, ids, any data value with no mapping) is kept only as a `technical` fact. Worded facts come first. A fact
 * already worded (it carries `technical`, true or false) is kept as it is, so a card worded once is never worded twice.
 */
export const wordedStopFactsOf = (
    facts: ReadonlyArray<MessageFact>,
    context: StopFactContext,
    words: FactWords,
): ReadonlyArray<MessageFact> => {
    const all = facts.flatMap((fact) => (fact.technical === undefined ? stuckFactOf(words, fact, context) : [fact]))
    return [...all.filter((fact) => fact.technical !== true), ...all.filter((fact) => fact.technical === true)]
}
