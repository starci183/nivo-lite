import { IsString, MaxLength, MinLength } from "class-validator"

/** The bounded HTTP request that renames an agent. */
export class RenameAgentRequest {
    /** The new display name. */
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    name!: string
}
