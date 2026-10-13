import { IsBoolean } from "class-validator"

/** The bounded HTTP request that pauses or resumes an agent. */
export class SetAgentStatusRequest {
    /** True to resume the agent, false to pause it. */
    @IsBoolean()
    active!: boolean
}
