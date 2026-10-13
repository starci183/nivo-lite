import { IsISO8601, IsString, Matches, MaxLength, MinLength, ValidateIf } from "class-validator"

const OWNER_PATTERN = /^(human|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

/** The bounded HTTP request of assign-responsibility: the new owner, next step and due date of a step. */
export class AssignResponsibilityRequest {
    /** `human` for the signed-in person, else the id of an agent of the workspace. */
    @Matches(OWNER_PATTERN)
    @MaxLength(36)
    owner!: string

    /** What happens next. */
    @IsString()
    @MinLength(1)
    @MaxLength(1000)
    nextAction!: string

    /** When it is due, ISO 8601; null for no date. */
    @ValidateIf((request: AssignResponsibilityRequest) => request.dueAt !== null)
    @IsISO8601({ strict: true })
    @MaxLength(40)
    dueAt!: string | null

    /** A new title; null keeps the current one. */
    @ValidateIf((request: AssignResponsibilityRequest) => request.title !== null)
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    title!: string | null
}
