import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A text in both product languages. */
export class TemplateTextType {
    /** The Vietnamese text. */
    @Field(() => String)
    vi!: string

    /** The English text. */
    @Field(() => String)
    en!: string
}
