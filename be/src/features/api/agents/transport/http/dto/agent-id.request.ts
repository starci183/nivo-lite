import { IsUUID, MaxLength } from "class-validator"

/** The path parameter that names one agent. */
export class AgentIdRequest {
    /** The agent. */
    @IsUUID("4")
    @MaxLength(36)
    agentId!: string
}
