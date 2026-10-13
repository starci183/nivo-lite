import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The answer to issuing, resending or copying an invitation link. */
export class InviteResultType {
    /** The invited address. */
    @Field()
    email!: string

    /** The link to accept; the raw token appears only here. */
    @Field()
    link!: string

    /** `invited`, `existing` or `none`. */
    @Field()
    delivery!: string
}
