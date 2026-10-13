import { IsUUID, MaxLength } from "class-validator"

/** The path parameters that name one agent and one of its connections. */
export class AgentConnectionIdRequest {
    /** The agent. */
    @IsUUID("4")
    @MaxLength(36)
    agentId!: string

    /** The connection. */
    @IsUUID("4")
    @MaxLength(36)
    connectionId!: string
}
