import { Field, InputType } from "@nestjs/graphql"
import { IsString, Matches, MaxLength } from "class-validator"

@InputType()
/** A first-party package to start from, and the key of the derivative. */
export class ForkFirstPartyTemplateInput {
    /** The key of the first-party package. */
    @Field(() => String)
    @IsString()
    @MaxLength(60)
    sourceKey!: string

    /** The key of the derivative. */
    @Field(() => String)
    @Matches(/^[a-z][a-z0-9-]{2,59}$/)
    @MaxLength(60)
    key!: string
}
