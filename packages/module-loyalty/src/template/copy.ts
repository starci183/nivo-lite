import type { Bilingual, BilingualList } from "@nivo-lite/agent-sdk/module"
import en from "./messages/en.json"
import vi from "./messages/vi.json"

/** A key of the Loyalty template's own message catalogue. */
export type LoyaltyCopyKey = keyof typeof vi

/** One message of the template in its original language. */
export const loyaltyCopy = (key: LoyaltyCopyKey, locale: "vi" | "en"): string => (locale === "en" ? en[key] : vi[key])

/** One message of the template in both product languages. */
export const loyaltyText = (key: LoyaltyCopyKey): Bilingual => ({ vi: vi[key], en: en[key] })

/** The ordered items of a list of the template in both product languages. */
export const loyaltyList = (keys: ReadonlyArray<LoyaltyCopyKey>): BilingualList => ({
    vi: keys.map((key) => vi[key]),
    en: keys.map((key) => en[key]),
})
