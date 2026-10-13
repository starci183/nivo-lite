import { Field, InputType } from "@nestjs/graphql"
import { Matches, MaxLength } from "class-validator"

@InputType()
/** The template a mutation names. */
export class TemplateKeyInput {
    /** The template key. */
    @Field()
    @Matches(/^[a-z][a-z0-9_-]{2,60}$/u)
    @MaxLength(61)
    templateKey!: string
}
