import type { Bilingual, BilingualList } from "./catalog.types"

/** A language of the product copy. */
export type CopyLocale = "vi" | "en"

/** The text of a bilingual pair in the reader language. */
export const pickCopy = (value: Bilingual, locale: CopyLocale): string => (locale === "en" ? value.en : value.vi)

/** The items of a bilingual list in the reader language. */
export const pickCopyList = (value: BilingualList, locale: CopyLocale): ReadonlyArray<string> =>
    locale === "en" ? value.en : value.vi
