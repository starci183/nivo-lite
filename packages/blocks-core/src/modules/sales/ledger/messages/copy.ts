import type { SpecText } from "@nivo-lite/agent-sdk/schema"
import en from "./en.json"
import vi from "./vi.json"

/** A key of the Accounting message catalogue (the Accounting and payment modules share the namespace `accounting`). */
export type AccountingKey = keyof typeof vi

/** The key as a spec text: the workbench resolves it through the catalogue in the viewer's language. */
export const textOf = (key: AccountingKey): SpecText => ({ key })

/** The words of a key in one language, for text that leaves the system (a message to a customer). */
export const copyOf = (key: AccountingKey, locale: "vi" | "en"): string => (locale === "en" ? en[key] : vi[key])
