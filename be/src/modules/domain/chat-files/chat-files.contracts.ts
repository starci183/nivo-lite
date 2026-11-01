/** The facts of a file the browser is about to upload; they are feedback only, the stored object is checked at send. */
export interface ChatFileFacts {
    /** The type the browser declares. */
    readonly contentType: string
    /** The size the browser declares, in bytes. */
    readonly sizeBytes: number
}

/** Where a file belongs: a conversation, or the Office of the workspace. */
export interface ChatFileScope {
    /** The workspace, whose folder holds the object. */
    readonly workspaceId: string
    /** The conversation, whose folder holds the object; null is the Office. */
    readonly conversationId: string | null
}

/** The turn that reads the file of a message, whoever sent it. */
export interface ChatFileTurn {
    /** The workspace. */
    readonly workspaceId: string
    /** The message of the turn, whoever wrote it; null when the wake names none. */
    readonly messageId: string | null
    /** The module of the agent, for the usage meter. */
    readonly module: string
}

/** A picture sent with a turn. */
export interface ChatTurnAttachment {
    /** The name of the file. */
    readonly fileName: string
    /** The type of the picture. */
    readonly mimeType: string
    /** The bytes, in base64. */
    readonly content: string
}

/** Where the browser PUTs one file. */
export interface ChatFileUpload {
    /** The object path to name when the message is sent. */
    readonly path: string
    /** The presigned address. */
    readonly signedUrl: string
}

/** A stored file proved to be what it claims: its bytes were read and its type comes from them, not from the browser. */
export interface VerifiedChatFile {
    /** The object path. */
    readonly path: string
    /** The name the sender gave it. */
    readonly name: string
    /** The type read from the bytes. */
    readonly contentType: string
    /** The stored size in bytes. */
    readonly sizeBytes: number
}

/** A file as a conversation shows it. */
export interface ChatFileView {
    /** The attachment. */
    readonly id: string
    /** The message it came with. */
    readonly messageId: string
    /** The name the sender gave it. */
    readonly name: string
    /** The type of the file. */
    readonly contentType: string
    /** A short-lived read address. */
    readonly url: string
}

/** What a turn read from a file about a money transfer; this is the customer's evidence, never money received. */
export interface ChatFileRead {
    /** True when the file shows a transfer, or could not be read and may show one. */
    readonly isTransfer: boolean
    /** The amount in dong, or null when it could not be read with certainty. */
    readonly amountVnd: number | null
    /** The receiving account or person as written, or null. */
    readonly recipient: string | null
    /** The time as written, or null. */
    readonly paidAt: string | null
}

/** The read of a message's file, or null when the message holds none. */
export type OptionalChatFileRead = ChatFileRead | null

/** The bytes of a file for a turn to read. */
export interface ChatFileBytes {
    /** The name the sender gave it. */
    readonly name: string
    /** The type of the file. */
    readonly contentType: string
    /** The bytes. */
    readonly bytes: Uint8Array
}

/** A stored file of a message with what was read from it so far. */
export interface StoredChatFile extends ChatFileBytes {
    /** The attachment. */
    readonly id: string
    /** What a turn read from it, or null before it was read. */
    readonly read: ChatFileRead | null
}

/** The first file of a message, or null when it holds none or the store no longer has it. */
export type OptionalStoredChatFile = StoredChatFile | null
