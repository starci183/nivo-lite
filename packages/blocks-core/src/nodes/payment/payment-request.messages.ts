import { messageOf } from "../../messages/catalog"

/** The languages a payment request is written in. */
export type RequestLocale = "vi" | "en"

/** The lines of a payment request. */
export interface RequestWords {
    /** The opening line; takes `{{items}}` and `{{amount}}`. */
    readonly intro: string
    /** The bank line; takes `{{bank}}`. */
    readonly bank: string
    /** The account number line; takes `{{account}}`. */
    readonly account: string
    /** The account holder line; takes `{{holder}}`. */
    readonly holder: string
    /** The transfer content line; takes `{{content}}`. */
    readonly content: string
    /** The QR link line; takes `{{url}}`. */
    readonly qr: string
    /** The line sent when the order is recorded but the payment details cannot be given yet; takes `{{items}}` and `{{amount}}`. */
    readonly held: string
    /** The closing line. */
    readonly outro: string
    /** The currency suffix after an amount. */
    readonly currency: string
    /** The title of the owner work item raised without a SePay account; takes `{{order}}`. */
    readonly noAccount: string
}

const requestWordsOf = (locale: RequestLocale): RequestWords => ({
    intro: messageOf(locale, "paymentRequestIntro"),
    bank: messageOf(locale, "paymentRequestBank"),
    account: messageOf(locale, "paymentRequestAccount"),
    holder: messageOf(locale, "paymentRequestHolder"),
    content: messageOf(locale, "paymentRequestContent"),
    qr: messageOf(locale, "paymentRequestQr"),
    held: messageOf(locale, "paymentRequestHeld"),
    outro: messageOf(locale, "paymentRequestOutro"),
    currency: messageOf(locale, "paymentRequestCurrency"),
    noAccount: messageOf(locale, "paymentRequestNoAccount"),
})

/** The words of a payment request by language. */
export const REQUEST_WORDS: Readonly<Record<RequestLocale, RequestWords>> = {
    vi: requestWordsOf("vi"),
    en: requestWordsOf("en"),
}
