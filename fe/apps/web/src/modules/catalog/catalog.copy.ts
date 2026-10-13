import { MODULE_REGISTRY } from "./catalog.registry"
import type { ModuleKey } from "./catalog.keys"
import type { Bilingual, BilingualList } from "./catalog.types"

/** A language of the product copy. */
export type CopyLocale = "vi" | "en"

/** The text of a bilingual pair in the reader language. */
export const pickCopy = (value: Bilingual, locale: CopyLocale): string => (locale === "en" ? value.en : value.vi)

/** The items of a bilingual list in the reader language. */
export const pickCopyList = (value: BilingualList, locale: CopyLocale): ReadonlyArray<string> =>
    locale === "en" ? value.en : value.vi

/** The full name of a module in the reader language. */
export const agentTypeName = (key: ModuleKey, locale: CopyLocale): string => pickCopy(MODULE_REGISTRY[key].name, locale)
