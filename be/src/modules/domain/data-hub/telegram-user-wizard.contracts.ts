import type { TelegramChatKind } from "@modules/integrations/data-sources"
import type { DataConnection } from "./data-hub.contracts"

/** A chat the owner ticked. */
export interface PickedChat {
    /** The Telegram chat id. */
    readonly id: string
    /** The title shown. */
    readonly title: string
    /** The kind of chat. */
    readonly kind: TelegramChatKind
}

/** How far back the first sync reaches. */
export type SinceDays = 7 | 30

/** The saved choice of chats. */
export interface TelegramConfig {
    /** The ticked chats. */
    readonly chats: ReadonlyArray<PickedChat>
    /** The first window in days. */
    readonly sinceDays: SinceDays
}

/** The two login steps that wait for the owner. */
export type TelegramLoginStage = "code" | "password"

/** The state of a login in progress, kept only in the sealed credential. */
export interface TelegramLoginState {
    /** What the login waits for. */
    readonly stage: TelegramLoginStage
    /** The phone in E.164. */
    readonly phone: string
    /** The hash of the code request. */
    readonly phoneCodeHash: string
    /** The temporary session. */
    readonly session: string
    /** Epoch milliseconds when the login started. */
    readonly startedAt: number
}

/** The sealed credential of a Telegram connection. */
export interface TelegramCredential {
    /** The final session, once logged in. */
    readonly session?: string
    /** The login in progress. */
    readonly login?: TelegramLoginState
}

/** Where the wizard continues. */
export interface TelegramSetupState {
    /** The connection name. */
    readonly name: string
    /** Pending, connected or error. */
    readonly status: "pending" | "connected" | "error"
    /** The login step, or ready when logged in. */
    readonly stage: TelegramLoginStage | "ready"
    /** The saved chats, null when none were saved. */
    readonly config: TelegramConfig | null
    /** The schedule in minutes, null is manual. */
    readonly everyMinutes: number | null
    /** True when the consent was recorded. */
    readonly consent: boolean
}

/** What starting a login takes. */
export interface TelegramLoginDraft {
    /** The connection name. */
    readonly name: string
    /** The phone as typed. */
    readonly phone: string
    /** True when the owner agreed to the commitment text. */
    readonly consent: boolean
    /** A pending connection to reuse (a corrected number). */
    readonly connectionId?: string | null | undefined
}

/** What starting a login answers. */
export interface TelegramLoginStarted {
    /** The pending connection. */
    readonly connectionId: string
    /** True when the code went to the Telegram app. */
    readonly viaApp: boolean
}

/** What saving the setup takes. */
export interface SaveTelegramSetupInput {
    /** The connection. */
    readonly connectionId: string
    /** The ticked chats. */
    readonly chats: ReadonlyArray<PickedChat>
    /** The first window. */
    readonly sinceDays: number
    /** The schedule, null or absent is manual. */
    readonly everyMinutes?: number | null | undefined
}

/** Where a login stands after a step. */
export interface TelegramLoginProgress {
    /** password when two-step verification is needed, ready when logged in. */
    readonly stage: TelegramLoginStage | "ready"
}

/** The code the owner typed for a pending login. */
export interface TelegramCodeEntry {
    /** The pending connection. */
    readonly connectionId: string
    /** The code as typed. */
    readonly code: string
}

/** The two-step password the owner typed for a pending login. */
export interface TelegramPasswordEntry {
    /** The pending connection. */
    readonly connectionId: string
    /** The password; used once and never stored. */
    readonly password: string
}

/** A pending connection and its login state. */
export interface PendingTelegramLogin {
    /** The pending connection. */
    readonly connection: DataConnection
    /** Its login state. */
    readonly login: TelegramLoginState
}
