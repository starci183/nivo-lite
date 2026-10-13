/** Who speaks a line of the setup chat. */
export type SetupMessageRole = "user" | "assistant"

/** One line of the private chat between the owner and NIVO that sets an agent up. */
export interface SetupMessageRecord {
    /** The message. */
    readonly id: string
    /** The session it belongs to. */
    readonly setupSessionId: string
    /** Who speaks. */
    readonly role: SetupMessageRole
    /** The display name of the author. */
    readonly author: string
    /** The text. */
    readonly body: string
    /** When it was written, ISO 8601. */
    readonly createdAt: string
}

/** A message, or null when none matches. */
export type OptionalSetupMessageRecord = SetupMessageRecord | null

/** What storing a line takes. */
export interface NewSetupMessage {
    /** The workspace. */
    readonly workspaceId: string
    /** The session. */
    readonly setupSessionId: string
    /** Who speaks. */
    readonly role: SetupMessageRole
    /** The display name of the author. */
    readonly author: string
    /** The text. */
    readonly body: string
}
