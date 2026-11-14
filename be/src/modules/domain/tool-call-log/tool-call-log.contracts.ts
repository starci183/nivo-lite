/** One audit line of a gateway call, already masked by the gateway. */
export interface CallLogLine {
    /** The workspace. */
    readonly workspaceId: string
    /** The connector key. */
    readonly connector: string
    /** The full tool name. */
    readonly tool: string
    /** The agent. */
    readonly agentId: string | null
    /** The conversation the call served, or null. */
    readonly conversationId: string | null
    /** The work item the call served, or null. */
    readonly workItemId: string | null
    /** The masked arguments as JSON text. */
    readonly argsMaskedJson: string
    /** The sha256 of the canonical real arguments. */
    readonly argsHash: string
    /** `ok`, `error`, `refused`, `approval`, `timeout` or `circuit_open`. */
    readonly outcome: string
    /** The failure code, or null. */
    readonly errorCode: string | null
    /** The masked summary of the result. */
    readonly resultSummary: string
    /** How long it took, milliseconds. */
    readonly durationMs: number
    /** Who approved it, or null. */
    readonly approvedBy: string | null
    /** The run (the agent turn) the call was made in, when the caller names one; absent or null otherwise. */
    readonly runId?: string | null
    /** The truths a truth-graph read served, `{ factId, version }` in answer order; absent or null for any other call. */
    readonly factReads?: ReadonlyArray<TruthReadLine> | null
    /**
     * Where the call came from, as its caller stated it: `node` for a workflow step, else the road outside every node (`mcp_endpoint`,
     * `work_item`, `accounting_desk`, `document_reader`, `engine_job`); absent or null for a caller that stated none.
     */
    readonly originKind?: string | null
    /** The key of the graph node whose step made the call; absent or null for a call outside a node. */
    readonly nodeKey?: string | null
    /** The workflow of that node, or absent or null (a call outside a node, a run of the agent's own graph no workflow took). */
    readonly workflowId?: string | null
    /** The version the run of that node is pinned to; absent or null for a call outside a node. */
    readonly workflowVersionId?: string | null
    /** The records an `ok` read answered, as its adapter stated them in its structured answer; absent or null when it stated none. */
    readonly recordsRead?: number | null
    /** The records an `ok` write changed, as its adapter stated them; absent or null when it stated none. */
    readonly recordsChanged?: number | null
    /** The connected account the call acted on, as the tool runner handed it; absent or null when it handed none. */
    readonly connectionId?: string | null
    /** That account's provider key; absent or null when the runner handed no account. */
    readonly provider?: string | null
    /** Which try of the call this line is, from 1; absent or null when the runner handed no account. */
    readonly attempt?: number | null
    /** How the account was chosen (`data_owner`, `order`, `fallback`); absent or null when the runner chose none. */
    readonly chosenBy?: string | null
    /** The API key an outbound MCP call was made with; absent or null for any other caller. */
    readonly apiKeyId?: string | null
    /** The account the call ran as (the key's holder on the outbound MCP endpoint); absent or null for any other caller. */
    readonly actorUserId?: string | null
}

/**
 * The records the `ok` calls of one run or one window touched: the sums of the counts their adapters stated, and how many `ok` calls
 * stated none. A count no call stated is null (the desk draws a dash); no call at all is 0.
 */
export interface CallRecordsTally {
    /** The run, for a tally per run; null for a window. */
    readonly runId: string | null
    /** The records read, or null when calls were made and none stated a read count. */
    readonly read: number | null
    /** The records changed, or null when calls were made and none stated a change count. */
    readonly changed: number | null
    /** The `ok` calls whose adapter stated no count. */
    readonly uncounted: number
}

/** The `ok` calls of one agent in a window of time, as the desk's day reads them. */
export interface CallRecordsWindow {
    /** The workspace. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The start, inclusive. */
    readonly from: Date
    /** The end, exclusive. */
    readonly to: Date
}

/** One truth a read served: the fact and the version of it the agent read. */
export interface TruthReadLine {
    /** The fact. */
    readonly factId: string
    /** Its version when it was read, or null. */
    readonly version: number | null
}

/** The truth-graph reads of one run, oldest first: which tool, when, and the truths it served. */
export interface RunTruthReads {
    /** The audit line. */
    readonly id: string
    /** The full tool name (`nivo.tool.brain.search`...). */
    readonly tool: string
    /** When it was read. */
    readonly at: Date
    /** The truths served, in answer order. */
    readonly facts: ReadonlyArray<TruthReadLine>
}

/** Which audit lines to read: the newest of a workspace, at most `limit`. */
export interface CallLogPage {
    /** The workspace. */
    readonly workspaceId: string
    /** How many lines, already bounded by the caller. */
    readonly limit: number
}

/** One audit line as the console reads it, with the agent name. */
export interface CallLogRecord {
    /** The line. */
    readonly id: string
    /** The full tool name. */
    readonly tool: string
    /** The agent name, or empty. */
    readonly agent_name: string
    /** The outcome. */
    readonly outcome: string
    /** The failure code, or null. */
    readonly error_code: string | null
    /** The masked arguments as JSON text. */
    readonly args_masked: string
    /** The masked result summary. */
    readonly result_summary: string
    /** How long it took, milliseconds. */
    readonly duration_ms: number
    /** Who approved, or null. */
    readonly approved_by: string | null
    /** When it was written. */
    readonly created_at: Date | string
}
