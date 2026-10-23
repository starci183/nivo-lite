import type { AssignmentThread, AssignmentThreadInput, AssignmentWorkStart } from "./agent-profile.contracts"

/**
 * The work threads capability (work-threads) as an assignment needs it. The app root binds it to the token
 * `AGENT_PROFILE_THREADS` (ThreadAssignmentsService of thread-messages).
 */
export interface AssignmentThreads {
    /** Opens a thread whose first message is the request and which mentions the agent; answers the thread. */
    open(input: AssignmentThreadInput): Promise<AssignmentThread>
}

/**
 * The agents' runtime in work threads (thread-work) as an assignment needs it: the agent starts the structured work in the thread
 * the assignment opened. The app root binds it to the token `AGENT_PROFILE_WORK` (ThreadWorkService of thread-work).
 */
export interface AssignmentWork {
    /** Starts the work; the action must belong to the department of the agent. */
    start(input: AssignmentWorkStart): Promise<void>
}
