import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator"

/** The bounded HTTP request of setWorkspacePlan. */
export class SetWorkspacePlanRequest {
    /** The plan to move to. */
    @IsString()
    @MinLength(1)
    @MaxLength(40)
    planCode!: string

    /** The workspace's own monthly credits; null clears it so the plan's applies. */
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(100000000)
    creditsLimit: number | null = null
}
