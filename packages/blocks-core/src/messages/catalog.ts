import type { NodeLocale } from "../nodes/node-schema.types"
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
