import { IsOptional, IsString, MaxLength, MinLength } from "class-validator"

/** The bounded query that lists the agents of the caller's workspace. */
export class ListAgentsRequest {
    /** Only the agents of this module. */
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(60)
    module?: string
}
