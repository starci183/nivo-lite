import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One supporting link of a post. */
export class ContentLinkType {
    /** The target URL. */
    @Field()
    url!: string

    /** The display label. */
    @Field()
    label!: string
}
