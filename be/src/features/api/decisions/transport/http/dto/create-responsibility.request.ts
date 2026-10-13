import { IsISO8601, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator"

/** The bounded HTTP request that adds a responsibility for a customer. */
export class CreateResponsibilityRequest {
    /** The customer. */
    @IsUUID("4")
    @MaxLength(36)
    lead_id!: string

    /** What it is. */
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    title!: string

    /** `human`, or the id of the owning agent. */
    @IsString()
    @MinLength(1)
    @MaxLength(36)
    owner!: string

    /** The next step. */
    @IsString()
    @MinLength(1)
    @MaxLength(400)
    next_action!: string

    /** When it is due, ISO 8601; null for no date. */
    @IsOptional()
    @IsISO8601({ strict: true })
    @MaxLength(40)
    due_at: string | null = null
}
