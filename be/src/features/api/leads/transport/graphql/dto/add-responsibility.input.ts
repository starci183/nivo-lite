import { Field, ID, InputType } from "@nestjs/graphql"
import { IsISO8601, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from "class-validator"

const OWNER_PATTERN = /^(human|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

@InputType()
/** The next responsibility of a lead, its owner and its due date. */
export class AddResponsibilityInput {
    /** The lead the responsibility belongs to. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    leadId!: string

    /** The title of the step. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    title!: string

    /** `human` or the id of an agent of this workspace. */
    @Field()
    @IsString()
    @Matches(OWNER_PATTERN)
    @MaxLength(36)
    owner!: string

    /** What happens next. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(1000)
    nextAction!: string

    /** The due date, ISO 8601; omitted or null means no date. */
    @Field(() => String, { nullable: true, defaultValue: null })
    @IsOptional()
    @IsISO8601({ strict: true })
    @MaxLength(40)
    dueAt!: string | null
}
