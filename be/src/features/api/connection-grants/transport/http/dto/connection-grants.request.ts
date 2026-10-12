import { Type } from "class-transformer"
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsUUID, MaxLength, ValidateIf, ValidateNested } from "class-validator"

const LEVELS = ["read", "ask", "auto"] as const

/** The body of a single grant: the level, or null to remove the access. */
export class SetGrantRequest {
    /** The level to give, or null to remove the access. */
    @ValidateIf((body: SetGrantRequest) => body.access !== null)
    @IsIn(LEVELS)
    access!: "read" | "ask" | "auto" | null
}

/** One agent wanted on a connection. */
export class AgentGrantRequest {
    /** The agent. */
    @IsUUID()
    @MaxLength(36)
    agentId!: string

    /** The level; absent keeps the current one or starts at ask. */
    @IsOptional()
    @IsIn(LEVELS)
    access?: "read" | "ask" | "auto"
}

/** The body of the agents of a connection: exactly these agents. */
export class SetConnectionAgentsRequest {
    /** Exactly these agents use the connection. */
    @IsArray()
    @ArrayMaxSize(200)
    @ValidateNested({ each: true })
    @Type(() => AgentGrantRequest)
    agents!: Array<AgentGrantRequest>
}

/** One connection wanted for an agent. */
export class ConnectionGrantRequest {
    /** The connection. */
    @IsUUID()
    @MaxLength(36)
    connectionId!: string

    /** The level; absent keeps the current one or starts at ask. */
    @IsOptional()
    @IsIn(LEVELS)
    access?: "read" | "ask" | "auto"
}

/** The body of the connections of an agent: exactly these connections. */
export class SetAgentConnectionsRequest {
    /** Exactly these connections are used by the agent. */
    @IsArray()
    @ArrayMaxSize(200)
    @ValidateNested({ each: true })
    @Type(() => ConnectionGrantRequest)
    connections!: Array<ConnectionGrantRequest>
}
