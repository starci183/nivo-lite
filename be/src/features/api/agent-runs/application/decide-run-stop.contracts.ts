/** What decideRunStop takes: a person's decision on the stop of a run on a LangGraph thread. */
export interface DecideRunStopRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The run (the thread). */
    readonly runId: string
    /** The step whose stop is answered, or null for the run's open stop. */
    readonly stepKey: string | null
    /** `answer` (with words), `retry`, `take_over` or `skip`. */
    readonly action: string
    /** The founder's words, for `answer`; null otherwise. */
    readonly text: string | null
}
