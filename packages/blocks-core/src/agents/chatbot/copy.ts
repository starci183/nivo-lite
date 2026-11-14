import type { SpecLocale, SpecText } from "@nivo-lite/agent-sdk/schema"
import * as en from "./messages/en.json"
import * as vi from "./messages/vi.json"

/** A key of the Chatbot module's own message catalogue. */
export type ChatbotCopyKey = Exclude<keyof typeof vi, "default">

/** One message of the module in a product language. */
export const chatbotCopy = (key: ChatbotCopyKey, locale: SpecLocale): string => (locale === "en" ? en[key] : vi[key])

/** The words of a key as a spec text: the host resolves it in the viewer's language. */
export const chatbotText = (key: ChatbotCopyKey): SpecText => ({ key })

/** The keys of one language of the catalogue, to prove the two languages hold the same ones. */
export const chatbotCopyKeys = (locale: SpecLocale): ReadonlyArray<string> =>
    Object.keys(locale === "en" ? en : vi).filter((key) => key !== "default")
