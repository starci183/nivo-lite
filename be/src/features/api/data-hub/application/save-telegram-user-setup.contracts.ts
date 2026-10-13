import type { PickedChat } from "@modules/domain/data-hub"

/** What saveTelegramUserSetup takes. */
export interface SaveTelegramUserSetupRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The Telegram connection. */
    readonly connectionId: string
    /** The ticked chats. */
    readonly chats: ReadonlyArray<PickedChat>
    /** The first window in days, 7 or 30. */
    readonly sinceDays: number
    /** Minutes between syncs, 15 or 60; null is manual. */
    readonly everyMinutes?: number | null | undefined
}
