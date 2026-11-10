/**
 * What the thread runs need. Every workflow's new runs start on a LangGraph thread (the one engine): there is no list of workflows and
 * no default engine to choose any more.
 */
export interface AgentThreadsOptions {
    /** The most built graphs kept in memory (one per workflow version); the oldest leaves first. Absent takes the default. */
    readonly graphsMax?: number | undefined
    /** How long an approval stop waits before its deadline answers it `timeout`, milliseconds; absent takes 24 hours. */
    readonly approvalDeadlineMs?: number | undefined
    /** How long a stop for the founder (AI report, AI error) waits before its deadline, milliseconds; absent takes 3 days. */
    readonly ownerDeadlineMs?: number | undefined
    /**
     * True registers the people's doors to a stop (`StopDoorService`, `StopAnswersService`: a founder's words, buttons, cancel of a
     * thread run). They need the app's members, access and run cancel, so only the app that serves people (the api) sets it; the app's
     * config always does.
     */
    readonly doors?: boolean | undefined
}
