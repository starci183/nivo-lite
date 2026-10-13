import { IsString, MaxLength } from "class-validator"

/** The bounded HTTP request that replaces the free texts of an agent. */
export class SetAgentTextsRequest {
    /** The instructions. */
    @IsString()
    @MaxLength(20000)
    instructions!: string

    /** The business notes. */
    @IsString()
    @MaxLength(50000)
    knowledge!: string
}
