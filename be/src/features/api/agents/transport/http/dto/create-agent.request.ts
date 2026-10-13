import { IsString, Matches, MaxLength, MinLength } from "class-validator"

/** The bounded HTTP request that adds an agent to the caller's workspace. */
export class CreateAgentRequest {
    /** The module the agent belongs to. */
    @IsString()
    @MinLength(1)
    @MaxLength(60)
    module!: string

    /** The display name. */
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    name!: string

    /** The @handle, lowercase letters, digits and dashes, free in the workspace. */
    @IsString()
    @Matches(/^[a-z0-9-]+$/)
    @MinLength(2)
    @MaxLength(40)
    handle!: string

    /** The one-line role. */
    @IsString()
    @MaxLength(300)
    role!: string

    /** The owner-facing instructions. */
    @IsString()
    @MaxLength(20000)
    instructions!: string
}
