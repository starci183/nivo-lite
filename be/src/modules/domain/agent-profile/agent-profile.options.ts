import type { Type } from "@nestjs/common"
import type { AssignmentThreads } from "./agent-profile.port"

/** The options of the agent profile capability. */
export interface AgentProfileOptions {
    /** The class behind the work threads port (the thread-messages capability). */
    readonly threads: Type<AssignmentThreads>
}
