import { IsString, Matches, MaxLength, MinLength } from "class-validator"

/** The bounded HTTP request that upgrades the plan of the workspace. */
export class UpgradePlanRequest {
    /** The plan to move to. */
    @IsString()
    @MinLength(1)
    @MaxLength(40)
    @Matches(/^[a-z0-9_-]+$/)
    planCode!: string
}
