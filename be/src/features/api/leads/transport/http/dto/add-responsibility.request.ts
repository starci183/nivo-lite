import { IsISO8601, IsString, Matches, MaxLength, MinLength, ValidateIf } from "class-validator"

const OWNER_PATTERN = /^(human|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

/** The bounded HTTP request of add-responsibility: the next step of a lead, its owner and its due date. */
export class AddResponsibilityRequest {
    /** The title of the step. */
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    title!: string

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
    @ValidateIf((request: AddResponsibilityRequest) => request.dueAt !== null)
    @IsISO8601({ strict: true })
    @MaxLength(40)
    dueAt!: string | null
}
