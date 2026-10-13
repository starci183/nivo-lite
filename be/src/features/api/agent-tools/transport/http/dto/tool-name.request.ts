import { IsString, Matches, MaxLength, MinLength } from "class-validator"

/** The path parameter that names the tool being called. */
export class ToolNameRequest {
    /** The dotted tool name. */
    @IsString()
    @Matches(/^[a-z_]+(\.[a-z_]+)*$/)
    @MinLength(1)
    @MaxLength(60)
    tool!: string
}
