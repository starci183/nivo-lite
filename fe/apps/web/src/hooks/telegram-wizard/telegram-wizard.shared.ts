import type { ConnectionCheck, WizardNote } from "@/modules/types"
import type { CatalogReader } from "@/hooks/connection-wizard"

/** The steps of the Telegram wizard, in order. */
export const TELEGRAM_STEPS = ["bot", "token", "check", "agent"] as const

/** What a Telegram check says, as one note: local site, webhook registered, or what Telegram last complained about. */
export const checkNoteOf = (state: ConnectionCheck, tc: CatalogReader): WizardNote => {
    if (state.localOnly) return { tone: "informative", text: tc("checkLocal") }
    if (state.webhookOk && state.lastError === null)
        return { tone: "affirmative", text: tc("checkOk", { pending: state.pending }) }
    return {
        tone: "negative",
        text: state.lastError === null ? tc("checkNotRegistered") : tc("checkLastError", { error: state.lastError }),
    }
}
