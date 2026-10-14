import type { Locale } from "@modules/platform/i18n"
import type { Bilingual, BilingualList } from "../modules.contracts"
import vi from "../messages/vi.json"
import en from "../messages/en.json"

type CatalogCopyKey = keyof typeof vi

/** Reads a catalog message in its original language from the backend catalog. */
export const catalogCopy = (key: CatalogCopyKey, locale: Locale): string => (locale === "en" ? en[key] : vi[key])

/** Reads a catalog message in both product languages. */
export const catalogText = (key: CatalogCopyKey): Bilingual => ({ vi: vi[key], en: en[key] })

/** Reads the ordered items of a catalog list in both product languages. */
export const catalogList = (keys: ReadonlyArray<CatalogCopyKey>): BilingualList => ({
    vi: keys.map((key) => vi[key]),
    en: keys.map((key) => en[key]),
})
