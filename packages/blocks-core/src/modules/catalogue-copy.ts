import type { Bilingual, BilingualList } from "@nivo-lite/agent-sdk/module"

/** The words of one module's catalogue template, read from its own message catalogue in the two product languages. */
export interface CatalogueCopy<K extends string> {
    /** One message in one language. */
    readonly one: (key: K, locale: "vi" | "en") => string
    /** One message in both product languages. */
    readonly text: (key: K) => Bilingual
    /** The ordered items of a list in both product languages. */
    readonly list: (keys: ReadonlyArray<K>) => BilingualList
}

/** The reader of a template's message catalogue: its Vietnamese and English words, keyed alike. */
export const catalogueCopyOf = <K extends string>(
    vi: Readonly<Record<K, string>>,
    en: Readonly<Record<K, string>>,
): CatalogueCopy<K> => ({
    one: (key, locale) => (locale === "en" ? en[key] : vi[key]),
    text: (key) => ({ vi: vi[key], en: en[key] }),
    list: (keys) => ({ vi: keys.map((key) => vi[key]), en: keys.map((key) => en[key]) }),
})
