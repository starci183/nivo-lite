import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The next approved scheduled post. */
export class ContentNextPostType {
    /** The scheduled instant, ISO 8601. */
    @Field()
    at!: string

    /** The title of the next post. */
    @Field()
    title!: string
}
