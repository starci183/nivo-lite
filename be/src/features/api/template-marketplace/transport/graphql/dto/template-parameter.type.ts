import { Field, Float, ObjectType } from "@nestjs/graphql"
import { TemplateTextType } from "./template-text.type"

@ObjectType()
/** One setting the buyer fills in. */
export class TemplateParameterType {
    /** The key. */
    @Field(() => String)
    key!: string

    /** `number`, `text`, `toggle` or `textarea`. */
    @Field(() => String)
    kind!: string

    /** The label. */
    @Field(() => TemplateTextType)
    label!: TemplateTextType

    /** A line of help. */
    @Field(() => TemplateTextType, { nullable: true })
    hint!: TemplateTextType | null

    /** The smallest number. */
    @Field(() => Float, { nullable: true })
    min!: number | null

    /** The biggest number. */
    @Field(() => Float, { nullable: true })
    max!: number | null

    /** True when the buyer must fill it. */
    @Field(() => Boolean)
    required!: boolean

    /** The default value as text (a number, a text or `true`/`false`). */
    @Field(() => String)
    defaultValue!: string
}
