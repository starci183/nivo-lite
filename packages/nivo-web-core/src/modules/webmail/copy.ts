import type { PluginMessages } from "@nivo-lite/agent-sdk/installation"
import type { Bilingual, BilingualList } from "@nivo-lite/agent-sdk/module"
import en from "./messages/en.json"
import vi from "./messages/vi.json"

/** A key of the Mailbox module's own copy. */
export type WebmailCopyKey = keyof typeof vi

/** One text of the module in one language. */
export const webmailCopy = (key: WebmailCopyKey, locale: "vi" | "en"): string => (locale === "en" ? en[key] : vi[key])

/** One text of the module in both product languages. */
export const webmailText = (key: WebmailCopyKey): Bilingual => ({ vi: vi[key], en: en[key] })

/** The ordered items of a list of the module in both product languages. */
export const webmailList = (keys: ReadonlyArray<WebmailCopyKey>): BilingualList => ({
    vi: keys.map((key) => vi[key]),
    en: keys.map((key) => en[key]),
})

/** The module's words as the plugin installs them under its namespace: what the workbench spec's text keys are read from. */
export const WEBMAIL_MESSAGES: PluginMessages = { vi, en }
