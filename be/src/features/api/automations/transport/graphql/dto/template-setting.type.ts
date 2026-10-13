import { Field, Float, Int, ObjectType } from "@nestjs/graphql"
import { LocalizedTextType } from "./localized-text.type"

@ObjectType()
/** One setting on a template card. */
export class TemplateSettingType {
    /** The key in the pipeline config. */
    @Field()
    key!: string

    /** `number`, `text`, `email`, `time`, `toggle` or `textarea`. */
    @Field()
    kind!: string

    /** The label of the field. */
    @Field(() => LocalizedTextType)
    label!: LocalizedTextType

    /** A line of help under the field. */
    @Field(() => LocalizedTextType, { nullable: true })
    hint?: LocalizedTextType | undefined

    /** The smallest number (kind number). */
    @Field(() => Float, { nullable: true })
    min?: number | undefined

    /** The biggest number (kind number). */
    @Field(() => Float, { nullable: true })
    max?: number | undefined

    /** The unit shown after the number. */
    @Field(() => LocalizedTextType, { nullable: true })
    suffix?: LocalizedTextType | undefined

    /** The longest text. */
    @Field(() => Int, { nullable: true })
    maxLength?: number | undefined

    /** True when the field must be filled. */
    @Field(() => Boolean, { nullable: true })
    required?: boolean | undefined
}
