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
    /** The full session key, `agent:<agentId>:<conversation id>`. */
    readonly sessionKey: string
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

/** The claims of a tool token: bound to one job, hence to one workspace and one conversation. */
export interface ToolClaims {
    /** The engine job the token was minted for. */
    readonly jobId: string
    /** The workspace of the job. */
    readonly workspaceId: string
    /** The conversation of the job. */
    readonly conversationId: string
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
