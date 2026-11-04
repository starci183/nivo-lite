import { messageOf } from "../../messages/catalog"
import type { MissingReason } from "./order.schema"

/** The languages the customer is asked in. */
export type AskLocale = "vi" | "en"

/** The words of a question for what an order lacks: the opening line and one line per reason. */
export interface AskWords {
    /** The opening line. */
    readonly intro: string
    /** One line per reason; `{{item}}` is the item the gap is about. */
    readonly reasons: Readonly<Record<MissingReason, string>>
}

const askWordsOf = (locale: AskLocale): AskWords => ({
    intro: messageOf(locale, "askIntro"),
    reasons: {
        no_items: messageOf(locale, "askNoItems"),
        not_in_catalogue: messageOf(locale, "askNotInCatalogue"),
        no_price: messageOf(locale, "askNoPrice"),
        no_address: messageOf(locale, "askNoAddress"),
    },
})

/** The words by language. They ask; they promise nothing about payment, delivery or time. */
export const ASK_WORDS: Readonly<Record<AskLocale, AskWords>> = { vi: askWordsOf("vi"), en: askWordsOf("en") }
