import type { DbOutcome } from "@/modules/db/outcome"
import type { ConnectionCheck, TelegramConnected, WizardNote } from "@/modules/types"
import type { CatalogReader } from "@/hooks/connection-wizard"

/** The steps of the Telegram wizard, in order. */
export const TELEGRAM_STEPS = ["bot", "token", "check", "agent"] as const

/** The commands the connected entry hands the Telegram wizard (each one already knows the active workspace). */
export interface TelegramActions {
    readonly connect: (form: { readonly name: string; readonly token: string }) => Promise<DbOutcome<TelegramConnected>>
    readonly check: (connectionId: string) => Promise<DbOutcome<ConnectionCheck>>
    readonly setAgents: (connectionId: string, agents: ReadonlyArray<string>) => Promise<DbOutcome<true>>
}

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
