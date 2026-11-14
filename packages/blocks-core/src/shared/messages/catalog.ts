import type { NodeLocale } from "../nodes/node-schema.types"
import { BRAIN_FACT_MODEL_NOTES } from "../vocabulary/brain-fact-legend"
import en from "./en.json"
import samples from "./samples.json"
import vi from "./vi.json"
import words from "./words.json"

/** A key of the product copy catalog: every key has its words in Vietnamese and in English. */
export type MessageKey = keyof typeof vi

/** A key of the sample texts: Vietnamese customer words the examples and specs of the nodes use as data. */
export type SampleKey = keyof typeof samples

/** A key of the Vietnamese language data the policies read: unit words, letters. */
export type WordKey = keyof typeof words

/** A text in both product languages, the shape a spec text takes when the owner writes the words. */
export interface BilingualText {
    /** The Vietnamese words. */
    readonly vi: string
    /** The English words. */
    readonly en: string
}

const LINE_BREAK = "\n"

const BOOKS: Readonly<Record<NodeLocale, Readonly<Record<MessageKey, string>>>> = { vi, en }

/** The words of a key in one language. */
export const messageOf = (locale: NodeLocale, key: MessageKey): string => BOOKS[locale][key]

/** The English catalog read by any text, for a key that arrives as data (the title of an installed effect or tool). */
const ENGLISH: Readonly<Record<string, string>> = en

/**
 * The words a model reads for a text key of this library (the title of an effect or a tool), in English like every step goal, or
 * undefined when the catalog has no such key. A host hands it to the node runner so an agent is told what a tool does in words. The
 * truth reads carry how to read their facts after their words (`BRAIN_FACT_MODEL_NOTES`: the one legend text, which the gateway's
 * descriptions use too); a person reading the title never sees it.
 */
export const modelWordsOf = (key: string): string | undefined => {
    if (!Object.hasOwn(ENGLISH, key)) return undefined
    const note = Object.hasOwn(BRAIN_FACT_MODEL_NOTES, key) ? BRAIN_FACT_MODEL_NOTES[key] : undefined
    return note === undefined ? ENGLISH[key] : `${ENGLISH[key]}. ${note}`
}

/** The words of a key in both product languages. */
export const bilingualOf = (key: MessageKey): BilingualText => ({ vi: messageOf("vi", key), en: messageOf("en", key) })

/** The lines of a key whose words are a list, one entry per line, in one language. */
export const linesOf = (locale: NodeLocale, key: MessageKey): ReadonlyArray<string> =>
    messageOf(locale, key).split(LINE_BREAK)

/** The sample text of a key. */
export const sampleOf = (key: SampleKey): string => samples[key]

/** The language data of a key. */
export const wordOf = (key: WordKey): string => words[key]

/** The language data of a key whose words are a list, one entry per line. */
export const wordListOf = (key: WordKey): ReadonlyArray<string> => words[key].split(LINE_BREAK)

/** The words of a key known only by its name, derived by a convention such as `node<Id>Subtitle`; null when the catalog has none. */
export const messageNamed = (locale: NodeLocale, name: string): string | null => {
    const book: Readonly<Record<string, string>> = BOOKS[locale]
    return book[name] ?? null
}
