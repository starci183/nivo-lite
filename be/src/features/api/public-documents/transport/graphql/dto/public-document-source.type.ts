import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** An internal document a public document was drafted from. */
export class PublicDocumentSourceType {
    /** The internal document. */
    @Field(() => ID)
    sourceId!: string

    /** Its title. */
    @Field(() => String)
    title!: string

    /** True when it changed, or went, since the owner last approved. */
    @Field(() => Boolean)
    changed!: boolean
}
