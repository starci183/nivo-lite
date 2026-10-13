import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments that name a published job. */
export class PublicHiringJobInput {
    /** The workspace slug. */
    @Field(() => String)
    @IsString()
    @MaxLength(80)
    ws!: string

    /** The job slug. */
    @Field(() => String)
    @IsString()
    @MaxLength(120)
    job!: string
}
