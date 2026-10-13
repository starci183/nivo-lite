import { Field, ID, InputType } from "@nestjs/graphql"
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator"

@InputType()
/** A responsibility for a customer. */
export class NewResponsibilityInput {
    /** The customer. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    lead_id!: string

    /** What it is. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    title!: string

    /** `human`, or the id of the owning agent. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(36)
    owner!: string

    /** The next step. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(400)
    next_action!: string

    /** When it is due, ISO 8601; null for no date. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(40)
    due_at: string | null = null
}
