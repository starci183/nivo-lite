import type { DomainError } from "@modules/platform/errors"

/** The error family the app uses for failures while reading a personal Telegram account. */
export interface TelegramUserErrors {
    /** Builds an error for a request the account or Telegram rejected. */
    readonly rejected: (detail: string, cause?: unknown) => DomainError<string>
    /** Builds an error for an unavailable deployment or Telegram service. */
    readonly unavailable: (detail: string, cause?: unknown) => DomainError<string>
    /** Recognizes an error already translated by this family. */
    readonly isError: (error: unknown) => error is DomainError<string>
}

/** What kind of chat a dialog is. */
export type TelegramChatKind = "user" | "group" | "channel"

/** One chat of the account, as the picker lists it. */
export interface TelegramChatChoice {
    /** The Telegram chat id, as a string (it can exceed a safe integer). */
    readonly id: string
    /** The chat title or the person's name. */
    readonly title: string
    /** The kind of chat. */
    readonly kind: TelegramChatKind
    /** How many unread messages it holds. */
    readonly unread: number
}

/** One message of a chat, reduced to what the hub stores. */
export interface TelegramRawMessage {
    /** The message id inside its chat. */
    readonly id: number
    /** Unix seconds. */
    readonly date: number
    /** The text, empty for a pure attachment. */
    readonly text: string
    /** Who wrote it. */
    readonly senderName: string
    /** The id of the message it answers, if any. */
    readonly replyToId: number | null
    /** True when it carries an attachment. */
    readonly hasMedia: boolean
}

/** What Telegram answered to a request for a login code. */
export interface TelegramCodeSent {
    /** The hash that ties the code to the request. */
    readonly phoneCodeHash: string
    /** The temporary session of the half finished login. */
    readonly session: string
    /** True when the code went to the Telegram app, false when it went by SMS. */
    readonly viaApp: boolean
}

/** What Telegram answered to a request for a fresh code. */
export interface TelegramCodeResent {
    /** The new hash. */
    readonly phoneCodeHash: string
    /** The temporary session. */
    readonly session: string
}

/** Who the logged in account is. */
export interface TelegramAccount {
    /** First and last name, may be empty. */
    readonly displayName: string
    /** The @username without the at sign, if any. */
    readonly username: string | null
}

/** The step after a code: the account needs its two-step password, or it is logged in. */
export type TelegramSignInResult =
    | { readonly kind: "password"; readonly session: string }
    | { readonly kind: "ready"; readonly session: string; readonly account: TelegramAccount }

/** What a completed login holds. */
export interface TelegramLoggedIn {
    /** The final session. */
    readonly session: string
    /** Who logged in. */
    readonly account: TelegramAccount
}

/** What reading the new messages of the picked chats takes. */
export interface TelegramReadRequest {
    /** The final session. */
    readonly session: string
    /** The picked chat ids. */
    readonly chatIds: ReadonlyArray<string>
    /** The last stored message id per chat id (absent or 0 when none). */
    readonly cursors: ReadonlyMap<string, number>
    /** Unix seconds of the first sync window. */
    readonly sinceUnix: number
    /** The most messages read from one chat in one run. */
    readonly perChatLimit: number
    /** True once the run's time budget is spent. */
    readonly isExpired: () => boolean
}

/** The new messages of one chat. */
export interface TelegramChatRead {
    /** The chat id. */
    readonly chatId: string
    /** The messages worth storing (service messages are left out). */
    readonly messages: ReadonlyArray<TelegramRawMessage>
    /** The highest message id seen, service messages included. */
    readonly maxId: number
    /** True when the per-run limit was reached and older messages remain. */
    readonly capped: boolean
}

/** A login in progress: the temporary session and the code request it belongs to. */
export interface TelegramLoginSession {
    /** The temporary session. */
    readonly session: string
    /** The phone in E.164. */
    readonly phone: string
    /** The hash of the code request. */
    readonly phoneCodeHash: string
}

/** A login in progress and the code the owner typed. */
export interface TelegramCodeSubmission extends TelegramLoginSession {
    /** The digits of the code. */
    readonly code: string
}

/** A login that waits for the two-step verification password. */
export interface TelegramPasswordSubmission {
    /** The temporary session. */
    readonly session: string
    /** The password; used once and never kept. */
    readonly password: string
}
