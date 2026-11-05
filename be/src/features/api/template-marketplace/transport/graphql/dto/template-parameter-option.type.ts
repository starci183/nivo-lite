import { Field, ObjectType } from "@nestjs/graphql"
import { TemplateTextType } from "./template-text.type"

@ObjectType()
/** One choice of a `choice` setting. */
export class TemplateParameterOptionType {
    /** The value kept when the buyer picks it. */
    @Field(() => String)
    value!: string

    /** The label in both product languages. */
    @Field(() => TemplateTextType)
    label!: TemplateTextType
}
