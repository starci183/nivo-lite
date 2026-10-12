/** What a finished run cost, summed over its assistant messages: prompt tokens include the cached ones. */
export interface RunUsage {
    /** Prompt tokens, cached ones included. */
    readonly prompt_tokens: number
    /** Completion tokens. */
    readonly completion_tokens: number
    /** Prompt tokens served from the cache. */
    readonly cached_tokens: number
    /** The provider cost of the run. */
    readonly cost: number
    /** Who served the run, `provider/model`. */
    readonly model: string | null
}

/** The answer of one turn: the text, what it cost and where the time went. */
export interface TurnResult {
    /** The final assistant text. */
    readonly text: string
    /** The usage, or null when the gateway reported none. */
    readonly usage: RunUsage | null
    /** Milliseconds from the start of the turn to each named mark. */
    readonly timings: Readonly<Record<string, number>>
}

/** One turn to run on the gateway. */
export interface TurnRequest {
    /** Decides when an assistant text is final. Default: the JSON contract answer or a message that stopped normally. */
    readonly isFinal?: (text: string) => boolean
    /** The agent that answers. */
    readonly agentId: string
    /** The full thread key, `agent:<agentId>:<conversation id>`. */
    readonly threadKey: string
    /** The text sent to the agent. */
    readonly message: string
    /** Makes a retried send a no-op on the gateway. */
    readonly idempotencyKey: string
    /** How long the turn may take, ms. */
    readonly timeoutMs: number
}

/** The files of one agent workspace. */
export interface SyncFile {
    /** The path inside the workspace, relative. */
    readonly path: string
    /** The file text. */
    readonly content: string
}

/** The recorded size and hash of one synced file. */
export interface FileMeta {
    /** The path inside the workspace. */
    readonly path: string
    /** The byte length of the content. */
    readonly bytes: number
    /** The sha256 of the content, hex. */
    readonly sha256: string
}

/** What one write of a bundle changed. */
export interface WorkspaceWriteResult {
    /** How many files were created or rewritten. */
    readonly written: number
    /** How many managed files the bundle no longer has were removed. */
    readonly removed: number
}

/** What a tool token is minted for: one job, hence one workspace and one conversation. */
export interface ToolTokenSubject {
    /** The job the token belongs to. */
    readonly jobId: string
    /** The workspace of the job. */
    readonly workspaceId: string
    /** The conversation of the job. */
    readonly conversationId: string
}

/** The claims of a tool token: its subject and an expiry. */
export interface ToolClaims extends ToolTokenSubject {
    /** Expiry, unix seconds. */
    readonly exp: number
}

/** The two directories of one agent workspace: the process view and the gateway view. */
export interface WorkspaceDirs {
    /** The directory as this process sees it. */
    readonly local: string
    /** The directory as the gateway sees it. */
    readonly gateway: string
}

/** One agent entry of `agents.list` in openclaw.json: only the keys this process owns are typed, anything else stays untouched. */
export interface AgentEntry {
    /** The agent id. */
    readonly id: string
    /** The display name. */
    readonly name?: string
    /** The workspace directory as the gateway sees it. */
    readonly workspace?: string
    /** True on the default agent. */
    readonly default?: boolean
    /** Every other key of the entry. */
    readonly [key: string]: unknown
}

/** A JSON object whose members are not known. */
export interface JsonObject {
    /** Any member. */
    readonly [key: string]: unknown
}

/** The directories of an agent workspace, or null when no config directory is set. */
export type OptionalWorkspaceDirs = WorkspaceDirs | null

/** A parsed JSON object, or null when the text was not readable JSON. */
export type OptionalJsonObject = JsonObject | null

/** The claims of a valid tool token, or null when the token is not valid. */
export type VerifiedToolClaims = ToolClaims | null

/** The text of a file, or null when the file does not exist. */
export type OptionalText = string | null

/** The running sum of the usage of a turn, before it is reported as a RunUsage. */
export interface RunTally {
    /** Input tokens. */
    input: number
    /** Output tokens. */
    output: number
    /** Tokens read from the cache. */
    cacheRead: number
    /** Tokens written to the cache. */
    cacheWrite: number
    /** The summed cost. */
    cost: number
    /** The last model that served a message, or null. */
    model: string | null
    /** True once a message carried usage. */
    seen: boolean
}
