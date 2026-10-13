import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One line in the content item's history. */
export class ContentEvidenceType {
    /** When this happened, ISO 8601. */
    @Field()
    at!: string

    /** The recorded action kind. */
    @Field()
    kind!: string

    /** The audit name of the actor. */
    @Field()
    by!: string

    /** The recorded detail. */
    @Field()
    text!: string
}
