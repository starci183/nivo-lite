/** Log events of the LangGraph integration. Fields name the thread, a version, a position; never a state value, a question or an answer. */
export enum LanggraphLogEvent {
    /** A graph was compiled for a workflow version (`version`, `nodes`, `kept`): once per version per process. */
    GraphCompiled = "langgraph.graph.compiled",
    /** A second drive of a thread was turned away while the first runs in this process (`thread`, `call`). */
    ThreadBusy = "langgraph.thread.busy",
    /** A restarted node left its record of finished calls (`thread`, `position`, `why`); the rest of that run was made live. */
    ReplayLeft = "langgraph.replay.left",
}
