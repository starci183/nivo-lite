/** What the thread runs need: which workflows start their new runs on a LangGraph thread, and how many built graphs are kept. */
export interface AgentThreadsOptions {
    /**
     * The workflows whose NEW runs start on a thread, each as `<moduleKey>.<workflowKey>` (`chatbot.front-desk`). Empty: no run starts
     * on a thread and the engine behaves exactly as before. A run already started stays on the engine it started on, whatever this says.
     */
    readonly workflows: ReadonlyArray<string>
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
