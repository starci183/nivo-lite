import { Field, InputType } from "@nestjs/graphql"
import { IsString, Matches, MaxLength, MinLength } from "class-validator"

@InputType()
/** Adds an agent to the workspace. */
export class CreateAgentInput {
    /** The module the agent belongs to. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(60)
    module!: string

    /** The display name. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    name!: string

    /** The @handle, lowercase letters, digits and dashes, free in the workspace. */
    @Field()
    @IsString()
    @Matches(/^[a-z0-9-]+$/)
    @MinLength(2)
    @MaxLength(40)
    handle!: string

    /** The one-line role. */
    @Field()
    @IsString()
    @MaxLength(300)
    role!: string

    /** The owner-facing instructions. */
    @Field()
    @IsString()
    @MaxLength(20000)
    instructions!: string
}
