import { Type } from "class-transformer"
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator"

/** The bounded HTTP query of list-till-members. */
export class ListTillMembersSearchRequest {
    /** The phone. */
    @IsOptional()
    @IsString()
    @MaxLength(30)
    phone?: string

    /** The limit. */
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(200)
    limit!: number
}
