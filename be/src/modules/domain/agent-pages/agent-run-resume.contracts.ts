/**
 * What resuming a parked run answers. No run is parked any more (every run is on a LangGraph thread, and a stopped thread run moves only
 * through its stop, answered with decideRunStop), so the answer is always `thread_run`.
 */
export interface AgentRunResumeAnswer {
    /** Always `thread_run`. */
    readonly kind: "thread_run"
    /** Never a step: nothing was resumed. */
    readonly stepKey: null
}
