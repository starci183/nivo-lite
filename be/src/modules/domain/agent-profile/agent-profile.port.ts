import type { AssignmentThread, AssignmentThreadInput } from "./agent-profile.contracts"

/**
 * The work threads capability (work-threads) as an assignment needs it. The app root binds it to the token
 * `AGENT_PROFILE_THREADS`; an app that binds none refuses an assignment instead of pretending one was made.
 */
export interface AssignmentThreads {
    /** Opens a thread whose first message is the request and which mentions the agent; answers the thread. */
    open(input: AssignmentThreadInput): Promise<AssignmentThread>
}
