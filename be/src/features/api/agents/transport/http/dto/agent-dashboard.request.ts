import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator"

/** The bounded query that names the dashboard of one module's agent. */
export class AgentDashboardRequest {
    /** The module whose dashboard it is. */
    @IsString()
    @MinLength(1)
    @MaxLength(60)
    module!: string

    /** The instance whose dashboard it is; the first of the module when absent. */
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    installationId?: string
}
