import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Proof that one social channel was posted manually. */
export class ContentPublishedMarkType {
    /** The channel whose post is recorded. */
    @Field()
    channel!: string

    /** When the post was published, ISO 8601. */
    @Field()
    at!: string

    /** The audit name of the publisher. */
    @Field()
    by!: string

    /** The live post URL. */
    @Field()
    url!: string

    /** The publication method. */
    @Field()
    how!: string
}
